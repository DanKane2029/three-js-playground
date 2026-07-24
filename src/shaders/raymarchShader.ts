import { Color } from "three";
import type { ShaderMaterialParameters } from "three";
import { rayCameraUniforms } from "../core/rayCamera";

/**
 * A fullscreen raymarched signed-distance-field scene: three animated primitives
 * fused with a smooth-minimum, an optional infinite domain repetition, a ground
 * plane, soft shadows, ambient occlusion, a cosine color palette, and fog.
 */
export const raymarchShader = (): ShaderMaterialParameters => {
	return {
		uniforms: {
			...rayCameraUniforms(),
			uTime: { value: 0 },
			uSpeed: { value: 1.0 },
			uBlend: { value: 0.5 },
			uRepeat: { value: 0.0 },
			uFog: { value: 0.03 },
			uColorA: { value: new Color("#3a4a8a") },
			uColorB: { value: new Color("#c86b3a") },
		},

		vertexShader: /* glsl */ `
			varying vec2 vUv;
			void main() {
				vUv = position.xy;
				gl_Position = vec4(position.xy, 0.0, 1.0);
			}`,

		fragmentShader: /* glsl */ `
			precision highp float;
			varying vec2 vUv;

			uniform vec3 uCamPos;
			uniform vec3 uRight;
			uniform vec3 uUp;
			uniform vec3 uForward;
			uniform float uAspect;
			uniform float uTanFov;

			uniform float uTime;
			uniform float uSpeed;
			uniform float uBlend;
			uniform float uRepeat;
			uniform float uFog;
			uniform vec3 uColorA;
			uniform vec3 uColorB;

			float smin(float a, float b, float k) {
				float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
				return mix(b, a, h) - k * h * (1.0 - h);
			}
			float sdSphere(vec3 p, float r) { return length(p) - r; }
			float sdBox(vec3 p, vec3 b) {
				vec3 q = abs(p) - b;
				return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
			}
			float sdTorus(vec3 p, vec2 t) {
				vec2 q = vec2(length(p.xz) - t.x, p.y);
				return length(q) - t.y;
			}

			float shapesSDF(vec3 p) {
				float t = uTime * uSpeed;
				vec3 q = p;
				if (uRepeat > 0.01) {
					q.xz = mod(q.xz + 0.5 * uRepeat, uRepeat) - 0.5 * uRepeat;
				}
				float s1 = sdSphere(q - vec3(sin(t) * 0.6, 0.0, 0.0), 0.6);
				float s2 = sdBox(q - vec3(0.0, sin(t * 1.3) * 0.6, 0.0), vec3(0.45));
				float s3 = sdTorus(q - vec3(0.0, 0.0, cos(t * 0.9) * 0.6), vec2(0.55, 0.18));
				float k = max(uBlend, 0.001);
				return smin(smin(s1, s2, k), s3, k);
			}

			float map(vec3 p) {
				return min(shapesSDF(p), p.y + 1.2);
			}

			vec3 calcNormal(vec3 p) {
				vec2 e = vec2(0.0012, 0.0);
				return normalize(vec3(
					map(p + e.xyy) - map(p - e.xyy),
					map(p + e.yxy) - map(p - e.yxy),
					map(p + e.yyx) - map(p - e.yyx)
				));
			}

			float softShadow(vec3 ro, vec3 rd) {
				float res = 1.0;
				float t = 0.05;
				for (int i = 0; i < 40; i++) {
					float h = map(ro + rd * t);
					if (h < 0.001) return 0.0;
					res = min(res, 10.0 * h / t);
					t += clamp(h, 0.02, 0.4);
					if (t > 12.0) break;
				}
				return clamp(res, 0.0, 1.0);
			}

			float ao(vec3 p, vec3 n) {
				float occ = 0.0;
				float sca = 1.0;
				for (int i = 0; i < 5; i++) {
					float h = 0.02 + 0.12 * float(i);
					occ += (h - map(p + n * h)) * sca;
					sca *= 0.6;
				}
				return clamp(1.0 - 1.5 * occ, 0.0, 1.0);
			}

			vec3 palette(float t) {
				return uColorA + uColorB * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
			}

			void main() {
				vec2 uv = vUv;
				vec3 ro = uCamPos;
				vec3 rd = normalize(uv.x * uAspect * uTanFov * uRight + uv.y * uTanFov * uUp + uForward);

				vec3 bg = mix(vec3(0.02, 0.03, 0.06), vec3(0.05, 0.07, 0.12), uv.y * 0.5 + 0.5);

				float t = 0.0;
				bool hit = false;
				vec3 p = ro;
				for (int i = 0; i < 128; i++) {
					p = ro + rd * t;
					float d = map(p);
					if (d < 0.001) { hit = true; break; }
					t += d;
					if (t > 40.0) break;
				}

				vec3 col = bg;
				if (hit) {
					vec3 n = calcNormal(p);
					vec3 lightDir = normalize(vec3(0.7, 0.9, 0.5));
					float diff = max(dot(n, lightDir), 0.0);
					float sh = softShadow(p + n * 0.02, lightDir);
					float occ = ao(p, n);
					bool onGround = (p.y + 1.2) < shapesSDF(p);
					vec3 base;
					if (onGround) {
						float c = mod(floor(p.x) + floor(p.z), 2.0);
						base = mix(vec3(0.10, 0.11, 0.14), vec3(0.16, 0.17, 0.21), c);
					} else {
						base = palette(0.5 + 0.35 * n.y + uTime * uSpeed * 0.03);
					}
					vec3 lit = base * (0.2 * occ + 0.9 * diff * sh);
					lit += vec3(0.3) * pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 24.0) * sh;
					col = mix(bg, lit, exp(-uFog * t * t * 0.02 - uFog * t));
				}

				col = pow(col, vec3(0.4545));
				gl_FragColor = vec4(col, 1.0);
			}`,
	};
};
