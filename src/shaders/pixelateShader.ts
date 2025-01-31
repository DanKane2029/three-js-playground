import { ShaderMaterialParameters, Vector2 } from "three";

const pixelateShader = (
	size: [number, number],
	pixelSize: number
): ShaderMaterialParameters => {
	console.log(size);
	return {
		uniforms: {
			tDiffuse: {
				value: null as unknown,
			},
			resolution: {
				value: new Vector2(size[0], size[1]),
			},
			pixelSize: {
				value: pixelSize,
			},
		},

		vertexShader: /*glsl*/ `	
			void main() {
	
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
	
			}`,

		fragmentShader: /*glsl*/ `	
			void main() {	
				gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
			}
		`,
	};
};

export { pixelateShader };
