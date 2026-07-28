import { Mesh } from "three";
import type { Material, Object3D } from "three";

/**
 * Recursively disposes the geometries and materials under `root` so switching
 * apps does not leak GPU memory. Textures referenced by materials are disposed
 * by three's material.dispose().
 */
export function disposeObject(root: Object3D): void {
	root.traverse((obj) => {
		const mesh = obj as Mesh;
		mesh.geometry?.dispose();
		const material = mesh.material as Material | Material[] | undefined;
		if (!material) return;
		const materials = Array.isArray(material) ? material : [material];
		for (const m of materials) m.dispose();
	});
}
