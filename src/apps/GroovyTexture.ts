import { Clock, Scene, ShaderMaterial, Vector4 } from "three";
import type { PlaneGeometry } from "three";
import type { FolderApi } from "tweakpane";
import { App } from "../core/App";
import { createFullscreenQuad } from "../core/fullscreenQuad";
import { hexToVec4 } from "../core/color";
import { groovyShader } from "../shaders/groovyShader";

interface GroovyColors {
	one: string;
	two: string;
	three: string;
	four: string;
	five: string;
}

/** A 1970s-inspired star signed-distance-function texture with color bands. */
export class GroovyTexture extends App {
	readonly name = "Groovy Texture";
	readonly description =
		"A 1970s-inspired star drawn with a signed distance function.";

	private readonly params = {
		waveSpeed: 1.5,
		starSize: 0.5,
		colors: {
			one: "#96bf67",
			two: "#648267",
			three: "#fbd266",
			four: "#cf7529",
			five: "#f0f0ff",
		} satisfies GroovyColors,
	};

	private material!: ShaderMaterial;
	private geometry!: PlaneGeometry;
	private readonly clock = new Clock();

	constructor() {
		super();
		this.scene = new Scene();
	}

	setup(): void {
		this.clock.start();
		this.material = new ShaderMaterial(
			groovyShader(
				0,
				this.params.waveSpeed,
				this.colorVectors(),
				this.params.starSize
			)
		);
		const { mesh, camera, geometry } = createFullscreenQuad(this.material);
		this.camera = camera;
		this.geometry = geometry;
		this.scene.add(mesh);
	}

	private colorVectors(): Vector4[] {
		return Object.values(this.params.colors).map(hexToVec4);
	}

	update(_dt: number, elapsed: number): void {
		const u = this.material.uniforms;
		u.time.value = elapsed;
		u.waveSpeed.value = this.params.waveSpeed;
		u.starSize.value = this.params.starSize;
		u.colorList.value = this.colorVectors();
	}

	setupControls(folder: FolderApi): void {
		folder.addBinding(this.params, "waveSpeed", {
			min: 0,
			max: 10,
			step: 0.01,
		});
		folder.addBinding(this.params, "starSize", {
			min: 0,
			max: 1,
			step: 0.001,
		});
		const colors = folder.addFolder({ title: "Colors" });
		colors.addBinding(this.params.colors, "one", { label: "Color 1" });
		colors.addBinding(this.params.colors, "two", { label: "Color 2" });
		colors.addBinding(this.params.colors, "three", { label: "Color 3" });
		colors.addBinding(this.params.colors, "four", { label: "Color 4" });
		colors.addBinding(this.params.colors, "five", { label: "Color 5" });
	}

	dispose(): void {
		this.clock.stop();
		this.geometry.dispose();
		this.material.dispose();
		this.scene.clear();
	}
}
