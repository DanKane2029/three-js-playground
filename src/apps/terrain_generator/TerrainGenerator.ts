import {
	Clock,
	DataTexture,
	FloatType,
	Mesh,
	PerspectiveCamera,
	RepeatWrapping,
	RGFormat,
	Scene,
	ShaderMaterial,
	SphereGeometry,
	Vector2,
} from "three";
import type { FolderApi } from "tweakpane";
import { App } from "../../core/App";
import { TerrainShader } from "../../shaders/TerrainShader";
import { randomVec2Grid } from "./perlinNoise";

/** A spherical planet displaced by Perlin noise in the vertex shader. */
export class TerrainGenerator extends App {
	readonly name = "Terrain Generator";
	readonly description =
		"A planet whose surface is displaced by Perlin noise.";

	private readonly params = { rotationSpeed: 0.005, wireframe: false };
	private readonly gridDensity = new Vector2(20, 20);
	private readonly planeSize = new Vector2(40, 30);
	private readonly clock = new Clock();

	private world!: Mesh;
	private material!: ShaderMaterial;
	private geometry!: SphereGeometry;
	private texture!: DataTexture;

	constructor() {
		super();
		this.scene = new Scene();
		this.camera = new PerspectiveCamera(60, 1, 0.01, 1000);
	}

	setup(): void {
		this.clock.start();
		this.camera.position.set(0, 8, 22);
		(this.camera as PerspectiveCamera).lookAt(0, 0, 0);

		this.geometry = new SphereGeometry(10, 512, 512);
		this.texture = this.buildGradientTexture();
		this.material = new ShaderMaterial(
			TerrainShader(0, this.texture, this.planeSize)
		);

		this.world = new Mesh(this.geometry, this.material);
		this.scene.add(this.world);
	}

	resize(width: number, height: number): void {
		const camera = this.camera as PerspectiveCamera;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	}

	private buildGradientTexture(): DataTexture {
		const grid = randomVec2Grid(this.gridDensity.x, this.gridDensity.y);
		const data = new Float32Array(grid.flat().flatMap((v) => [v.x, v.y]));
		const texture = new DataTexture(
			data,
			this.gridDensity.x,
			this.gridDensity.y,
			RGFormat,
			FloatType
		);
		texture.wrapS = RepeatWrapping;
		texture.wrapT = RepeatWrapping;
		texture.needsUpdate = true;
		return texture;
	}

	private regenerate(): void {
		this.texture.dispose();
		this.texture = this.buildGradientTexture();
		this.material.uniforms.perlinNoiseGradientGrid.value = this.texture;
	}

	update(_dt: number, elapsed: number): void {
		this.world.rotation.y = elapsed * this.params.rotationSpeed * 40;
		this.material.wireframe = this.params.wireframe;
	}

	setupControls(folder: FolderApi): void {
		folder.addButton({ title: "Regenerate" }).on("click", () => {
			this.regenerate();
		});
		folder.addBinding(this.params, "rotationSpeed", {
			min: 0,
			max: 0.05,
			step: 0.001,
		});
		folder.addBinding(this.params, "wireframe");
	}

	dispose(): void {
		this.clock.stop();
		this.geometry.dispose();
		this.material.dispose();
		this.texture.dispose();
		this.scene.clear();
	}
}
