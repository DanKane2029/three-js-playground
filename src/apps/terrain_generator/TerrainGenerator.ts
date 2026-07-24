import {
	AdditiveBlending,
	BackSide,
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	Group,
	IcosahedronGeometry,
	Mesh,
	PerspectiveCamera,
	Points,
	PointsMaterial,
	Scene,
	ShaderMaterial,
	SphereGeometry,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FolderApi } from "tweakpane";
import type { AppContext } from "../../core/App";
import { App } from "../../core/App";
import { disposeObject } from "../../core/dispose";
import { planetShader } from "../../shaders/planetShader";
import { atmosphereShader } from "../../shaders/atmosphereShader";
import { cloudShader } from "../../shaders/cloudShader";

const BASE_RADIUS = 10;
const CLOUD_RADIUS = BASE_RADIUS * 1.08;
const ATMO_RADIUS = BASE_RADIUS * 1.32;

interface Preset {
	seaLevel: number;
	amplitude: number;
	frequency: number;
	octaves: number;
	snowLatitude: number;
	atmosphereColor: string;
	cloudCoverage: number;
	cloudColor: string;
	deepWater: string;
	shallowWater: string;
	sand: string;
	grass: string;
	forest: string;
	rock: string;
	snow: string;
}

const PRESETS: Record<string, Preset> = {
	"Earth-like": {
		seaLevel: 0.5,
		amplitude: 1.2,
		frequency: 1.5,
		octaves: 5,
		snowLatitude: 0.78,
		atmosphereColor: "#5aa9ff",
		cloudCoverage: 0.45,
		cloudColor: "#ffffff",
		deepWater: "#0a2a55",
		shallowWater: "#1f6fb0",
		sand: "#d8c68a",
		grass: "#4f9d3a",
		forest: "#2f6d2a",
		rock: "#7a6a55",
		snow: "#f4f6fb",
	},
	Desert: {
		seaLevel: 0.36,
		amplitude: 1.4,
		frequency: 1.8,
		octaves: 6,
		snowLatitude: 0.95,
		atmosphereColor: "#e7a86b",
		cloudCoverage: 0.7,
		cloudColor: "#f3e6cf",
		deepWater: "#264a4a",
		shallowWater: "#3f7d6f",
		sand: "#e3c187",
		grass: "#c69a4e",
		forest: "#9c6b34",
		rock: "#7c5230",
		snow: "#d9b48a",
	},
	Ice: {
		seaLevel: 0.55,
		amplitude: 0.9,
		frequency: 1.6,
		octaves: 5,
		snowLatitude: 0.45,
		atmosphereColor: "#bfe6ff",
		cloudCoverage: 0.55,
		cloudColor: "#ffffff",
		deepWater: "#12406b",
		shallowWater: "#4a8fc0",
		sand: "#cfe4ef",
		grass: "#d7e9f2",
		forest: "#bcd6e6",
		rock: "#9fb4c4",
		snow: "#ffffff",
	},
	Lava: {
		seaLevel: 0.48,
		amplitude: 1.6,
		frequency: 2.0,
		octaves: 6,
		snowLatitude: 0.98,
		atmosphereColor: "#ff5a2a",
		cloudCoverage: 0.75,
		cloudColor: "#5a4038",
		deepWater: "#5a0d05",
		shallowWater: "#c23a10",
		sand: "#ff7b2e",
		grass: "#3a2320",
		forest: "#241413",
		rock: "#4a2a24",
		snow: "#ffd27a",
	},
	Alien: {
		seaLevel: 0.5,
		amplitude: 1.3,
		frequency: 1.7,
		octaves: 5,
		snowLatitude: 0.82,
		atmosphereColor: "#b96bff",
		cloudCoverage: 0.5,
		cloudColor: "#e7d6ff",
		deepWater: "#2a0f4a",
		shallowWater: "#7a2fb0",
		sand: "#c9a8ff",
		grass: "#2fb09a",
		forest: "#1f7d6d",
		rock: "#6a4a8a",
		snow: "#eaffff",
	},
};

