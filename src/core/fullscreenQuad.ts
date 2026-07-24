import { Mesh, OrthographicCamera, PlaneGeometry } from "three";
import type { Material } from "three";

/**
 * A plane + orthographic camera that exactly fills clip space (-1..1 on both
 * axes) regardless of viewport size. Full-screen shader apps use this so their
 * fragment shaders receive `gl_Position.xy` in a stable [-1, 1] range and need
 * no work on resize.
 */
export function createFullscreenQuad(material: Material): {
	mesh: Mesh;
	camera: OrthographicCamera;
	geometry: PlaneGeometry;
} {
	const geometry = new PlaneGeometry(2, 2);
	const mesh = new Mesh(geometry, material);
	const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
	camera.position.z = 1;
	return { mesh, camera, geometry };
}
