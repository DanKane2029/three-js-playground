import { Vector3 } from "three";
import type { ShaderMaterialParameters } from "three";
import { skyGLSL } from "./glsl/sky";

/**
 * A sky dome: a large inward-facing sphere colored by the shared sky model in
 * the direction from the camera through each fragment.
 */
export const skyShader = (): ShaderMaterialParameters => {
	return {
		uniforms: {
			uSunDir: { value: new Vector3(0.4, 0.3, 0.8).normalize() },
		},

		vertexShader: /* glsl */ `
			varying vec3 vWorldPos;
			void main() {
				vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}`,

		fragmentShader: /* glsl */ `
			uniform vec3 uSunDir;
			varying vec3 vWorldPos;

			${skyGLSL}

			void main() {
				vec3 dir = normalize(vWorldPos - cameraPosition);
				gl_FragColor = vec4(skyColor(dir, normalize(uSunDir)), 1.0);
			}`,
	};
};
