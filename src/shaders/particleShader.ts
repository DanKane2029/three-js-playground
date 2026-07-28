import { Vector3 } from "three";
import type { ShaderMaterialParameters } from "three";

/**
 * A GPU particle shader. Every particle's animated position is computed on the
 * GPU in the vertex shader from its base position, a per-particle seed, and
 * time, plus a repulsion from the pointer. The app only feeds uniforms; no
 * per-particle work happens on the CPU each frame.
 */
const particleShader = (): ShaderMaterialParameters => {
	return {
		uniforms: {
			time: { value: 0 },
			uSize: { value: 5 },
			uSpeed: { value: 0.5 },
			uSwirl: { value: 0.6 },
			uPointer: { value: new Vector3(1e4, 1e4, 1e4) },
			uPointerStrength: { value: 6 },
			uColor: { value: new Vector3(0.4, 0.7, 1.0) },
		},

		vertexShader: /*glsl*/ `
			uniform float time;
			uniform float uSize;
			uniform float uSpeed;
			uniform float uSwirl;
			uniform vec3 uPointer;
			uniform float uPointerStrength;
			attribute float aSeed;
			varying float vGlow;

			void main() {
				vec3 p = position;
				float t = time * uSpeed + aSeed * 6.2831853;

				// Swirling flow field, evaluated per particle on the GPU.
				vec3 flow = vec3(
					sin(t + p.y * uSwirl),
					cos(t * 1.1 + p.z * uSwirl),
					sin(t * 0.9 + p.x * uSwirl)
				);
				p += flow;

				// Push away from the pointer, strongest when close.
				vec3 away = p - uPointer;
				float d = length(away);
				p += normalize(away + 1e-4) * uPointerStrength / (d * d + 1.0);

				vec4 mv = modelViewMatrix * vec4(p, 1.0);
				gl_Position = projectionMatrix * mv;
				gl_PointSize = uSize * (40.0 / -mv.z);
				vGlow = 1.0 / (1.0 + d * 0.25);
			}`,

		fragmentShader: /*glsl*/ `
			uniform vec3 uColor;
			varying float vGlow;

			void main() {
				// Soft round point. Alpha blending keeps dense clusters reading
				// as the particle color instead of clipping to white; vGlow adds
				// a subtle brightening near the pointer.
				float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
				gl_FragColor = vec4(uColor * (0.55 + vGlow * 0.6), a * 0.9);
			}`,
	};
};

export { particleShader };
