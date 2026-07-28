import { Color, Vector3 } from "three";
import type { ShaderMaterialParameters } from "three";
import { noiseGLSL } from "./glsl/noise";

/**
 * The planet surface shader. The vertex shader displaces the sphere by 3D FBM
 * terrain (flat at/below sea level, raised above it) and computes a surface
 * normal by sampling neighbouring points. The fragment shader re-evaluates the
 * elevation per pixel (so biome coastlines stay smooth regardless of mesh
 * tessellation), colors by elevation biome, and lights it with a sun direction
 * plus a specular highlight on water.
 */
export const planetShader = (): ShaderMaterialParameters => {
	const terrainGLSL = /* glsl */ `
		uniform float uSeed;
		uniform float uFrequency;
		uniform float uAmplitude;
		uniform float uSeaLevel;
		uniform int uOctaves;

		${noiseGLSL}

		// Normalized elevation in 0..1 for a unit direction.
		float terrainElevation(vec3 dir) {
			float e = fbm(dir * uFrequency + vec3(uSeed), uOctaves, 2.0, 0.5);
			return e * 0.5 + 0.5;
		}

		// Displaced radius for a direction. Water (below sea level) stays at the
		// base radius, producing a flat ocean.
		float radiusFor(vec3 dir, float baseR, out float landRaw) {
			float n = terrainElevation(dir);
			landRaw = max(n - uSeaLevel, 0.0);
			float land = landRaw / max(1.0 - uSeaLevel, 0.001);
			return baseR + land * uAmplitude;
		}
	`;

	return {
		uniforms: {
			uTime: { value: 0 },
			uSeed: { value: 0 },
			uFrequency: { value: 1.5 },
			uAmplitude: { value: 1.2 },
			uSeaLevel: { value: 0.5 },
			uOctaves: { value: 5 },
			uSunDir: { value: new Vector3(0.6, 0.4, 0.7).normalize() },
			uSnowLatitude: { value: 0.78 },
			uDeepWater: { value: new Color("#0a2a55") },
			uShallowWater: { value: new Color("#1f6fb0") },
			uSand: { value: new Color("#d8c68a") },
			uGrass: { value: new Color("#4f9d3a") },
			uForest: { value: new Color("#2f6d2a") },
			uRock: { value: new Color("#7a6a55") },
			uSnow: { value: new Color("#f4f6fb") },
		},

		vertexShader: /* glsl */ `
			varying vec3 vNormalW;
			varying vec3 vViewDir;
			varying vec3 vDir;

			${terrainGLSL}

			void main() {
				vec3 dir = normalize(position);
				float baseR = length(position);

				float landRaw;
				float r = radiusFor(dir, baseR, landRaw);
				vec3 displaced = dir * r;

				// Estimate the normal from two tangent neighbours.
				vec3 up = abs(dir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, dir));
				vec3 bitangent = cross(dir, tangent);
				float eps = 0.02;
				float lr1;
				float lr2;
				vec3 dir1 = normalize(dir + tangent * eps);
				vec3 dir2 = normalize(dir + bitangent * eps);
				vec3 p1 = dir1 * radiusFor(dir1, baseR, lr1);
				vec3 p2 = dir2 * radiusFor(dir2, baseR, lr2);
				vec3 nrm = normalize(cross(p1 - displaced, p2 - displaced));
				if (dot(nrm, dir) < 0.0) nrm = -nrm;

				vDir = dir;
				vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
				vNormalW = normalize(mat3(modelMatrix) * nrm);
				vViewDir = normalize(cameraPosition - worldPos.xyz);
				gl_Position = projectionMatrix * viewMatrix * worldPos;
			}`,

		fragmentShader: /* glsl */ `
			uniform vec3 uSunDir;
			uniform float uSnowLatitude;
			uniform vec3 uDeepWater;
			uniform vec3 uShallowWater;
			uniform vec3 uSand;
			uniform vec3 uGrass;
			uniform vec3 uForest;
			uniform vec3 uRock;
			uniform vec3 uSnow;

			varying vec3 vNormalW;
			varying vec3 vViewDir;
			varying vec3 vDir;

			${terrainGLSL}

			void main() {
				vec3 dir = normalize(vDir);
				float n = terrainElevation(dir);
				float landRaw = max(n - uSeaLevel, 0.0);

				vec3 N = normalize(vNormalW);
				vec3 L = normalize(uSunDir);
				float diffuse = max(dot(N, L), 0.0);
				float ambient = 0.18;

				bool isWater = landRaw <= 0.0;
				vec3 albedo;

				if (isWater) {
					float depth = clamp((uSeaLevel - n) / max(uSeaLevel, 0.001), 0.0, 1.0);
					albedo = mix(uShallowWater, uDeepWater, depth);
				} else {
					float h = clamp(landRaw / max(1.0 - uSeaLevel, 0.001), 0.0, 1.0);
					albedo = uSand;
					albedo = mix(albedo, uGrass, smoothstep(0.02, 0.16, h));
					albedo = mix(albedo, uForest, smoothstep(0.16, 0.42, h));
					albedo = mix(albedo, uRock, smoothstep(0.42, 0.72, h));
					albedo = mix(albedo, uSnow, smoothstep(0.76, 0.95, h));
					// Polar ice caps.
					albedo = mix(albedo, uSnow, smoothstep(uSnowLatitude, uSnowLatitude + 0.08, abs(dir.y)));
				}

				vec3 color = albedo * (ambient + diffuse);

				if (isWater) {
					vec3 H = normalize(L + normalize(vViewDir));
					float spec = pow(max(dot(N, H), 0.0), 64.0);
					color += vec3(spec) * 0.7;
				}

				gl_FragColor = vec4(color, 1.0);
			}`,
	};
};
