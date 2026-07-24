import { Color, Vector3 } from "three";
import type { ShaderMaterialParameters } from "three";
import { noiseGLSL } from "./glsl/noise";

/**
 * A drifting cloud layer for a sphere slightly above the planet surface. FBM
 * noise over the sphere direction (offset by time) defines coverage; the layer
 * is lit softly by the sun and rendered transparent.
 */
export const cloudShader = (): ShaderMaterialParameters => {
	return {
		uniforms: {
			uTime: { value: 0 },
			uSeed: { value: 0 },
			uCoverage: { value: 0.45 },
			uSpeed: { value: 1.0 },
			uColor: { value: new Color("#ffffff") },
			uSunDir: { value: new Vector3(0.6, 0.4, 0.7).normalize() },
		},

		vertexShader: /* glsl */ `
			varying vec3 vDir;
			varying vec3 vNormalW;

			void main() {
				vDir = normalize(position);
				vNormalW = normalize(mat3(modelMatrix) * normal);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}`,

		fragmentShader: /* glsl */ `
			uniform float uTime;
			uniform float uSeed;
			uniform float uCoverage;
			uniform float uSpeed;
			uniform vec3 uColor;
			uniform vec3 uSunDir;

			varying vec3 vDir;
			varying vec3 vNormalW;

			${noiseGLSL}

			void main() {
				vec3 p = vDir * 2.6 + vec3(uSeed) + vec3(uTime * uSpeed * 0.02, 0.0, 0.0);
				float n = fbm(p, 5, 2.0, 0.5) * 0.5 + 0.5;
				float alpha = smoothstep(uCoverage, uCoverage + 0.18, n);
				float light = max(dot(normalize(vNormalW), normalize(uSunDir)), 0.0) * 0.7 + 0.3;
				gl_FragColor = vec4(uColor * light, alpha * 0.8);
			}`,
	};
};
