import {
	BackSide,
	MathUtils,
	Mesh,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	ShaderMaterial,
	SphereGeometry,
	Vector2,
	Vector3,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FolderApi } from "tweakpane";
import type { AppContext } from "../core/App";
import { App } from "../core/App";
import { OCEAN_WAVE_COUNT, oceanShader } from "../shaders/oceanShader";
import { skyShader } from "../shaders/skyShader";

const GRAVITY = 9.8;
const WAVE_SPREAD = 0.5; // radians the waves fan out around the wind direction

/** A 3D ocean of Gerstner waves under a procedural sky. Drag to orbit. */
export class Ocean extends App {
	readonly name = "Ocean";
	readonly description =
		"A 3D ocean of Gerstner waves with sky reflection and sun glitter — drag to orbit.";

	private readonly params = {
		amplitude: 1.1,
		wavelength: 60,
		choppiness: 0.7,
		windDirection: 40,
		speed: 1.0,
		foam: 0.5,
		waterColor: "#123a4d",
		sunElevation: 18,
		sunAzimuth: 40,
	};

	private oceanMat!: ShaderMaterial;
	private skyMat!: ShaderMaterial;
	private oceanGeo!: PlaneGeometry;
	private skyGeo!: SphereGeometry;
	private controls!: OrbitControls;

	private dirs!: Vector2[];
	private amps!: number[];
	private ks!: number[];
	private omegas!: number[];
	private readonly sunDir = new Vector3();

	constructor() {
		super();
		this.scene = new Scene();
		this.camera = new PerspectiveCamera(50, 1, 0.1, 3000);
		this.camera.position.set(0, 14, 46);
	}

	setup(ctx: AppContext): void {
		this.skyMat = new ShaderMaterial(skyShader());
		this.skyMat.side = BackSide;
		this.skyMat.depthWrite = false;
		this.skyGeo = new SphereGeometry(1200, 32, 16);
		const skyMesh = new Mesh(this.skyGeo, this.skyMat);
		skyMesh.renderOrder = -1;
		this.scene.add(skyMesh);

		this.oceanMat = new ShaderMaterial(oceanShader());
		this.oceanGeo = new PlaneGeometry(600, 600, 200, 200);
		const oceanMesh = new Mesh(this.oceanGeo, this.oceanMat);
		oceanMesh.rotation.x = -Math.PI / 2; // lay the plane flat (local +Z → world up)
		this.scene.add(oceanMesh);

		const u = this.oceanMat.uniforms;
		this.dirs = u.uDir.value as Vector2[];
		this.amps = u.uAmp.value as number[];
		this.ks = u.uK.value as number[];
		this.omegas = u.uOmega.value as number[];

		this.controls = new OrbitControls(this.camera, ctx.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.target.set(0, 0, 0);
		this.controls.minDistance = 12;
		this.controls.maxDistance = 220;
		this.controls.maxPolarAngle = 1.5; // stay above the water

		this.generateWaves();
	}

	private generateWaves(): void {
		const wind = MathUtils.degToRad(this.params.windDirection);
		let maxHeight = 0;
		for (let i = 0; i < OCEAN_WAVE_COUNT; i++) {
			const f = OCEAN_WAVE_COUNT > 1 ? i / (OCEAN_WAVE_COUNT - 1) : 0;
			const wavelength =
				this.params.wavelength * MathUtils.lerp(1, 0.28, f);
			const amp = this.params.amplitude * MathUtils.lerp(1, 0.22, f);
			const angle = wind + MathUtils.lerp(-1, 1, f) * WAVE_SPREAD;
			const k = (2 * Math.PI) / wavelength;

			this.dirs[i].set(Math.cos(angle), Math.sin(angle));
			this.amps[i] = amp;
			this.ks[i] = k;
			this.omegas[i] = Math.sqrt(GRAVITY * k) * this.params.speed;
			maxHeight += amp;
		}
		this.oceanMat.uniforms.uMaxHeight.value = maxHeight;
	}

	private updateSun(): void {
		const el = MathUtils.degToRad(this.params.sunElevation);
		const az = MathUtils.degToRad(this.params.sunAzimuth);
		this.sunDir
			.set(
				Math.cos(el) * Math.cos(az),
				Math.sin(el),
				Math.cos(el) * Math.sin(az)
			)
			.normalize();
		(this.oceanMat.uniforms.uSunDir.value as Vector3).copy(this.sunDir);
		(this.skyMat.uniforms.uSunDir.value as Vector3).copy(this.sunDir);
	}

	resize(width: number, height: number): void {
		const camera = this.camera as PerspectiveCamera;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	}

	update(_dt: number, elapsed: number): void {
		this.generateWaves();
		this.updateSun();
		this.oceanMat.uniforms.uTime.value = elapsed;
		this.oceanMat.uniforms.uSteepness.value = this.params.choppiness;
		this.oceanMat.uniforms.uFoam.value = this.params.foam;
		(
			this.oceanMat.uniforms.uWaterColor.value as { set(c: string): void }
		).set(this.params.waterColor);
		this.controls.update();
	}

	setupControls(folder: FolderApi): void {
		folder.addBinding(this.params, "amplitude", {
			min: 0.1,
			max: 3,
			step: 0.01,
		});
		folder.addBinding(this.params, "wavelength", {
			min: 15,
			max: 140,
			step: 1,
		});
		folder.addBinding(this.params, "choppiness", {
			min: 0,
			max: 1,
			step: 0.01,
		});
		folder.addBinding(this.params, "windDirection", {
			label: "wind dir",
			min: 0,
			max: 360,
			step: 1,
		});
		folder.addBinding(this.params, "speed", { min: 0, max: 3, step: 0.01 });
		folder.addBinding(this.params, "foam", { min: 0, max: 1, step: 0.01 });
		folder.addBinding(this.params, "waterColor", { label: "water color" });

		const sun = folder.addFolder({ title: "Sun", expanded: false });
		sun.addBinding(this.params, "sunElevation", {
			label: "elevation",
			min: -5,
			max: 90,
			step: 1,
		});
		sun.addBinding(this.params, "sunAzimuth", {
			label: "azimuth",
			min: 0,
			max: 360,
			step: 1,
		});
	}

	dispose(): void {
		this.controls.dispose();
		this.oceanGeo.dispose();
		this.oceanMat.dispose();
		this.skyGeo.dispose();
		this.skyMat.dispose();
		this.scene.clear();
	}
}
