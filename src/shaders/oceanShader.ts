import { Color, Vector2, Vector3 } from "three";
import type { ShaderMaterialParameters } from "three";
import { skyGLSL } from "./glsl/sky";

export const OCEAN_WAVE_COUNT = 4;

/**
 * The ocean surface. The vertex shader sums a set of **Gerstner (trochoidal)
 * waves** — which displace vertices horizontally as well as vertically, giving
 * sharp crests and broad troughs — and computes the analytic surface normal. The
 * fragment shader shades the water with a Fresnel blend between a deep water
 * color and the reflected sky, a specular sun glint, foam on the crests, and
 * distance fog toward the horizon.
 *
 * The mesh is a plane rotated flat, so the plane's local +Z (its normal)
 * corresponds to world "up"; all wave math is done in that local frame.
 */
export const oceanShader = (): ShaderMaterialParameters => {
	const zeros = Array.from({ length: OCEAN_WAVE_COUNT });
	return {
		uniforms: {
			uTime: { value: 0 },
			uDir: { value: zeros.map(() => new Vector2(1, 0)) },
			uAmp: { value: zeros.map(() => 0) },
			uK: { value: zeros.map(() => 1) },
			uOmega: { value: zeros.map(() => 1) },
			uSteepness: { value: 0.6 },
			uMaxHeight: { value: 1 },
			uSunDir: { value: new Vector3(0.4, 0.3, 0.8).normalize() },
			uWaterColor: { value: new Color("#123a4d") },
			uFoam: { value: 0.5 },
			uFogDensity: { value: 0.0016 },
		},

		vertexShader: /* glsl */ `
			const int NUM = ${OCEAN_WAVE_COUNT};
			uniform float uTime;
			uniform vec2 uDir[NUM];
			uniform float uAmp[NUM];
			uniform float uK[NUM];
			uniform float uOmega[NUM];
			uniform float uSteepness;

			varying vec3 vWorldPos;
			varying vec3 vNormal;
			varying float vHeight;

			void main() {
				vec2 p = position.xy;          // horizontal grid coords (local)
				vec2 horiz = vec2(0.0);
				float height = 0.0;
				vec3 n = vec3(0.0, 0.0, 1.0);  // local up is +Z

				for (int i = 0; i < NUM; i++) {
					vec2 D = normalize(uDir[i]);
					float term = uK[i] * dot(D, p) + uOmega[i] * uTime;
					float c = cos(term);
					float s = sin(term);
					float WA = uK[i] * uAmp[i];
					// Per-wave steepness, capped so crests never loop over.
					float Qi = uSteepness / (uK[i] * uAmp[i] * float(NUM));

					horiz += Qi * uAmp[i] * D * c;
					height += uAmp[i] * s;

					n.x -= D.x * WA * c;
					n.y -= D.y * WA * c;
					n.z -= Qi * WA * s;
				}

				vec3 displaced = vec3(p + horiz, height);
				vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
				vWorldPos = worldPos.xyz;
				vNormal = normalize(mat3(modelMatrix) * normalize(n));
				vHeight = height;
				gl_Position = projectionMatrix * viewMatrix * worldPos;
			}`,

		fragmentShader: /* glsl */ `
			uniform vec3 uSunDir;
			uniform vec3 uWaterColor;
			uniform float uFoam;
			uniform float uMaxHeight;
			uniform float uFogDensity;

			varying vec3 vWorldPos;
			varying vec3 vNormal;
			varying float vHeight;

			${skyGLSL}

			float fresnel(float cosTheta, float F0) {
				return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
			}

			void main() {
				vec3 N = normalize(vNormal);
				vec3 V = normalize(cameraPosition - vWorldPos);
				vec3 sun = normalize(uSunDir);
				vec3 R = reflect(-V, N);

				// Fresnel blend between deep water and the reflected sky.
				vec3 reflectCol = skyColor(R, sun);
				float F = fresnel(max(dot(N, V), 0.0), 0.02);
				vec3 color = mix(uWaterColor, reflectCol, F);

				// Subsurface-ish glow where crests face away from the sun.
				float crest = clamp(vHeight / max(uMaxHeight, 0.001), 0.0, 1.0);
				color += uWaterColor * crest * pow(max(dot(V, -sun), 0.0), 2.0) * 0.3;

				// Specular sun glitter.
				vec3 H = normalize(sun + V);
				float spec = pow(max(dot(N, H), 0.0), 220.0);
				color += vec3(1.0, 0.95, 0.8) * spec * 1.5;

				// Foam on the highest crests.
				float foam = smoothstep(0.6, 0.95, crest) * uFoam;
				color = mix(color, vec3(1.0), foam);

				// Distance fog toward the sky the horizon would reflect.
				float dist = length(vWorldPos - cameraPosition);
				float fog = clamp(exp(-dist * uFogDensity), 0.0, 1.0);
				vec3 fogColor = skyColor(normalize(vWorldPos - cameraPosition), sun);
				color = mix(fogColor, color, fog);

				gl_FragColor = vec4(color, 1.0);
			}`,
	};
};
