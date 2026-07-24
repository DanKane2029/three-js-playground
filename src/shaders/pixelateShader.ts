import { Vector2 } from "three";
import type { ShaderMaterialParameters } from "three";

/**
 * A post-process shader that snaps each output pixel to a coarse grid, giving a
 * blocky "pixel art" look. Designed to be used as a ShaderPass in an
 * EffectComposer: `tDiffuse` receives the previous pass's render.
 *
 * @param size - The render resolution, `[width, height]`, in pixels.
 * @param pixelSize - The size of one output block, in pixels.
 */
const pixelateShader = (
	size: [number, number],
	pixelSize: number
): ShaderMaterialParameters => {
	return {
		uniforms: {
			tDiffuse: { value: null },
			resolution: { value: new Vector2(size[0], size[1]) },
			pixelSize: { value: pixelSize },
		},

		vertexShader: /*glsl*/ `
			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}`,

		fragmentShader: /*glsl*/ `
			uniform sampler2D tDiffuse;
			uniform vec2 resolution;
			uniform float pixelSize;
			varying vec2 vUv;

			void main() {
				vec2 cell = pixelSize / resolution;
				vec2 coord = cell * (floor(vUv / cell) + 0.5);
				gl_FragColor = texture2D(tDiffuse, coord);
			}`,
	};
};

export { pixelateShader };
