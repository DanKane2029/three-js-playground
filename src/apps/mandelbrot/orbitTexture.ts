import { DataTexture, FloatType, NearestFilter, RGFormat } from "three";

/**
 * Texel width of the orbit texture. The orbit is a 1-D sequence wrapped into 2-D
 * only because textures are 2-D; the width just has to stay under
 * MAX_TEXTURE_SIZE, which is at least 2048 everywhere WebGL2 runs.
 */
export const ORBIT_TEXTURE_WIDTH = 2048;

/**
 * Uploads a reference orbit as an RG32F texture, one texel per iteration.
 *
 * Nearest filtering is not a quality trade-off here, it is a correctness
 * requirement: the shader indexes this by iteration number with `texelFetch`,
 * and interpolating between two unrelated orbit points would be meaningless.
 * Sampling RG32F unfiltered is core WebGL2, so no float-texture extension is
 * needed — `OES_texture_float_linear` would only matter if we filtered.
 */
export function createOrbitTexture(
	points: Float32Array,
	length: number
): DataTexture {
	const width = ORBIT_TEXTURE_WIDTH;
	const height = Math.max(1, Math.ceil(length / width));

	// Pad to the full rectangle; the tail past `length` is never fetched.
	const data = new Float32Array(width * height * 2);
	data.set(points.subarray(0, length * 2));

	const texture = new DataTexture(data, width, height, RGFormat, FloatType);
	texture.minFilter = NearestFilter;
	texture.magFilter = NearestFilter;
	texture.needsUpdate = true;
	return texture;
}
