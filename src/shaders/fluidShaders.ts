/**
 * GLSL for the GPU fluid simulator. This is a grid-based "stable fluids"
 * Navier-Stokes solver (Jos Stam): each field lives in a floating-point render
 * target and every step is a full-screen fragment-shader pass. See the app's
 * README for the math.
 *
 * All passes share `baseVertex`, which precomputes the four neighbouring texel
 * coordinates (left/right/top/bottom) used by the finite-difference passes.
 */

export const baseVertex = /* glsl */ `
	varying vec2 vUv;
	varying vec2 vL;
	varying vec2 vR;
	varying vec2 vT;
	varying vec2 vB;
	uniform vec2 uTexelSize;

	void main() {
		vUv = uv;
		vL = vUv - vec2(uTexelSize.x, 0.0);
		vR = vUv + vec2(uTexelSize.x, 0.0);
		vT = vUv + vec2(0.0, uTexelSize.y);
		vB = vUv - vec2(0.0, uTexelSize.y);
		gl_Position = vec4(position.xy, 0.0, 1.0);
	}
`;

const PRELUDE = /* glsl */ `
	precision highp float;
	precision highp sampler2D;
	varying vec2 vUv;
	varying vec2 vL;
	varying vec2 vR;
	varying vec2 vT;
	varying vec2 vB;
`;

// Semi-Lagrangian advection: trace each cell back along the velocity field and
// sample the source there, fading it slightly (dissipation).
export const advectionFrag =
	PRELUDE +
	/* glsl */ `
	uniform sampler2D uVelocity;
	uniform sampler2D uSource;
	uniform vec2 uTexelSize;
	uniform float dt;
	uniform float dissipation;

	void main() {
		vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * uTexelSize;
		vec4 result = texture2D(uSource, coord);
		float decay = 1.0 + dissipation * dt;
		gl_FragColor = result / decay;
	}
`;

// Divergence of the velocity field (how much fluid is entering/leaving a cell).
export const divergenceFrag =
	PRELUDE +
	/* glsl */ `
	uniform sampler2D uVelocity;

	void main() {
		float L = texture2D(uVelocity, vL).x;
		float R = texture2D(uVelocity, vR).x;
		float T = texture2D(uVelocity, vT).y;
		float B = texture2D(uVelocity, vB).y;
		vec2 C = texture2D(uVelocity, vUv).xy;
		if (vL.x < 0.0) L = -C.x;
		if (vR.x > 1.0) R = -C.x;
		if (vT.y > 1.0) T = -C.y;
		if (vB.y < 0.0) B = -C.y;
		float div = 0.5 * (R - L + T - B);
		gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
	}
`;

// Curl (scalar vorticity) of the velocity field.
export const curlFrag =
	PRELUDE +
	/* glsl */ `
	uniform sampler2D uVelocity;

	void main() {
		float L = texture2D(uVelocity, vL).y;
		float R = texture2D(uVelocity, vR).y;
		float T = texture2D(uVelocity, vT).x;
		float B = texture2D(uVelocity, vB).x;
		float vorticity = R - L - T + B;
		gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
	}
`;

// Vorticity confinement: push velocity toward existing swirls so fine detail
// isn't smeared away by numerical diffusion.
export const vorticityFrag =
	PRELUDE +
	/* glsl */ `
	uniform sampler2D uVelocity;
	uniform sampler2D uCurl;
	uniform float curl;
	uniform float dt;

	void main() {
		float L = texture2D(uCurl, vL).x;
		float R = texture2D(uCurl, vR).x;
		float T = texture2D(uCurl, vT).x;
		float B = texture2D(uCurl, vB).x;
		float C = texture2D(uCurl, vUv).x;

		vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
		force /= length(force) + 0.0001;
		force *= curl * C;
		force.y *= -1.0;

		vec2 velocity = texture2D(uVelocity, vUv).xy;
		velocity += force * dt;
		velocity = clamp(velocity, -1000.0, 1000.0);
		gl_FragColor = vec4(velocity, 0.0, 1.0);
	}
`;

// One Jacobi iteration of the pressure Poisson equation.
export const pressureFrag =
	PRELUDE +
	/* glsl */ `
	uniform sampler2D uPressure;
	uniform sampler2D uDivergence;

	void main() {
		float L = texture2D(uPressure, vL).x;
		float R = texture2D(uPressure, vR).x;
		float T = texture2D(uPressure, vT).x;
		float B = texture2D(uPressure, vB).x;
		float divergence = texture2D(uDivergence, vUv).x;
		float pressure = (L + R + B + T - divergence) * 0.25;
		gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
	}
`;

// Subtract the pressure gradient to make the velocity field divergence-free.
export const gradientSubtractFrag =
	PRELUDE +
	/* glsl */ `
	uniform sampler2D uPressure;
	uniform sampler2D uVelocity;

	void main() {
		float L = texture2D(uPressure, vL).x;
		float R = texture2D(uPressure, vR).x;
		float T = texture2D(uPressure, vT).x;
		float B = texture2D(uPressure, vB).x;
		vec2 velocity = texture2D(uVelocity, vUv).xy;
		velocity -= vec2(R - L, T - B);
		gl_FragColor = vec4(velocity, 0.0, 1.0);
	}
`;

// Add a soft Gaussian blob of `color` into `uTarget` at `point` (used for both
// the velocity impulse and the dye injected by the pointer).
export const splatFrag =
	PRELUDE +
	/* glsl */ `
	uniform sampler2D uTarget;
	uniform float aspectRatio;
	uniform vec3 color;
	uniform vec2 point;
	uniform float radius;

	void main() {
		vec2 p = vUv - point;
		p.x *= aspectRatio;
		vec3 splat = exp(-dot(p, p) / radius) * color;
		vec3 base = texture2D(uTarget, vUv).xyz;
		gl_FragColor = vec4(base + splat, 1.0);
	}
`;

// Multiply a field by a constant (used to bleed pressure between frames).
export const clearFrag =
	PRELUDE +
	/* glsl */ `
	uniform sampler2D uTexture;
	uniform float value;

	void main() {
		gl_FragColor = value * texture2D(uTexture, vUv);
	}
`;

// Final tonemap-ish display of the dye field.
export const displayFrag =
	PRELUDE +
	/* glsl */ `
	uniform sampler2D uTexture;

	void main() {
		vec3 c = texture2D(uTexture, vUv).rgb;
		gl_FragColor = vec4(c, 1.0);
	}
`;
