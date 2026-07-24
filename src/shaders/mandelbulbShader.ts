import { Color } from "three";
import type { ShaderMaterialParameters } from "three";
import { rayCameraUniforms } from "../core/rayCamera";

/**
 * A fullscreen raymarched Mandelbulb — the 3D analogue of the Mandelbrot set.
 * Uses the classic distance estimator; colors by orbit trap and step count, and
 * lights the surface with a sun direction plus step-based ambient occlusion.
 */
export const mandelbulbShader = (): ShaderMaterialParameters => {
	return {
		uniforms: {
			...rayCameraUniforms(),
			uTime: { value: 0 },
			uPower: { value: 8.0 },
			uIterations: { value: 10 },
			uColorA: { value: new Color("#ff7b3a") },
			uColorB: { value: new Color("#3a6bff") },
			uGlow: { value: 0.6 },
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
			uniform float uPower;
			uniform int uIterations;
			uniform vec3 uColorA;
			uniform vec3 uColorB;
			uniform float uGlow;

			// Mandelbulb distance estimator. Returns distance; outputs an orbit
			// trap (nearest approach to the origin) for coloring.
			float mandelbulbDE(vec3 pos, out float trap) {
				vec3 z = pos;
				float dr = 1.0;
				float r = 0.0;
				trap = 1e10;
				for (int i = 0; i < 16; i++) {
					if (i >= uIterations) break;
					r = length(z);
					if (r > 2.0) break;
					float theta = acos(clamp(z.z / r, -1.0, 1.0));
					float phi = atan(z.y, z.x);
					dr = pow(r, uPower - 1.0) * uPower * dr + 1.0;
					float zr = pow(r, uPower);
					theta *= uPower;
					phi *= uPower;
					z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta));
					z += pos;
					trap = min(trap, r);
				}
				return 0.5 * log(r) * r / dr;
			}

			vec3 calcNormal(vec3 p) {
				vec2 e = vec2(0.0007, 0.0);
				float t;
				return normalize(vec3(
					mandelbulbDE(p + e.xyy, t) - mandelbulbDE(p - e.xyy, t),
					mandelbulbDE(p + e.yxy, t) - mandelbulbDE(p - e.yxy, t),
					mandelbulbDE(p + e.yyx, t) - mandelbulbDE(p - e.yyx, t)
				));
			}

			void main() {
				vec2 uv = vUv;
				vec3 ro = uCamPos;
				vec3 rd = normalize(uv.x * uAspect * uTanFov * uRight + uv.y * uTanFov * uUp + uForward);

				vec3 bg = mix(vec3(0.015, 0.02, 0.04), vec3(0.04, 0.03, 0.07), uv.y * 0.5 + 0.5);

				float t = 0.0;
				float trap = 0.0;
				bool hit = false;
				int steps = 0;
				vec3 p = ro;
				for (int i = 0; i < 160; i++) {
					steps = i;
					p = ro + rd * t;
					float d = mandelbulbDE(p, trap);
					if (d < 0.0004) { hit = true; break; }
					t += d;
					if (t > 8.0) break;
				}

				vec3 col = bg;
				if (hit) {
					vec3 n = calcNormal(p);
					vec3 lightDir = normalize(vec3(0.6, 0.7, 0.5));
					float diff = max(dot(n, lightDir), 0.0);
					float occ = 1.0 - float(steps) / 160.0;
					vec3 base = mix(uColorA, uColorB, clamp(trap * 1.2, 0.0, 1.0));
					col = base * (0.18 + 0.9 * diff) * (0.4 + 0.6 * occ);
					col += vec3(0.4) * pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 20.0);
				} else {
					// Glow: brighten rays that skimmed close to the surface.
					col += uColorA * uGlow * (float(steps) / 160.0) * 0.5;
				}

				col = pow(col, vec3(0.4545));
				gl_FragColor = vec4(col, 1.0);
			}`,
	};
};
