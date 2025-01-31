import * as THREE from "three";
import { randFloat } from "three/src/math/MathUtils";

function randomVec2(): THREE.Vector2 {
	return new THREE.Vector2(randFloat(-1, 1), randFloat(-1, 1)).normalize();
}

function randomVec2Grid(width: number, height: number): THREE.Vector2[][] {
	const borderVec = randomVec2();
	const grid = Array.from({ length: height })
		.fill(0)
		.map((_, i: number) =>
			Array.from({ length: width })
				.fill(0)
				.map((v: THREE.Vector2, j: number) => {
					if (i === height - 1 || j === width - 1) {
						v = borderVec;
					} else {
						v = randomVec2();
					}
					return v;
				})
		);

	// grid.map((row: THREE.Vector2[]) => {
	// 	row[width - 1] = row[0];
	// });

	return grid;
}

export { randomVec2Grid };