const BIOME_KEYS = [
	"deepWater",
	"shallowWater",
	"sand",
	"grass",
	"forest",
	"rock",
	"snow",
] as const;

/** A procedural mini planet generator. */
export class TerrainGenerator extends App {
	readonly name = "Planet Generator";
	readonly description =
		"A procedural mini planet — seamless 3D-noise terrain, biomes, atmosphere, and clouds.";

	private readonly params = {
		preset: "Earth-like",
		...PRESETS["Earth-like"],
		autoRotate: true,
		rotationSpeed: 0.08,
		atmosphere: true,
		atmosphereStrength: 1.1,
		clouds: true,
		cloudSpeed: 1.0,
	};

	private seed = Math.random() * 1000;
	private folder: FolderApi | null = null;

	private group!: Group;
	private planetMat!: ShaderMaterial;
	private planetGeo!: IcosahedronGeometry;
	private cloudMat!: ShaderMaterial;
	private cloudMesh!: Mesh;
	private atmoMat!: ShaderMaterial;
	private stars!: Points;
	private controls!: OrbitControls;

	constructor() {
		super();
		this.scene = new Scene();
		this.scene.background = new Color(0x03040a);
		this.camera = new PerspectiveCamera(45, 1, 0.1, 500);
		this.camera.position.set(0, 6, 34);
	}

