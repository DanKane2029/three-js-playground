import * as THREE from "three";

/**
 * A Rectangle that can be rendered in a Three.js scene.
 */
class Rectangle extends THREE.Object3D {
	constructor(
		width: number,
		height: number,
		material: THREE.Material = new THREE.MeshBasicMaterial({
			color: new THREE.Color(1, 1, 1),
			side: THREE.DoubleSide,
		})
	) {
		super();

		const halfWidth: number = width / 2;
		const halfHeight: number = height / 2;

		const rectangleShape = new THREE.Shape();
		rectangleShape.moveTo(-halfWidth, -halfHeight);
		rectangleShape.lineTo(halfWidth, -halfHeight);
		rectangleShape.lineTo(halfWidth, halfHeight);
		rectangleShape.lineTo(-halfWidth, halfHeight);
		rectangleShape.lineTo(-halfWidth, -halfHeight);

		const extrudeSettings = {
			depth: 1,
			bevelEnabled: true,
			bevelSegments: 2,
			steps: 2,
			bevelSize: 1,
			bevelThickness: 1,
		};

		const geometry = new THREE.ExtrudeGeometry(
			rectangleShape,
			extrudeSettings
		);

		const mesh = new THREE.Mesh(geometry, material);
		this.add(mesh);
	}
}

export { Rectangle };
