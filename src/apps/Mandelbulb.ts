import { PerspectiveCamera, Scene, ShaderMaterial } from "three";
import type { PlaneGeometry } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FolderApi } from "tweakpane";
import type { AppContext } from "../core/App";
import { App } from "../core/App";
import { createFullscreenQuad } from "../core/fullscreenQuad";
import { updateRayCamera } from "../core/rayCamera";
import { mandelbulbShader } from "../shaders/mandelbulbShader";

/** A fullscreen raymarched Mandelbulb fractal. Drag to orbit, scroll to zoom. */
export class Mandelbulb extends App {
	readonly name = "Mandelbulb";
	readonly description =
		"A raymarched 3D Mandelbulb fractal — drag to orbit, scroll to zoom.";

	private readonly params = {
		power: 8,
		iterations: 10,
		glow: 0.6,
		colorA: "#ff7b3a",
		colorB: "#3a6bff",
		animatePower: false,
	};

	private material!: ShaderMaterial;
	private geometry!: PlaneGeometry;
	private readonly viewCamera = new PerspectiveCamera(45, 1, 0.1, 100);
	private controls!: OrbitControls;
	private width = 1;
	private height = 1;

	constructor() {
		super();
		this.scene = new Scene();
	}

	setup(ctx: AppContext): void {
		this.material = new ShaderMaterial(mandelbulbShader());
		const { mesh, camera, geometry } = createFullscreenQuad(this.material);
		mesh.frustumCulled = false;
		this.camera = camera;
		this.geometry = geometry;
		this.scene.add(mesh);

		this.viewCamera.position.set(0, 0.6, 2.6);
		this.controls = new OrbitControls(
			this.viewCamera,
			ctx.renderer.domElement
		);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.minDistance = 1.3;
		this.controls.maxDistance = 8;
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
		u.uPower.value = this.params.animatePower
			? 4 + 4 * (Math.sin(elapsed * 0.3) * 0.5 + 0.5)
			: this.params.power;
		u.uIterations.value = this.params.iterations;
		u.uGlow.value = this.params.glow;
		u.uColorA.value.set(this.params.colorA);
		u.uColorB.value.set(this.params.colorB);
	}

	setupControls(folder: FolderApi): void {
		folder.addBinding(this.params, "power", { min: 2, max: 12, step: 0.1 });
		folder.addBinding(this.params, "animatePower", {
			label: "animate power",
		});
		folder.addBinding(this.params, "iterations", {
			min: 4,
			max: 16,
			step: 1,
		});
		folder.addBinding(this.params, "glow", { min: 0, max: 2, step: 0.01 });
		folder.addBinding(this.params, "colorA", { label: "color A" });
		folder.addBinding(this.params, "colorB", { label: "color B" });
	}

	dispose(): void {
		this.controls.dispose();
		this.geometry.dispose();
		this.material.dispose();
		this.scene.clear();
	}
}
