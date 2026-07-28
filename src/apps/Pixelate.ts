import {
	Color,
	Mesh,
	MeshNormalMaterial,
	PerspectiveCamera,
	Scene,
	TorusKnotGeometry,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { FolderApi } from "tweakpane";
import type { AppContext } from "../core/App";
import { App } from "../core/App";
import { disposeObject } from "../core/dispose";
import { pixelateShader } from "../shaders/pixelateShader";

/** A spinning shape run through the (revived) pixelate post-process shader. */
export class Pixelate extends App {
	readonly name = "Pixelate";
	readonly description =
		"A spinning shape snapped to a pixel grid by a post-process shader.";

	private readonly params = { pixelSize: 8 };
	private mesh!: Mesh;
	private composer!: EffectComposer;
	private pass!: ShaderPass;

	constructor() {
		super();
		this.scene = new Scene();
		this.scene.background = new Color(0x0a0a12);
		this.camera = new PerspectiveCamera(55, 1, 0.1, 100);
		this.camera.position.set(0, 0, 5);
	}

	setup(ctx: AppContext): void {
		this.mesh = new Mesh(
			new TorusKnotGeometry(1, 0.36, 160, 24),
			new MeshNormalMaterial()
		);
		this.scene.add(this.mesh);

		this.composer = new EffectComposer(ctx.renderer);
		this.composer.addPass(new RenderPass(this.scene, this.camera));
		this.pass = new ShaderPass(
			pixelateShader([ctx.width, ctx.height], this.params.pixelSize)
		);
		this.composer.addPass(this.pass);
		this.composer.addPass(new OutputPass());
	}

	resize(width: number, height: number): void {
		const camera = this.camera as PerspectiveCamera;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		this.composer.setSize(width, height);
		this.pass.uniforms.resolution.value.set(width, height);
	}

	update(dt: number): void {
		this.mesh.rotation.x += dt * 0.5;
		this.mesh.rotation.y += dt * 0.7;
		this.pass.uniforms.pixelSize.value = this.params.pixelSize;
	}

	render(): void {
		this.composer.render();
	}

	setupControls(folder: FolderApi): void {
		folder.addBinding(this.params, "pixelSize", {
			min: 1,
			max: 40,
			step: 1,
		});
	}

	dispose(): void {
		disposeObject(this.scene);
		this.scene.clear();
		this.composer.dispose();
	}
}
