import {
	ACESFilmicToneMapping,
	Color,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PMREMGenerator,
	Scene,
	SphereGeometry,
	TorusKnotGeometry,
	type ToneMapping,
	type WebGLRenderTarget,
	type WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { FolderApi } from "tweakpane";
import type { AppContext } from "../core/App";
import { App } from "../core/App";
import { disposeObject } from "../core/dispose";

/** A lit, orbit-controllable PBR scene using image-based lighting. */
export class PbrViewer extends App {
	readonly name = "PBR Viewer";
	readonly description =
		"A physically based scene with image-based lighting and orbit controls.";

	private readonly params = {
		metalness: 1.0,
		roughness: 0.2,
		envIntensity: 1.0,
		autoRotate: true,
	};

	private controls!: OrbitControls;
	private material!: MeshStandardMaterial;
	private envMap!: WebGLRenderTarget;
	private renderer!: WebGLRenderer;
	private prevToneMapping!: ToneMapping;
	private prevExposure!: number;

	constructor() {
		super();
		this.scene = new Scene();
		this.scene.background = new Color(0x111318);
		this.camera = new PerspectiveCamera(50, 1, 0.1, 100);
		this.camera.position.set(4, 2.5, 6);
	}

	setup(ctx: AppContext): void {
		this.renderer = ctx.renderer;
		this.prevToneMapping = this.renderer.toneMapping;
		this.prevExposure = this.renderer.toneMappingExposure;
		this.renderer.toneMapping = ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1;

		const room = new RoomEnvironment();
		const pmrem = new PMREMGenerator(this.renderer);
		this.envMap = pmrem.fromScene(room, 0.04);
		this.scene.environment = this.envMap.texture;
		this.scene.environmentIntensity = this.params.envIntensity;
		pmrem.dispose();
		room.dispose();

		this.material = new MeshStandardMaterial({
			color: 0xdfe6f2,
			metalness: this.params.metalness,
			roughness: this.params.roughness,
		});
		const hero = new Mesh(
			new TorusKnotGeometry(1.3, 0.42, 160, 32),
			this.material
		);
		this.scene.add(hero);

		const accents = [0xff5a5f, 0x4dd2ff, 0xffd166];
		accents.forEach((color, i) => {
			const angle = (i / accents.length) * Math.PI * 2;
			const sphere = new Mesh(
				new SphereGeometry(0.55, 48, 48),
				new MeshStandardMaterial({
					color,
					metalness: 0.1,
					roughness: 0.35,
				})
			);
			sphere.position.set(
				Math.cos(angle) * 3.2,
				-0.2,
				Math.sin(angle) * 3.2
			);
			this.scene.add(sphere);
		});

		this.controls = new OrbitControls(
			this.camera,
			this.renderer.domElement
		);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.autoRotate = this.params.autoRotate;
		this.controls.autoRotateSpeed = 1.2;
	}

	resize(width: number, height: number): void {
		const camera = this.camera as PerspectiveCamera;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	}

	update(): void {
		this.material.metalness = this.params.metalness;
		this.material.roughness = this.params.roughness;
		this.scene.environmentIntensity = this.params.envIntensity;
		this.controls.autoRotate = this.params.autoRotate;
		this.controls.update();
	}

	setupControls(folder: FolderApi): void {
		folder.addBinding(this.params, "metalness", {
			min: 0,
			max: 1,
			step: 0.01,
		});
		folder.addBinding(this.params, "roughness", {
			min: 0,
			max: 1,
			step: 0.01,
		});
		folder.addBinding(this.params, "envIntensity", {
			min: 0,
			max: 3,
			step: 0.01,
		});
		folder.addBinding(this.params, "autoRotate");
	}

	dispose(): void {
		this.controls.dispose();
		this.envMap.dispose();
		disposeObject(this.scene);
		this.scene.environment = null;
		this.scene.clear();
		this.renderer.toneMapping = this.prevToneMapping;
		this.renderer.toneMappingExposure = this.prevExposure;
	}
}
