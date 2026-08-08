import { GLSL3 } from "three";
import type { ShaderMaterialParameters, Vector2, Vector4 } from "three";

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
 * Palette lookup and the smooth-iteration -> colour mapping, shared by every
 * variant of the iteration loop. Injected into the fragment shader source.
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
 * A function that creates the shader programs and uniforms to display the
 * mandlebrot set.
 *
 * @param maxIterations - The iteration cap defining the set.
 * @param center - The complex-plane point at the centre of the view.
 * @param scale - Half the view height, in complex-plane units. Smaller = deeper.
 * @param resolution - Viewport size in pixels; only the aspect ratio is used.
 * @param colorCycle - Smooth-iteration span covered by one full palette cycle.
 * @param colorList - The five user-selectable palette stops.
 * @returns - The shader that creates the mandlebrot set.
 */
const MandlebrotSetShader = (
	maxIterations: number,
	center: Vector2,
	scale: number,
	resolution: Vector2,
	colorCycle: number,
	colorList: Vector4[]
): ShaderMaterialParameters => {
	return {
		// GLSL ES 3.00 buys two things this app needs: loops with a
		// non-constant (uniform) bound, and `texelFetch` for indexing the
		// reference orbit by integer iteration number.
		glslVersion: GLSL3,

		uniforms: {
			maxIterations: { value: maxIterations },
			center: { value: center },
			scale: { value: scale },
			resolution: { value: resolution },
			colorCycle: { value: colorCycle },
			colorList: { value: colorList },
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
		uniform vec2 center;
		uniform float scale;
		uniform vec2 resolution;
		uniform float colorCycle;
		uniform vec4 colorList[5];

		${paletteGLSL}

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

			// vPos spans -1..1 on both axes regardless of window shape, so the
			// x component must be stretched by the aspect ratio or the set comes
			// out squashed horizontally.
			float aspect = resolution.x / resolution.y;
			vec2 c = vPos * vec2(aspect, 1.0) * scale + center;

			vec2 z = vec2(0.0);
			bool escaped = false;
			float n = 0.0;

			for (int i = 0; i < maxIterations; i++) {
				z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
				if (dot(z, z) > ${f(BAILOUT * BAILOUT)}) {
					escaped = true;
					n = float(i);
					break;
				}
			}

			// Points still bounded at the cap are treated as interior. Running
			// the smooth-iteration formula on them would take the log of a
			// non-positive number and produce NaN.
			if (!escaped) {
				fragColor = vec4(0.0, 0.0, 0.0, 1.0);
				return;
			}

			fragColor = palette(smoothIter(n, z) / colorCycle, stops);
		}`,
	};
};

export { MandlebrotSetShader };
