import { Vector2 } from "three";

function randomVec2(): Vector2 {
	return new Vector2(
		Math.random() * 2 - 1,
		Math.random() * 2 - 1
	).normalize();
}

/**
 * Builds a `height` x `width` grid of random unit gradient vectors used as the
 * corner gradients for the Perlin-noise terrain. The last row and column share
 * a single vector so the noise tiles seamlessly across the sphere seam.
 */
export function randomVec2Grid(width: number, height: number): Vector2[][] {
	const border = randomVec2();
	return Array.from({ length: height }, (_, i) =>
		Array.from({ length: width }, (_, j) =>
			i === height - 1 || j === width - 1 ? border : randomVec2()
		)
	);
}