	setup(ctx: AppContext): void {
		this.group = new Group();
		this.scene.add(this.group);

		this.planetGeo = new IcosahedronGeometry(BASE_RADIUS, 48);
		this.planetMat = new ShaderMaterial(planetShader());
		this.group.add(new Mesh(this.planetGeo, this.planetMat));

		this.cloudMat = new ShaderMaterial(cloudShader());
		this.cloudMat.transparent = true;
		this.cloudMat.depthWrite = false;
		this.cloudMesh = new Mesh(
			new SphereGeometry(CLOUD_RADIUS, 96, 96),
			this.cloudMat
		);
		this.group.add(this.cloudMesh);

		this.atmoMat = new ShaderMaterial(atmosphereShader());
		this.atmoMat.transparent = true;
		this.atmoMat.depthWrite = false;
		this.atmoMat.blending = AdditiveBlending;
		this.atmoMat.side = BackSide;
		this.group.add(
			new Mesh(new SphereGeometry(ATMO_RADIUS, 64, 64), this.atmoMat)
		);

		this.stars = this.buildStars();
		this.scene.add(this.stars);

		this.controls = new OrbitControls(this.camera, ctx.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.minDistance = 16;
		this.controls.maxDistance = 120;

		this.syncUniforms();
	}

	private buildStars(): Points {
		const count = 1600;
		const positions = new Float32Array(count * 3);
		for (let i = 0; i < count; i++) {
			// Random point on a large sphere shell around the scene.
			const u = Math.random() * 2 - 1;
			const theta = Math.random() * Math.PI * 2;
			const r = 90 + Math.random() * 40;
			const s = Math.sqrt(1 - u * u);
			positions[i * 3] = Math.cos(theta) * s * r;
			positions[i * 3 + 1] = u * r;
			positions[i * 3 + 2] = Math.sin(theta) * s * r;
		}
		const geometry = new BufferGeometry();
		geometry.setAttribute(
			"position",
			new Float32BufferAttribute(positions, 3)
		);
		return new Points(
			geometry,
			new PointsMaterial({
				color: 0xffffff,
				size: 0.6,
				sizeAttenuation: true,
			})
		);
	}

	private syncUniforms(): void {
		const p = this.params;
		const u = this.planetMat.uniforms;
		u.uSeed.value = this.seed;
		u.uFrequency.value = p.frequency;
		u.uAmplitude.value = p.amplitude;
		u.uSeaLevel.value = p.seaLevel;
		u.uOctaves.value = p.octaves;
		u.uSnowLatitude.value = p.snowLatitude;
		for (const key of BIOME_KEYS) u[`u${cap(key)}`].value.set(p[key]);

		const c = this.cloudMat.uniforms;
		c.uSeed.value = this.seed;
		c.uCoverage.value = p.cloudCoverage;
		c.uSpeed.value = p.cloudSpeed;
		c.uColor.value.set(p.cloudColor);

		this.atmoMat.uniforms.uColor.value.set(p.atmosphereColor);
		this.atmoMat.uniforms.uStrength.value = p.atmosphereStrength;

		this.cloudMesh.visible = p.clouds;
		this.atmoMat.visible = p.atmosphere;
	}

	resize(width: number, height: number): void {
		const camera = this.camera as PerspectiveCamera;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	}

	update(dt: number, elapsed: number): void {
		if (this.params.autoRotate) {
			this.group.rotation.y += dt * this.params.rotationSpeed;
		}
		this.cloudMesh.rotation.y += dt * 0.01;
		this.planetMat.uniforms.uTime.value = elapsed;
		this.cloudMat.uniforms.uTime.value = elapsed;
		this.syncUniforms();
		this.controls.update();
	}

	private regenerate(): void {
		this.seed = Math.random() * 1000;
		this.syncUniforms();
	}

	private applyPreset(): void {
		Object.assign(this.params, PRESETS[this.params.preset]);
		this.syncUniforms();
		this.folder?.refresh();
	}

	setupControls(folder: FolderApi): void {
		this.folder = folder;
		folder
			.addBinding(this.params, "preset", {
				options: Object.fromEntries(
					Object.keys(PRESETS).map((k) => [k, k])
				),
			})
			.on("change", () => this.applyPreset());
		folder.addButton({ title: "Regenerate" }).on("click", () => {
			this.regenerate();
		});

		const terrain = folder.addFolder({ title: "Terrain" });
		terrain.addBinding(this.params, "seaLevel", {
			min: 0.2,
			max: 0.8,
			step: 0.01,
		});
		terrain.addBinding(this.params, "amplitude", {
			min: 0,
			max: 2.5,
			step: 0.01,
		});
		terrain.addBinding(this.params, "frequency", {
			min: 0.4,
			max: 4,
			step: 0.01,
		});
		terrain.addBinding(this.params, "octaves", { min: 1, max: 8, step: 1 });
		terrain.addBinding(this.params, "snowLatitude", {
			label: "snow caps",
			min: 0.4,
			max: 1,
			step: 0.01,
		});

		const sky = folder.addFolder({
			title: "Atmosphere & clouds",
			expanded: false,
		});
		sky.addBinding(this.params, "atmosphere");
		sky.addBinding(this.params, "atmosphereStrength", {
			min: 0,
			max: 3,
			step: 0.01,
		});
		sky.addBinding(this.params, "atmosphereColor");
		sky.addBinding(this.params, "clouds");
		sky.addBinding(this.params, "cloudCoverage", {
			min: 0.1,
			max: 0.9,
			step: 0.01,
		});
		sky.addBinding(this.params, "cloudSpeed", {
			min: 0,
			max: 5,
			step: 0.1,
		});

		const motion = folder.addFolder({ title: "Motion", expanded: false });
		motion.addBinding(this.params, "autoRotate");
		motion.addBinding(this.params, "rotationSpeed", {
			min: 0,
			max: 0.5,
			step: 0.01,
		});

		const biomes = folder.addFolder({
			title: "Biome colors",
			expanded: false,
		});
		for (const key of BIOME_KEYS) biomes.addBinding(this.params, key);
	}

	dispose(): void {
		this.controls.dispose();
		disposeObject(this.group);
		disposeObject(this.stars);
		this.scene.clear();
	}
}

function cap(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
