import {
	Color,
	Group,
	IcosahedronGeometry,
	Mesh,
	MeshBasicMaterial,
	PerspectiveCamera,
	Scene,
	TorusKnotGeometry,
	Vector2,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { FolderApi } from "tweakpane";
import type { AppContext } from "../core/App";
import { App } from "../core/App";
import { disposeObject } from "../core/dispose";

/** A ring of glowing shapes rendered through an UnrealBloom post-process. */
export class BloomField extends App {
	readonly name = "Bloom Field";
	readonly description =
		"Emissive shapes glowing through an UnrealBloom post-process pipeline.";

	private readonly params = { strength: 1.1, radius: 0.5, threshold: 0.0 };
	private readonly group = new Group();

	private composer!: EffectComposer;
	private bloom!: UnrealBloomPass;

	constructor() {
		super();
		this.scene = new Scene();
		this.scene.background = new Color(0x05050a);
		this.camera = new PerspectiveCamera(60, 1, 0.1, 100);
	}

	setup(ctx: AppContext): void {
		this.camera.position.set(0, 0, 14);

		const palette = [
			0xff2d75, 0x2df0ff, 0xffe14d, 0x8a5cff, 0x2dff88, 0xff7b2d,
		];
		const count = palette.length;
		for (let i = 0; i < count; i++) {
			const angle = (i / count) * Math.PI * 2;
			const geometry =
				i % 2 === 0
					? new IcosahedronGeometry(1.4, 0)
					: new TorusKnotGeometry(0.9, 0.32, 90, 12);
			const mesh = new Mesh(
				geometry,
				new MeshBasicMaterial({ color: palette[i] })
			);
			mesh.position.set(Math.cos(angle) * 5.5, Math.sin(angle) * 5.5, 0);
			this.group.add(mesh);
		}
		this.scene.add(this.group);

		const { width, height } = ctx;
		this.composer = new EffectComposer(ctx.renderer);
		this.composer.addPass(new RenderPass(this.scene, this.camera));
		this.bloom = new UnrealBloomPass(
			new Vector2(width, height),
			this.params.strength,
			this.params.radius,
			this.params.threshold
		);
		this.composer.addPass(this.bloom);
		this.composer.addPass(new OutputPass());
	}

	resize(width: number, height: number): void {
		const camera = this.camera as PerspectiveCamera;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		this.composer.setSize(width, height);
	}

	update(dt: number): void {
		this.group.rotation.z += dt * 0.15;
		for (const child of this.group.children) child.rotation.x += dt * 0.4;
		this.bloom.strength = this.params.strength;
		this.bloom.radius = this.params.radius;
		this.bloom.threshold = this.params.threshold;
	}

	render(): void {
		this.composer.render();
	}

	setupControls(folder: FolderApi): void {
		folder.addBinding(this.params, "strength", {
			min: 0,
			max: 3,
			step: 0.01,
		});
		folder.addBinding(this.params, "radius", {
			min: 0,
			max: 1,
			step: 0.01,
		});
		folder.addBinding(this.params, "threshold", {
			min: 0,
			max: 1,
			step: 0.01,
		});
	}

	dispose(): void {
		disposeObject(this.group);
		this.scene.clear();
		this.bloom.dispose();
		this.composer.dispose();
	}
}
