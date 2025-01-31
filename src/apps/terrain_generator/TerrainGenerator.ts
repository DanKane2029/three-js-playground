import * as THREE from "three";
import { App } from "../App";
import { AppInputProperties, ButtonInput } from "../AppInputProperties";
import { TerrainShader } from "../../shaders/TerrainShader";
import { randomVec2Grid } from "./perlinNoise";
import { randFloat } from "three/src/math/MathUtils";

/**
 * This is the TerrainGenerator app.
 */
class TerrainGenerator extends App {
	width: number;
	height: number;
	inputProperties: AppInputProperties;
	clock: THREE.Clock;
	world: THREE.Mesh;
	terrainMat: THREE.ShaderMaterial;
	perlinNoiseVecGrid: THREE.Vector2[][];
	gridDensityX: number;
	gridDensityY: number;

	constructor() {
		const width: number = document.body.clientWidth;
		const height: number = document.body.clientHeight;

		super(
			"Terrain generator",
			new THREE.Scene(),
			new THREE.PerspectiveCamera(75, width / height, 0.01, 1000)
		);

		this.width = width;
		this.height = height;
		this.gridDensityX = 20;
		this.gridDensityY = 20;

		this.inputProperties = new AppInputProperties({
			Regenerate: new ButtonInput(
				"Regenerate",
				(() => {
					this.perlinNoiseVecGrid = randomVec2Grid(
						this.gridDensityX,
						this.gridDensityY
					);
					this.updateShaderUniforms();
				}).bind(this)
			),
		});

		this.clock = new THREE.Clock();
	}

	setup(): void {
		const planesize = new THREE.Vector2(40, 30);
		this.perlinNoiseVecGrid = randomVec2Grid(
			this.gridDensityX,
			this.gridDensityY
		);

		this.clock.start();
		this.camera.position.set(0, 20, 0);
		this.camera.lookAt(0, 0, 0);

		const sphereGeometry = new THREE.SphereGeometry(10, 512, 512);

		const buf = this.perlinNoiseVecGrid
			.flat()
			.map((v) => [v.x, v.y])
			.flat();

		const perlinGradientsDataTex = new THREE.DataTexture(
			new Float32Array(buf),
			this.gridDensityX,
			this.gridDensityY,
			THREE.RGFormat,
			THREE.FloatType
		);
		perlinGradientsDataTex.wrapS = THREE.RepeatWrapping;
		perlinGradientsDataTex.wrapT = THREE.RepeatWrapping;
		perlinGradientsDataTex.needsUpdate = true;

		this.terrainMat = new THREE.ShaderMaterial(
			TerrainShader(
				this.clock.getElapsedTime(),
				perlinGradientsDataTex,
				planesize
			)
		);

		this.terrainMat.side = THREE.DoubleSide;
		this.world = new THREE.Mesh(sphereGeometry, this.terrainMat);
		this.world.position.set(0, 0, 0);
		this.world.rotation.set(90, 0, 0);
		this.scene.add(this.world);
	}

	teardown(): void {
		console.log("Terrain generator - teardown function");
	}

	updateShaderUniforms() {
		this.terrainMat.uniforms["time"].value = this.clock.getElapsedTime();

		const buf = this.perlinNoiseVecGrid
			.flat()
			.map((v) => [v.x, v.y])
			.flat();

		const perlinGradientsDataTex = new THREE.DataTexture(
			new Float32Array(buf),
			this.gridDensityX,
			this.gridDensityY,
			THREE.RGFormat,
			THREE.FloatType
		);
		perlinGradientsDataTex.needsUpdate = true;

		this.terrainMat.uniforms["perlinNoiseGradientGrid"].value =
			perlinGradientsDataTex;

		this.terrainMat.needsUpdate = true;
	}

	animate(): void {
		this.world.rotateY(0.005);
	}
}
export { TerrainGenerator };
