import { GLSL3 } from "three";
import type {
	DataTexture,
	ShaderMaterialParameters,
	Vector2,
	Vector4,
} from "three";

/**
 * Escape radius for the iteration. Deliberately large: the smooth (fractional)
 * iteration count is derived from an asymptotic |z| -> |z|^2 argument that only
 * holds well outside the set, so a tight bailout of 2 leaves visible banding.
 * 256 is the usual compromise between smoothness and wasted iterations.
 */
export const BAILOUT = 256.0;

/**
 * Formats a number as a GLSL float literal. Plain interpolation of a JS number
 * drops the fractional part (256.0 becomes "256"), which GLSL reads as an int —
 * and there is no implicit int->float conversion, so `log(256)` fails to
 * compile and `float > 256` is a type error.
 */
const f = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : `${n}`);

/** Number of stops in the cyclic palette (black + 5 user colours + black). */
const NUM_COLORS = 7;

/**
 * Palette lookup and the smooth-iteration -> colour mapping.
 *
 * The palette is *cyclic*: `fract` wraps the parameter and the upper index
 * wraps with it. Both ends of the stop list are black, so the cycle closes
 * seamlessly. Cycling matters at depth, where the smooth iteration count runs
 * into the thousands and a non-repeating ramp would saturate to one colour.
 */
const paletteGLSL = /* glsl */ `
	const int numColors = ${NUM_COLORS};

	vec4 palette(float t, vec4 stops[numColors]) {
		float cv = fract(t) * float(numColors);
		int i = int(cv);
		int j = i + 1 == numColors ? 0 : i + 1;
		return mix(stops[i], stops[j], fract(cv));
	}

	/**
	 * Continuous iteration count. Chosen so it grows by exactly 1 between
	 * successive escapes: at |z| == BAILOUT it equals n, and at |z| == BAILOUT^2
	 * (one iteration of overshoot) it equals n - 1.
	 *
	 * Only ever called on the escape path, where |z| > BAILOUT > e, so
	 * log(|z|) > 1 and the log2 argument is strictly positive. Calling it after
	 * an iteration-cap exit would take log2 of a non-positive number and yield
	 * NaN, which is why the caller must branch first.
	 */
	float smoothIter(float n, vec2 z) {
		return n - log2(log(length(z)) / log(${f(BAILOUT)}));
	}
`;

/**
 * The perturbed iteration.
 *
 * Iterating z -> z^2 + c directly caps the zoom at ~5e4x, because `c` itself
 * has to be representable and a float32 resolves ~1e-7 next to a coordinate of
 * order 1. Perturbation removes that ceiling. Given a reference point C whose
 * orbit Z_n was computed on the CPU at full precision, a nearby pixel
 * c = C + delta has z_n = Z_n + eps_n, and squaring telescopes:
 *
 *     z_{n+1} = (Z_n + eps_n)^2 + C + delta
 *             = Z_{n+1} + 2*Z_n*eps_n + eps_n^2 + delta
 *  => eps_{n+1} = 2*Z_n*eps_n + eps_n^2 + delta
 *
 * delta and eps are minuscule in absolute terms, but only their ~7 leading
 * significant digits are ever needed — the hundreds of digits all live in Z,
 * which arrives precomputed. So the GPU can stay in float32 while the zoom goes
 * arbitrarily deep.
 *
 * REBASING. The recurrence degenerates when |Z_n + eps_n| is far smaller than
 * |Z_n|: the sum cancels, eps loses its leading digits, and the pixel renders
 * as a blobby artefact ("glitch"). The 2014-era remedy detected such pixels and
 * re-rendered them against extra reference orbits, in several passes. Zhuoran's
 * 2021 rebasing replaces all of it: whenever |z| < |eps|, restart the reference
 * at index 0 and carry z across as the new eps. Since Z_0 = 0, z = Z_0 + z
 * holds exactly, so this is an identity rather than an approximation — one
 * branch, one reference orbit, one pass, no glitches.
 *
 * The same branch handles running off the end of the stored orbit, which is
 * also what keeps every `fetchZ` in range.
 */
