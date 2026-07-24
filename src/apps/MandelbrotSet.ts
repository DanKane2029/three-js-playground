import { Clock, Scene, ShaderMaterial, Vector2, Vector4 } from "three";
import type { PlaneGeometry } from "three";
import type { FolderApi } from "tweakpane";
import { App } from "../core/App";
import { createFullscreenQuad } from "../core/fullscreenQuad";
import { hexToVec4 } from "../core/color";
import { MandlebrotSetShader } from "../shaders/mandlebrotSetShader";

interface MandelbrotColors {
	one: string;
	two: string;
	three: string;
	four: string;
	five: string;
}

/** The Mandelbrot set: drag to pan, scroll to zoom. */
export class MandelbrotSet extends App {
	readonly name = "Mandelbrot Set";
	readonly description = "Escape-time fractal — drag to pan, scroll to zoom.";

	private readonly params = {
		maxIterations: 500,
		colors: {
			one: "#fc00ff",
			two: "#fcff00",
			three: "#00ff38",
			four: "#00f7ff",
			five: "#3c00ff",
		} satisfies MandelbrotColors,
	};

	private material!: ShaderMaterial;
	private geometry!: PlaneGeometry;
	private readonly clock = new Clock();

	private readonly offset = new Vector2(-0.5, 0);
	private zoom = 2;
	private readonly zoomFactor = 0.95;
	private width = 1;
	private height = 1;
	private drag: { start: Vector2; last: Vector2 } | null = null;

	constructor() {
		super();
		this.scene = new Scene();
	}

	setup(): void {
		this.clock.start();
		this.material = new ShaderMaterial(
			MandlebrotSetShader(
				0,
				this.params.maxIterations,
				this.offset,
				this.zoom,
				this.colorVectors()
			)
		);
		const { mesh, camera, geometry } = createFullscreenQuad(this.material);
		this.camera = camera;
		this.geometry = geometry;
		this.scene.add(mesh);
	}

	resize(width: number, height: number): void {
		this.width = width;
		this.height = height;
	}

	private colorVectors(): Vector4[] {
		return Object.values(this.params.colors).map(hexToVec4);
	}

	private toNormalized(event: PointerEvent): Vector2 {
		return new Vector2(
			-event.clientX / this.width,
			event.clientY / this.height
		);
	}

	private currentOffset(): Vector2 {
		if (!this.drag) return this.offset;
		return this.offset
			.clone()
			.add(
				this.drag.last
					.clone()
					.sub(this.drag.start)
					.multiplyScalar(Math.sqrt(this.zoom))
			);
	}

	update(_dt: number, elapsed: number): void {
		const u = this.material.uniforms;
		u.time.value = elapsed;
		u.zoom.value = this.zoom;
		u.maxIterations.value = this.params.maxIterations;
		u.offset.value = this.currentOffset();
		u.colorList.value = this.colorVectors();
	}

	onPointerDown(event: PointerEvent): void {
		const p = this.toNormalized(event);
		this.drag = { start: p, last: p.clone() };
	}

	onPointerMove(event: PointerEvent): void {
		if (this.drag) this.drag.last = this.toNormalized(event);
	}

	onPointerUp(): void {
		this.commitDrag();
	}

	onPointerLeave(): void {
		this.commitDrag();
	}

	onWheel(event: WheelEvent): void {
		if (event.deltaY < 0) this.zoom *= this.zoomFactor;
		else this.zoom /= this.zoomFactor;
	}

	private commitDrag(): void {
		if (this.drag) this.offset.copy(this.currentOffset());
		this.drag = null;
	}

	setupControls(folder: FolderApi): void {
		folder.addBinding(this.params, "maxIterations", {
			min: 50,
			max: 2000,
			step: 10,
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
