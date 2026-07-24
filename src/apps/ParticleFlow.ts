import {
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	NormalBlending,
	PerspectiveCamera,
	Points,
	Scene,
	ShaderMaterial,
	Vector2,
	Vector3,
} from "three";
import type { FolderApi } from "tweakpane";
import { App } from "../core/App";
import { hexToVec4 } from "../core/color";
import { particleShader } from "../shaders/particleShader";

/** A GPU-driven particle field that swirls and reacts to the pointer. */
export class ParticleFlow extends App {
	readonly name = "Particle Flow";
	readonly description =
		"A GPU particle field — move the pointer to push the swarm around.";

	private readonly params = {
		count: 20000,
		speed: 0.5,
		swirl: 0.6,
		size: 5,
		pointerStrength: 6,
		color: "#66b3ff",
	};

	private material!: ShaderMaterial;
	private geometry!: BufferGeometry;
	private points!: Points;

	private readonly ndc = new Vector2();
	private readonly pointerWorld = new Vector3(1e4, 1e4, 1e4);
	private hasPointer = false;
	private width = 1;
	private height = 1;

	constructor() {
		super();
		this.scene = new Scene();
		this.scene.background = new Color(0x05050a);
		this.camera = new PerspectiveCamera(60, 1, 0.1, 100);
	}

	setup(): void {
		this.camera.position.set(0, 0, 30);
		this.material = new ShaderMaterial(particleShader());
		this.material.transparent = true;
		this.material.depthWrite = false;
		this.material.blending = NormalBlending;
		this.geometry = this.buildGeometry(this.params.count);
		this.points = new Points(this.geometry, this.material);
		this.scene.add(this.points);
	}

	private buildGeometry(count: number): BufferGeometry {
		const positions = new Float32Array(count * 3);
		const seeds = new Float32Array(count);
		for (let i = 0; i < count; i++) {
			positions[i * 3] = (Math.random() * 2 - 1) * 14;
			positions[i * 3 + 1] = (Math.random() * 2 - 1) * 14;
			positions[i * 3 + 2] = (Math.random() * 2 - 1) * 14;
			seeds[i] = Math.random();
		}
		const geometry = new BufferGeometry();
		geometry.setAttribute(
			"position",
			new Float32BufferAttribute(positions, 3)
		);
		geometry.setAttribute("aSeed", new Float32BufferAttribute(seeds, 1));
		return geometry;
	}

	private rebuild(): void {
		this.geometry.dispose();
		this.geometry = this.buildGeometry(this.params.count);
		this.points.geometry = this.geometry;
	}

	resize(width: number, height: number): void {
		this.width = width;
		this.height = height;
		const camera = this.camera as PerspectiveCamera;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	}

	update(_dt: number, elapsed: number): void {
		if (this.hasPointer) {
			const dir = new Vector3(this.ndc.x, this.ndc.y, 0.5)
				.unproject(this.camera)
				.sub(this.camera.position)
				.normalize();
			const dist = -this.camera.position.z / dir.z;
			this.pointerWorld
				.copy(this.camera.position)
				.addScaledVector(dir, dist);
		} else {
			this.pointerWorld.set(1e4, 1e4, 1e4);
		}

		const u = this.material.uniforms;
		u.time.value = elapsed;
		u.uSpeed.value = this.params.speed;
		u.uSwirl.value = this.params.swirl;
		u.uSize.value = this.params.size;
		u.uPointerStrength.value = this.params.pointerStrength;
		u.uPointer.value.copy(this.pointerWorld);
		const c = hexToVec4(this.params.color);
		u.uColor.value.set(c.x, c.y, c.z);

		this.points.rotation.y = elapsed * 0.03;
	}

	onPointerMove(event: PointerEvent): void {
		this.ndc.set(
			(event.clientX / this.width) * 2 - 1,
			-(event.clientY / this.height) * 2 + 1
		);
		this.hasPointer = true;
	}

	onPointerLeave(): void {
		this.hasPointer = false;
	}

	setupControls(folder: FolderApi): void {
		folder
			.addBinding(this.params, "count", {
				min: 1000,
				max: 150000,
				step: 1000,
			})
			.on("change", (ev) => {
				if (ev.last) this.rebuild();
			});
		folder.addBinding(this.params, "speed", { min: 0, max: 2, step: 0.01 });
		folder.addBinding(this.params, "swirl", { min: 0, max: 2, step: 0.01 });
		folder.addBinding(this.params, "size", { min: 1, max: 14, step: 1 });
		folder.addBinding(this.params, "pointerStrength", {
			min: 0,
			max: 30,
			step: 0.5,
		});
		folder.addBinding(this.params, "color");
	}

	dispose(): void {
		this.geometry.dispose();
		this.material.dispose();
		this.scene.clear();
	}
}
