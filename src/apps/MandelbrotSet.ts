import { Scene, ShaderMaterial, Vector2, Vector4 } from "three";
import type { DataTexture, PlaneGeometry } from "three";
import type { FolderApi } from "tweakpane";
import { App } from "../core/App";
import { createFullscreenQuad } from "../core/fullscreenQuad";
import { hexToVec4 } from "../core/color";
import { BAILOUT, MandlebrotSetShader } from "../shaders/mandlebrotSetShader";
import type { BigFixed } from "../core/bigFixed";
import { DeepView } from "./mandelbrot/deepView";
import { computeReferenceOrbit } from "./mandelbrot/referenceOrbit";
import type { ReferenceOrbit } from "./mandelbrot/referenceOrbit";
import {
	ORBIT_TEXTURE_WIDTH,
	createOrbitTexture,
} from "./mandelbrot/orbitTexture";
import type {
	OrbitJob,
	OrbitResult,
} from "./mandelbrot/referenceOrbit.worker";

interface MandelbrotColors {
	one: string;
	two: string;
	three: string;
	four: string;
	five: string;
}

/** Half the view height, in complex-plane units, at startup. */
const INITIAL_LOG2_SCALE = Math.log2(1.4);

/** Multiplier applied to the scale per wheel notch. */
const ZOOM_STEP = 0.95;

/** Bounds on the adaptive iteration count. */
const MIN_ITERATIONS = 100;
const MAX_ITERATIONS = 1_000_000;

/** Quiet period before recomputing the reference orbit, in ms. */
const ORBIT_DEBOUNCE_MS = 100;

/**
 * Longest the view may keep drifting from its reference before refreshing
 * anyway. Without this, an unbroken drag would never hit the quiet period and
 * the reference would go stale for as long as the pointer kept moving.
 */
const ORBIT_MAX_STALE_MS = 400;

/**
 * Iteration count needed to resolve detail at a given depth. The escape time of
 * points near the boundary grows roughly geometrically as you zoom, so a fixed
 * cap that looks fine at the top level renders deep views as flat interior
 * colour. The exponent is empirical, not derived.
 */
