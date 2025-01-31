import { ShaderMaterialParameters, Vector2, Vector4 } from "three";

/**
 * A function that creates the shader programs and uniforms to display the mandlebrot set.
 *
 * @param time - The time elapsed since the app started.
 * @param maxIterations - The maximum number of iterations used to define the mandlebrot set.
 * @param offset - The offset from center on the view of the mandelbrot set.
 * @param zoom - The zoom level of the view of the mandlebrot set.
 * @returns - The shader that creates the mandlebrot set.
 */
const MandlebrotSetShader = (
	time: number,
	maxIterations: number,
	offset: Vector2,
	zoom: number,
	colorList: Vector4[]
): ShaderMaterialParameters => {
	return {
		uniforms: {
			time: {
				value: time,
			},
			maxIterations: {
				value: maxIterations,
			},
			offset: {
				value: offset,
			},
			zoom: {
				value: zoom,
			},
			colorList: {
				value: colorList,
			},
		},

		vertexShader: /*glsl*/ `
		varying vec2 xy;

		void main() {
			vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
			gl_Position = projectionMatrix * modelViewPosition;
			xy = gl_Position.xy;
		}`,

		fragmentShader: /*glsl*/ `
		precision highp float;
		varying vec2 xy;
		uniform float time;
		uniform float maxIterations;
		uniform vec2 offset;
		uniform float zoom;
		uniform vec4[5] colorList;
		
		const int numColors = 7;
		vec4 colorGradient(float colorValue, vec4[numColors] colorList) {
			if (colorValue <= 0.0) {
				return colorList[0];
			}
			
			float cv = colorValue * float(numColors);
			vec4 leftColor = colorList[int(floor(cv))];
			vec4 rightColor = colorList[int(floor(cv)) + 1];
			float m = mod(cv, 1.0);
			return mix(leftColor, rightColor, m);
		}			
		
		void main() {
			vec4 colorValues[numColors] = vec4[numColors](
				vec4(0.0, 0.0, 0.0, 1.0),
				colorList[0],
				colorList[1],
				colorList[2],
				colorList[3],
				colorList[4],
				vec4(0.0, 0.0, 0.0, 1.0)
			);
			
			float zoom_value = sqrt(zoom);
			vec2 c = (xy * zoom_value) + offset;
			vec2 z = vec2(0.0); 
			float iterations = 0.0;

			while (dot(z, z) < 4.0 && iterations < maxIterations) {
				float x = z.x * z.x - z.y * z.y + c.x;
				float y = 2.0 * z.x * z.y + c.y;
				z = vec2(x, y);
				iterations += 1.0;
			}

			float smoothIterations = iterations - log(log(dot(z, z)));
			float colorValue = smoothIterations / maxIterations;
			gl_FragColor = colorGradient(colorValue * 10.0, colorValues);
		}`,
	};
};

export { MandlebrotSetShader };