const perturbationGLSL = /* glsl */ `
	uniform sampler2D refOrbit;
	uniform int refWidth;
	uniform int refLen;

	vec2 fetchZ(int m) {
		return texelFetch(refOrbit, ivec2(m % refWidth, m / refWidth), 0).xy;
	}

	vec2 cmul(vec2 a, vec2 b) {
		return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
	}

	/**
	 * Returns (smooth iteration count, escaped ? 1 : 0) for a pixel at complex
	 * offset dc from the reference point.
	 */
	vec2 perturbedEscape(vec2 dc, int maxIterations) {
		vec2 e = vec2(0.0);   // eps: this pixel's offset from the reference orbit
		int m = 0;            // index into the reference orbit
		vec2 z = vec2(0.0);   // full value, Z_m + eps

		for (int i = 0; i < maxIterations; i++) {
			// eps = 2*Z*eps + eps^2 + dc, factored as (2*Z + eps)*eps + dc to
			// spend one complex multiply instead of two.
			e = cmul(fetchZ(m) * 2.0 + e, e) + dc;
			m++;

			// The escape test uses the full value, not eps alone.
			z = fetchZ(m) + e;

			if (dot(z, z) > ${f(BAILOUT * BAILOUT)}) {
				return vec2(smoothIter(float(i), z), 1.0);
			}

			// Rebase on cancellation, or on reaching the last stored point.
			// Bounding m at refLen - 2 on entry keeps both fetches in range.
			if (dot(z, z) < dot(e, e) || m >= refLen - 1) {
				e = z;
				m = 0;
			}
		}

		return vec2(0.0, 0.0);
	}
`;

export interface MandelbrotUniforms {
	maxIterations: number;
	/** Half the view height, in complex-plane units. */
	scale: number;
	resolution: Vector2;
	/** Centre minus reference point, in units of `scale`. */
	refOffset: Vector2;
	refOrbit: DataTexture | null;
	refWidth: number;
	refLen: number;
	colorCycle: number;
	colorList: Vector4[];
}

/**
 * A function that creates the shader programs and uniforms to display the
 * mandlebrot set.
 *
 * @param init - Initial values for the shader's uniforms.
 * @returns - The shader that creates the mandlebrot set.
 */
const MandlebrotSetShader = (
	init: MandelbrotUniforms
): ShaderMaterialParameters => {
	return {
		// GLSL ES 3.00 buys two things this app needs: loops with a
		// non-constant (uniform) bound, and `texelFetch` for indexing the
		// reference orbit by integer iteration number.
		glslVersion: GLSL3,

		uniforms: {
			maxIterations: { value: init.maxIterations },
			scale: { value: init.scale },
			resolution: { value: init.resolution },
			refOffset: { value: init.refOffset },
			refOrbit: { value: init.refOrbit },
			refWidth: { value: init.refWidth },
			refLen: { value: init.refLen },
			colorCycle: { value: init.colorCycle },
			colorList: { value: init.colorList },
		},

		vertexShader: /* glsl */ `
		out vec2 vPos;

		void main() {
			// The quad is a PlaneGeometry(2, 2) viewed through an orthographic
			// camera spanning -1..1, so position.xy is already the normalised
			// screen coordinate. Reading it directly (rather than round-tripping
			// through gl_Position) keeps it independent of the projection.
			vPos = position.xy;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}`,

		fragmentShader: /* glsl */ `
		precision highp float;

		in vec2 vPos;
		out vec4 fragColor;

		uniform int maxIterations;
		uniform float scale;
		uniform vec2 resolution;
		uniform vec2 refOffset;
		uniform float colorCycle;
		uniform vec4 colorList[5];

		${paletteGLSL}
		${perturbationGLSL}

		void main() {
			vec4 stops[numColors] = vec4[numColors](
				vec4(0.0, 0.0, 0.0, 1.0),
				colorList[0],
				colorList[1],
				colorList[2],
				colorList[3],
				colorList[4],
				vec4(0.0, 0.0, 0.0, 1.0)
			);

			// Nothing sensible to draw until the first orbit arrives.
			if (refLen < 2) {
				fragColor = vec4(0.0, 0.0, 0.0, 1.0);
				return;
			}

			// vPos spans -1..1 on both axes regardless of window shape, so the
			// x component must be stretched by the aspect ratio or the set comes
			// out squashed horizontally. refOffset carries the gap between the
			// current centre and the point the orbit was actually computed for,
			// which is non-zero only while a fresh orbit is still in flight.
			float aspect = resolution.x / resolution.y;
			vec2 dc = (vPos * vec2(aspect, 1.0) + refOffset) * scale;

			vec2 result = perturbedEscape(dc, maxIterations);

			// Points still bounded at the cap are treated as interior. Running
			// the smooth-iteration formula on them would take the log of a
			// non-positive number and produce NaN.
			if (result.y < 0.5) {
				fragColor = vec4(0.0, 0.0, 0.0, 1.0);
				return;
			}

			fragColor = palette(result.x / colorCycle, stops);
		}`,
	};
};

export { MandlebrotSetShader };
