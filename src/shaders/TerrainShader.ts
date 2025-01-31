import { ShaderMaterialParameters, DataTexture, GLSL3, Vector2 } from "three";

/**
 * A function that creates a Terrain shader programs and uniforms.
 *
 * @returns The shader parameters.
 */
const TerrainShader = (
	time: number,
	perlinNoiseGradientGrid: DataTexture,
	planeSize: Vector2
): ShaderMaterialParameters => {
	return {
		uniforms: {
			time: {
				value: time,
			},
			perlinNoiseGradientGrid: {
				value: perlinNoiseGradientGrid,
			},
			planeSize: {
				value: planeSize,
			},
		},

		glslVersion: GLSL3,

		vertexShader: /*glsl*/ `
		varying vec2 xy;
		varying float vHeight;
		uniform float time;
		varying vec2 vUv;
		uniform sampler2D perlinNoiseGradientGrid;
		varying float perlinValue;
		uniform vec2 planeSize;

		float perlinNoise(sampler2D perlinNoiseGradientGrid, vec2 xy) {

			ivec2 gridSize = textureSize(perlinNoiseGradientGrid, 0);
			float gridX = xy.x * float(gridSize.x);
			float gridY = xy.y * float(gridSize.y);
			vec2 gridXY = vec2(gridX, gridY);

			int leftGrid = int(floor(gridX));
			int rightGrid = int(ceil(gridX));
			int lowerGrid = int(floor(gridY));
			int upperGrid = int(ceil(gridY));

			vec2 gridLUgradient = texture(perlinNoiseGradientGrid, vec2(float(leftGrid) / float(gridSize.x), float(upperGrid) / float(gridSize.y))).xy;
			vec2 gridLLgradient = texture(perlinNoiseGradientGrid, vec2(float(leftGrid) / float(gridSize.x), float(lowerGrid)  / float(gridSize.y))).xy;
			vec2 gridRUgradient = texture(perlinNoiseGradientGrid, vec2(float(rightGrid) / float(gridSize.x), float(upperGrid)  / float(gridSize.y))).xy;
			vec2 gridRLgradient = texture(perlinNoiseGradientGrid, vec2(float(rightGrid) / float(gridSize.x), float(lowerGrid)  / float(gridSize.y))).xy;

			vec2 offsetLU = gridXY - vec2(float(leftGrid), float(upperGrid));
			vec2 offsetLL = gridXY - vec2(float(leftGrid), float(lowerGrid));
			vec2 offsetRU = gridXY - vec2(float(rightGrid), float(upperGrid));
			vec2 offsetRL = gridXY - vec2(float(rightGrid), float(lowerGrid));

			float dotLU = dot(gridLUgradient, offsetLU);
			float dotLL = dot(gridLLgradient, offsetLL);
			float dotRU = dot(gridRUgradient, offsetRU);
			float dotRL = dot(gridRLgradient, offsetRL);

			float cellXValue = gridX - float(leftGrid);
			float cellYValue = gridY - float(lowerGrid);
			
			float dotUpper = mix(dotLU, dotRU, smoothstep(0.0, 1.0, cellXValue));
			float dotLower = mix(dotLL, dotRL, smoothstep(0.0, 1.0, cellXValue));
			float bilinearDotValue = mix(dotLower, dotUpper, smoothstep(0.0, 1.0, cellYValue));
			
			return bilinearDotValue;
		}

		void main() {
			vUv = uv;
			vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
			vec4 mvNormal = modelViewMatrix * vec4(normal, 1.0);
			vec2 perlinInput = vec2((position.x / float(planeSize.x) + 0.5), (position.y / float(planeSize.y) + 0.5));

			float perlineNoiseValue = perlinNoise(perlinNoiseGradientGrid, vUv);
			perlineNoiseValue = (log(log(abs(perlineNoiseValue) + 1.0)) + 2.0) / 2.0;

			vHeight = perlineNoiseValue;
			vec4 heightAdjustedPos = modelViewPosition + (mvNormal * -perlineNoiseValue) * 0.05;
			gl_Position = projectionMatrix * heightAdjustedPos;
			xy = gl_Position.xy;
		}`,

		fragmentShader: /*glsl*/ `
		varying float vHeight;
		out vec4 fragColor;
		varying vec2 vUv;

		float sigmoid(float x, float s) {
			return 1./(1.+exp(-x*s));
		}

		void main() {
			// if (vHeight < 0.0) {
			// 	fragColor = vec4(0.0, 0.0, abs(vHeight), 1.0);
			// } else {
			// 	fragColor = vec4(0.0, vHeight, 0.0, 1.0);
			// }
			
			//fragColor = vec4(0.0, vHeight, 0.0, 1.0);
			float mixValue = sigmoid(vHeight, 25.0);
			vec4 blue = vec4(0.0, 0.1, 0.5, 1.0);
			vec4 green = vec4(0.0, 0.5, 0.1, 1.0);
			fragColor = mix(blue, green, mixValue);
		}`,
	};
};

export { TerrainShader };
