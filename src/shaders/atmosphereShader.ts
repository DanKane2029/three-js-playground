import { Color } from "three";
import type { ShaderMaterialParameters } from "three";

/**
 * A fresnel rim glow for a planet's atmosphere. Applied to a sphere slightly
 * larger than the planet, rendered back-side with additive blending so the glow
 * builds up around the silhouette.
 */
export const atmosphereShader = (): ShaderMaterialParameters => {
	return {
		uniforms: {
			uColor: { value: new Color("#5aa9ff") },
			uPower: { value: 3.0 },
			uStrength: { value: 1.1 },
		},

		vertexShader: /* glsl */ `
			varying vec3 vNormalW;
			varying vec3 vViewDir;

			void main() {
				vec4 worldPos = modelMatrix * vec4(position, 1.0);
				vNormalW = normalize(mat3(modelMatrix) * normal);
				vViewDir = normalize(cameraPosition - worldPos.xyz);
				gl_Position = projectionMatrix * viewMatrix * worldPos;
			}`,

		fragmentShader: /* glsl */ `
			uniform vec3 uColor;
			uniform float uPower;
			uniform float uStrength;

			varying vec3 vNormalW;
			varying vec3 vViewDir;

			void main() {
				float fresnel = pow(1.0 - abs(dot(normalize(vViewDir), normalize(vNormalW))), uPower);
				gl_FragColor = vec4(uColor * fresnel * uStrength, fresnel);
			}`,
	};
};
