import { MathUtils, Vector3 } from "three";
import type { IUniform, PerspectiveCamera } from "three";

/**
 * Uniforms a fullscreen raymarching shader needs to reconstruct camera rays.
 * Create them on a shader with {@link rayCameraUniforms} and update every frame
 * with {@link updateRayCamera}, driving the (invisible) perspective camera with
 * OrbitControls for free drag/zoom.
 */
export function rayCameraUniforms(): Record<string, IUniform> {
	return {
		uCamPos: { value: new Vector3() },
		uRight: { value: new Vector3(1, 0, 0) },
		uUp: { value: new Vector3(0, 1, 0) },
		uForward: { value: new Vector3(0, 0, -1) },
		uAspect: { value: 1 },
		uTanFov: { value: Math.tan(MathUtils.degToRad(25)) },
	};
}

/**
 * Copies the camera's world position and basis vectors into the ray uniforms.
 * In the fragment shader:
 *   `vec3 rd = normalize(uv.x*uAspect*uTanFov*uRight + uv.y*uTanFov*uUp + uForward);`
 */
export function updateRayCamera(
	camera: PerspectiveCamera,
	width: number,
	height: number,
	u: Record<string, IUniform>
): void {
	camera.updateMatrixWorld();
	const e = camera.matrixWorld.elements;
	(u.uCamPos.value as Vector3).setFromMatrixPosition(camera.matrixWorld);
	(u.uRight.value as Vector3).set(e[0], e[1], e[2]).normalize();
	(u.uUp.value as Vector3).set(e[4], e[5], e[6]).normalize();
	(u.uForward.value as Vector3).set(-e[8], -e[9], -e[10]).normalize();
	u.uAspect.value = width / height;
	u.uTanFov.value = Math.tan(MathUtils.degToRad(camera.fov) / 2);
}