function iterationsForDepth(decades: number, detail: number): number {
	const base = 500 + 1000 * Math.pow(Math.max(0, decades), 1.2);
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
		depth: "1e+0",
		iterations: MIN_ITERATIONS,
		orbit: 0,
	};

	private material!: ShaderMaterial;
	private geometry!: PlaneGeometry;

	private readonly view = new DeepView("-0.5", "0", INITIAL_LOG2_SCALE);
	private readonly resolution = new Vector2(1, 1);
	private readonly refOffset = new Vector2(0, 0);
	private lastPointer: Vector2 | null = null;

	private worker: Worker | null = null;
	private orbitTexture: DataTexture | null = null;
	/** The point the current orbit was computed for. */
	private refCenter: { re: BigFixed; im: BigFixed } | null = null;
	private refLen = 0;
	/** A reference that escaped cannot be lengthened by asking again. */
	private refEscaped = false;

	private orbitToken = 0;
	private readonly jobs = new Map<
		number,
		{ re: BigFixed; im: BigFixed }
	>();
	private orbitInFlight = false;
	private viewDirty = false;
	private lastChangeAt = 0;
	private lastDispatchAt = 0;

	constructor() {
		super();
		this.scene = new Scene();
	}

	setup(): void {
		this.material = new ShaderMaterial(
			MandlebrotSetShader({
				maxIterations: MIN_ITERATIONS,
				scale: this.view.scaleAsNumber,
				resolution: this.resolution,
				refOffset: this.refOffset,
				refOrbit: null,
				refWidth: ORBIT_TEXTURE_WIDTH,
				refLen: 0,
				colorCycle: this.params.colorCycle,
				colorList: this.colorVectors(),
			})
		);
		const { mesh, camera, geometry } = createFullscreenQuad(this.material);
		this.camera = camera;
		this.geometry = geometry;
		this.scene.add(mesh);

		this.worker = new Worker(
			new URL("./mandelbrot/referenceOrbit.worker.ts", import.meta.url),
			{ type: "module" }
		);
		this.worker.onmessage = this.onOrbitReady;

		// Compute the first orbit inline. It is only a few hundred iterations at
		// the starting depth, and it avoids opening on a blank frame.
		const iterations = iterationsForDepth(
			this.view.depthDecades,
			this.params.detail
		);
		this.applyOrbit(
			computeReferenceOrbit({
				re: this.view.centerRe,
				im: this.view.centerIm,
				maxIterations: iterations,
				bailout: BAILOUT,
			}),
			{ re: this.view.centerRe, im: this.view.centerIm }
		);
	}

	resize(width: number, height: number): void {
		this.resolution.set(width, height);
	}

	private colorVectors(): Vector4[] {
		return Object.values(this.params.colors).map(hexToVec4);
	}

	private markDirty(): void {
		this.viewDirty = true;
		this.lastChangeAt = performance.now();
	}

	private applyOrbit(
		orbit: ReferenceOrbit,
		center: { re: BigFixed; im: BigFixed }
	): void {
		this.orbitTexture?.dispose();
		this.orbitTexture = createOrbitTexture(orbit.points, orbit.length);
		this.refCenter = center;
		this.refLen = orbit.length;
		this.refEscaped = orbit.escaped;

		const u = this.material.uniforms;
		u.refOrbit.value = this.orbitTexture;
		u.refLen.value = orbit.length;
		this.readout.orbit = orbit.length;
	}

	private onOrbitReady = (event: MessageEvent<OrbitResult>): void => {
		const { token, points, length, escaped } = event.data;
		this.orbitInFlight = false;

		const center = this.jobs.get(token);
		this.jobs.delete(token);
		// A newer request already went out; this result is for a view the user
		// has since left.
		if (!center || token !== this.orbitToken) return;

		this.applyOrbit({ points, length, escaped }, center);
	};

	private maybeRequestOrbit(iterations: number): void {
		if (!this.worker || this.orbitInFlight) return;

		// The orbit must be at least as long as the iteration budget, or every
		// pixel rebases on running off the end. A reference that escaped is
		// already as long as it will ever be, so asking again would spin.
		if (!this.refEscaped && this.refLen - 1 < iterations) this.viewDirty = true;
		if (!this.viewDirty) return;

		const now = performance.now();
		const settled = now - this.lastChangeAt >= ORBIT_DEBOUNCE_MS;
		const stale = now - this.lastDispatchAt >= ORBIT_MAX_STALE_MS;
		if (!settled && !stale) return;

		const token = ++this.orbitToken;
		const center = { re: this.view.centerRe, im: this.view.centerIm };
		this.jobs.set(token, center);
		this.orbitInFlight = true;
		this.viewDirty = false;
		this.lastDispatchAt = now;

		const job: OrbitJob = {
			token,
			re: center.re,
			im: center.im,
			maxIterations: iterations,
			bailout: BAILOUT,
		};
		this.worker.postMessage(job);
	}

	update(): void {
		const iterations = iterationsForDepth(
			this.view.depthDecades,
			this.params.detail
		);
		this.maybeRequestOrbit(iterations);

		if (this.refCenter) {
			const o = this.view.offsetInScreenUnits(
				this.refCenter.re,
				this.refCenter.im
			);
			this.refOffset.set(o.x, o.y);
		}

		const u = this.material.uniforms;
		u.maxIterations.value = iterations;
		u.scale.value = this.view.scaleAsNumber;
		u.resolution.value = this.resolution;
		u.refOffset.value = this.refOffset;
		u.colorCycle.value = this.params.colorCycle;
		u.colorList.value = this.colorVectors();

		this.readout.iterations = iterations;
		this.readout.depth = `${(2 ** this.view.depthLog2).toExponential(1)}`;
	}

	onPointerDown(event: PointerEvent): void {
		this.lastPointer = new Vector2(event.clientX, event.clientY);
	}

	onPointerMove(event: PointerEvent): void {
		if (!this.lastPointer) return;
		this.view.panByPixels(
			event.clientX - this.lastPointer.x,
			event.clientY - this.lastPointer.y,
			this.resolution.y
		);
		this.lastPointer.set(event.clientX, event.clientY);
		this.markDirty();
	}

	onPointerUp(): void {
		this.lastPointer = null;
	}

	onPointerLeave(): void {
		this.lastPointer = null;
	}

	onWheel(event: WheelEvent): void {
		const k = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
		this.view.zoomAt(
			event.clientX,
			event.clientY,
			this.resolution.x,
			this.resolution.y,
			k
		);
		this.markDirty();
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
		view.addBinding(this.readout, "orbit", {
			label: "Orbit length",
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
		this.worker?.terminate();
		this.worker = null;
		this.orbitTexture?.dispose();
		this.orbitTexture = null;
		this.jobs.clear();
		this.geometry.dispose();
		this.material.dispose();
		this.scene.clear();
	}
}
