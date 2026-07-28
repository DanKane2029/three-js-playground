import { PerspectiveCamera, Scene, ShaderMaterial } from "three";
import type { PlaneGeometry } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FolderApi } from "tweakpane";
import type { AppContext } from "../core/App";
import { App } from "../core/App";
import { createFullscreenQuad } from "../core/fullscreenQuad";
import { updateRayCamera } from "../core/rayCamera";
import { raymarchShader } from "../shaders/raymarchShader";

/** A fullscreen raymarched signed-distance-field scene. Drag to orbit. */
export class Raymarch extends App {
	readonly name = "Raymarch SDF";
	readonly description =
		"A raymarched signed-distance-field scene with soft shadows — drag to orbit.";

	private readonly params = {
		speed: 1,
		blend: 0.5,
		repeat: 0,
		fog: 0.03,
		colorA: "#3a4a8a",
		colorB: "#c86b3a",
	};

	private material!: ShaderMaterial;
	private geometry!: PlaneGeometry;
	private readonly viewCamera = new PerspectiveCamera(50, 1, 0.1, 100);
	private controls!: OrbitControls;
	private width = 1;
	private height = 1;

	constructor() {
		super();
		this.scene = new Scene();
	}

	setup(ctx: AppContext): void {
		this.material = new ShaderMaterial(raymarchShader());
		const { mesh, camera, geometry } = createFullscreenQuad(this.material);
		mesh.frustumCulled = false;
		this.camera = camera;
		this.geometry = geometry;
		this.scene.add(mesh);

		this.viewCamera.position.set(2.6, 1.6, 3.6);
		this.controls = new OrbitControls(
			this.viewCamera,
			ctx.renderer.domElement
		);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.minDistance = 2;
		this.controls.maxDistance = 20;
	}

	resize(width: number, height: number): void {
		this.width = width;
		this.height = height;
		this.viewCamera.aspect = width / height;
		this.viewCamera.updateProjectionMatrix();
	}

	update(_dt: number, elapsed: number): void {
		this.controls.update();
		updateRayCamera(
			this.viewCamera,
			this.width,
			this.height,
			this.material.uniforms
		);
		const u = this.material.uniforms;
		u.uTime.value = elapsed;
		u.uSpeed.value = this.params.speed;
		u.uBlend.value = this.params.blend;
		u.uRepeat.value = this.params.repeat;
		u.uFog.value = this.params.fog;
		u.uColorA.value.set(this.params.colorA);
		u.uColorB.value.set(this.params.colorB);
	}

	setupControls(folder: FolderApi): void {
		folder.addBinding(this.params, "speed", { min: 0, max: 3, step: 0.01 });
		folder.addBinding(this.params, "blend", {
			min: 0.05,
			max: 1.5,
			step: 0.01,
		});
		folder.addBinding(this.params, "repeat", {
			label: "repeat (0=off)",
			min: 0,
			max: 8,
			step: 0.1,
		});
		folder.addBinding(this.params, "fog", {
			min: 0,
			max: 0.1,
			step: 0.001,
		});
		folder.addBinding(this.params, "colorA", { label: "palette A" });
		folder.addBinding(this.params, "colorB", { label: "palette B" });
	}

	dispose(): void {
		this.controls.dispose();
		this.geometry.dispose();
		this.material.dispose();
		this.scene.clear();
	}
}
