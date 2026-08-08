import { Scene, ShaderMaterial, Vector2, Vector4 } from "three";
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

/** Half the view height, in complex-plane units, at startup. */
const INITIAL_SCALE = 1.4;

/** Multiplier applied to `scale` per wheel notch. */
const ZOOM_STEP = 0.95;

/** Bounds on the adaptive iteration count. */
const MIN_ITERATIONS = 100;
const MAX_ITERATIONS = 1_000_000;

/**
 * Iteration count needed to resolve detail at a given depth. The escape time of
 * points near the boundary grows roughly geometrically as you zoom, so a fixed
 * cap that looks fine at the top level renders deep views as flat interior
 * colour. The exponent is empirical, not derived.
 */
function iterationsForDepth(scale: number, detail: number): number {
	const decades = Math.max(0, -Math.log10(scale / INITIAL_SCALE));
	const base = 500 + 1000 * Math.pow(decades, 1.2);
	return Math.round(
		Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, base * detail))
	);
}

/** The Mandelbrot set: drag to pan, scroll to zoom. */
export class MandelbrotSet extends App {
	readonly name = "Mandelbrot Set";
	readonly description = "Escape-time fractal — drag to pan, scroll to zoom.";

	private readonly params = {
		/** Multiplier on the depth-derived iteration count. */
		detail: 1,
		colorCycle: 64,
		colors: {
			one: "#fc00ff",
			two: "#fcff00",
			three: "#00ff38",
			four: "#00f7ff",
			five: "#3c00ff",
		} satisfies MandelbrotColors,
	};

	/** Read-only monitors surfaced in the control panel. */
	private readonly readout = {
		depth: "1.0e+0",
		iterations: MIN_ITERATIONS,
	};

	private material!: ShaderMaterial;
	private geometry!: PlaneGeometry;

	private readonly center = new Vector2(-0.5, 0);
	private scale = INITIAL_SCALE;
	private readonly resolution = new Vector2(1, 1);
	private lastPointer: Vector2 | null = null;

	constructor() {
		super();
		this.scene = new Scene();
	}

	setup(): void {
		this.material = new ShaderMaterial(
			MandlebrotSetShader(
				iterationsForDepth(this.scale, this.params.detail),
				this.center,
				this.scale,
				this.resolution,
				this.params.colorCycle,
				this.colorVectors()
			)
		);
		const { mesh, camera, geometry } = createFullscreenQuad(this.material);
		this.camera = camera;
		this.geometry = geometry;
		this.scene.add(mesh);
	}

	resize(width: number, height: number): void {
		this.resolution.set(width, height);
	}

	private colorVectors(): Vector4[] {
		return Object.values(this.params.colors).map(hexToVec4);
	}

	/**
	 * Complex-plane point under a pixel. Mirrors the mapping in the fragment
	 * shader: normalised coordinates span -1..1 vertically, are stretched by the
	 * aspect ratio horizontally, and y is flipped because screen y grows
	 * downward while the imaginary axis grows upward.
	 */
	private complexAt(px: number, py: number): Vector2 {
		const { x: w, y: h } = this.resolution;
		const aspect = w / h;
		return new Vector2(
			((px / w) * 2 - 1) * aspect * this.scale + this.center.x,
			(1 - (py / h) * 2) * this.scale + this.center.y
		);
	}

	/**
	 * Pan by a pixel delta. Both axes divide by height: the horizontal term
	 * picks up an aspect factor of w/h that cancels the /w, leaving /h.
	 */
	private panByPixels(dx: number, dy: number): void {
		const h = this.resolution.y;
		this.center.x -= (2 * this.scale * dx) / h;
		this.center.y += (2 * this.scale * dy) / h;
	}

	/**
	 * Scale by `k` about a pixel, holding the complex point under that pixel
	 * fixed. Zooming about the viewport centre instead would make deep
	 * navigation impractical — past a few dozen decades the feature you are
	 * aiming at leaves the screen long before you arrive.
	 */
	private zoomAt(px: number, py: number, k: number): void {
		const target = this.complexAt(px, py);
		this.center.x = target.x + (this.center.x - target.x) * k;
		this.center.y = target.y + (this.center.y - target.y) * k;
		this.scale *= k;
	}

	update(): void {
		const iterations = iterationsForDepth(this.scale, this.params.detail);
		const u = this.material.uniforms;
		u.maxIterations.value = iterations;
		u.center.value = this.center;
		u.scale.value = this.scale;
		u.resolution.value = this.resolution;
		u.colorCycle.value = this.params.colorCycle;
		u.colorList.value = this.colorVectors();

		this.readout.iterations = iterations;
		this.readout.depth = this.scale.toExponential(1);
	}

	onPointerDown(event: PointerEvent): void {
		this.lastPointer = new Vector2(event.clientX, event.clientY);
	}

	onPointerMove(event: PointerEvent): void {
		if (!this.lastPointer) return;
		this.panByPixels(
			event.clientX - this.lastPointer.x,
			event.clientY - this.lastPointer.y
		);
		this.lastPointer.set(event.clientX, event.clientY);
	}

	onPointerUp(): void {
		this.lastPointer = null;
	}

	onPointerLeave(): void {
		this.lastPointer = null;
	}

	onWheel(event: WheelEvent): void {
		const k = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
		this.zoomAt(event.clientX, event.clientY, k);
	}

	setupControls(folder: FolderApi): void {
		folder.addBinding(this.params, "detail", {
			label: "Detail",
			min: 0.25,
			max: 4,
			step: 0.05,
		});
		folder.addBinding(this.params, "colorCycle", {
			label: "Colour cycle",
			min: 4,
			max: 512,
			step: 1,
		});

		const view = folder.addFolder({ title: "View" });
		view.addBinding(this.readout, "depth", {
			label: "Half-height",
			readonly: true,
		});
		view.addBinding(this.readout, "iterations", {
			label: "Iterations",
			readonly: true,
			format: (v: number) => v.toFixed(0),
		});

		const colors = folder.addFolder({ title: "Colors" });
		colors.addBinding(this.params.colors, "one", { label: "Color 1" });
		colors.addBinding(this.params.colors, "two", { label: "Color 2" });
		colors.addBinding(this.params.colors, "three", { label: "Color 3" });
		colors.addBinding(this.params.colors, "four", { label: "Color 4" });
		colors.addBinding(this.params.colors, "five", { label: "Color 5" });
	}

	dispose(): void {
		this.geometry.dispose();
		this.material.dispose();
		this.scene.clear();
	}
}
