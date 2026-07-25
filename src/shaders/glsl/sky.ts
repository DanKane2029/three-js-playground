/**
 * Shared GLSL: a cheap analytic sky model. Returns the sky color looking in
 * direction `dir` (a unit vector) given a sun direction. Used both by the sky
 * dome and by the ocean's reflection, so the reflected sky always matches the
 * real one.
 */
export const skyGLSL = /* glsl */ `
	vec3 skyColor(vec3 dir, vec3 sunDir) {
		float up = clamp(dir.y, 0.0, 1.0);

		// Vertical gradient from a pale horizon to a deep zenith.
		vec3 horizon = vec3(0.72, 0.80, 0.90);
		vec3 zenith  = vec3(0.13, 0.34, 0.66);
		vec3 sky = mix(horizon, zenith, pow(up, 0.55));

		// Sun disk + broad glow.
		float s = max(dot(dir, sunDir), 0.0);
		float disk = pow(s, 800.0);
		float glow = pow(s, 8.0) * 0.25;
		sky += vec3(1.0, 0.92, 0.75) * (disk * 4.0 + glow);

		// Darken below the horizon.
		sky = mix(sky, vec3(0.05, 0.08, 0.12), clamp(-dir.y * 3.0, 0.0, 1.0));
		return sky;
	}
`;
