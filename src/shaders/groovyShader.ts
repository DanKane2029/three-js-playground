import { ShaderMaterialParameters, Vector4 } from "three";

/**
 * A function that creates the shader programs and uniforms that will display the groovy texture.
 *
 * @param time - The time elapsed since the app started.
 * @returns The shader that displays the groovy texture.
 */
const groovyShader = (
	time: number,
	waveSpeed: number,
	colorList: Vector4[],
	starSize: number
): ShaderMaterialParameters => {
	return {
		uniforms: {
			time: {
				value: time,
			},
			waveSpeed: {
				value: waveSpeed,
			},
			colorList: {
				value: colorList,
			},
			starSize: {
				value: starSize,
			},
		},

		vertexShader: /*glsl*/ `
		varying vec2 xy;
		uniform float time;

		void main() {
			vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
			gl_Position = projectionMatrix * modelViewPosition;
			xy = gl_Position.xy;
		}`,

		fragmentShader: /*glsl*/ `
		varying vec2 xy;
		uniform float time;
		uniform float waveSpeed;
		uniform vec4[5] colorList;
		uniform float starSize;

		float star_dist(vec2 p, float r, int n, float m) {
			// next 4 lines can be precomputed for a given shape
			float an = 3.141593/float(n);
			float en = 3.141593/m;  // m is between 2 and n
			vec2  acs = vec2(cos(an),sin(an));
			vec2  ecs = vec2(cos(en),sin(en)); // ecs=vec2(0,1) for regular polygon

			float bn = mod(atan(p.x,p.y),2.0*an) - an;
			p = length(p)*vec2(cos(bn),abs(sin(bn)));
			p -= r*acs;
			p += ecs*clamp( -dot(p,ecs), 0.0, r*acs.y/ecs.y);
			return length(p)*sign(p.x);
		}

		void main() {
			int num_colors = colorList.length();
			vec2 xy_remap = xy;
			float dist = star_dist(xy_remap, starSize, 5, 3.4);

			float radius = float(num_colors);
			float threshold = mod((time * waveSpeed), radius);
			int wave_count = int((time * waveSpeed) / radius);

			int color_index = int(dist * radius * float(num_colors) + threshold);

			if (dist < 0.0) {
				color_index = int(0.0 * radius * float(num_colors) + threshold) + num_colors - 1;
			}
			
			gl_FragColor = colorList[(color_index) % num_colors];
		}`,
	};
};

export { groovyShader };
