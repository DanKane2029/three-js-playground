import "./style.scss";

import type { AppModule } from "./core/App";
import { Playground } from "./core/Playground";

const canvas = document.getElementById("scene") as HTMLCanvasElement;

// Apps are registered lazily: each `load` dynamically imports the app so its
// code (and heavier Three.js addons) only ships when the app is first opened.
// `name` must match the app class's `name` — it drives the selector, the URL
// hash and the docs slug.
const apps: AppModule[] = [
	// @app-list-marker
	{
		name: "Groovy Texture",
		load: () => import("./apps/GroovyTexture").then((m) => new m.GroovyTexture()),
	},
	{
		name: "Mandelbrot Set",
		load: () => import("./apps/MandelbrotSet").then((m) => new m.MandelbrotSet()),
	},
	{
		name: "Planet Generator",
		load: () =>
			import("./apps/terrain_generator/TerrainGenerator").then(
				(m) => new m.TerrainGenerator()
			),
	},
	{
		name: "Bloom Field",
		load: () => import("./apps/BloomField").then((m) => new m.BloomField()),
	},
	{
		name: "Particle Flow",
		load: () => import("./apps/ParticleFlow").then((m) => new m.ParticleFlow()),
	},
	{
		name: "PBR Viewer",
		load: () => import("./apps/PbrViewer").then((m) => new m.PbrViewer()),
	},
	{
		name: "Pixelate",
		load: () => import("./apps/Pixelate").then((m) => new m.Pixelate()),
	},
	{
		name: "Raymarch SDF",
		load: () => import("./apps/Raymarch").then((m) => new m.Raymarch()),
	},
	{
		name: "Mandelbulb",
		load: () => import("./apps/Mandelbulb").then((m) => new m.Mandelbulb()),
	},
	{
		name: "Fluid",
		load: () => import("./apps/FluidSim").then((m) => new m.FluidSim()),
	},
	{
		name: "Ocean",
		load: () => import("./apps/Ocean").then((m) => new m.Ocean()),
	},
];

/** Does this browser have a usable WebGL context at all? */
function webglAvailable(): boolean {
	try {
		const test = document.createElement("canvas");
		return !!(
			window.WebGLRenderingContext &&
			(test.getContext("webgl2") || test.getContext("webgl"))
		);
	} catch {
		return false;
	}
}

/** Cover the page with a friendly message (used when WebGL is unavailable). */
function showFatal(message: string): void {
	const el = document.createElement("div");
	el.setAttribute("role", "alert");
	el.textContent = message;
	Object.assign(el.style, {
		position: "fixed",
		inset: "0",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		textAlign: "center",
		padding: "2rem",
		font: "500 1.05rem/1.6 system-ui, -apple-system, sans-serif",
		color: "#e8e8ef",
		background: "#0a0a12",
		zIndex: "20",
	});
	document.body.appendChild(el);
}

function toggleFullscreen(): void {
	if (document.fullscreenElement) void document.exitFullscreen();
	else void document.documentElement.requestFullscreen();
}

/** Wire up the fullscreen button and keyboard shortcuts around a Playground. */
function setupChrome(playground: Playground): void {
	document
		.getElementById("fullscreen-toggle")
		?.addEventListener("click", toggleFullscreen);

	// Elements toggled by the "hide UI" shortcut (kept in the DOM so they can
	// still receive events; only their visibility changes).
	const chrome = ["app-header", "ui", "fullscreen-toggle"]
		.map((id) => document.getElementById(id))
		.filter((el): el is HTMLElement => el !== null);
	let uiHidden = false;
	const toggleUI = (): void => {
		uiHidden = !uiHidden;
		for (const el of chrome) el.style.visibility = uiHidden ? "hidden" : "";
	};

	window.addEventListener("keydown", (e) => {
		// Don't hijack keys while typing in a control (Tweakpane inputs, etc.).
		const active = document.activeElement as HTMLElement | null;
		if (
			active &&
			(active.isContentEditable ||
				["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName))
		)
			return;
		if (e.metaKey || e.ctrlKey || e.altKey) return;

		switch (e.key) {
			case "f":
				toggleFullscreen();
				break;
			case "h":
				toggleUI();
				break;
			case "ArrowRight":
				playground.cycle(1);
				break;
			case "ArrowLeft":
				playground.cycle(-1);
				break;
			default:
				return;
		}
		e.preventDefault();
	});
}

if (!webglAvailable()) {
	showFatal(
		"This playground needs WebGL, which your browser doesn't appear to " +
			"support or has disabled. Try a recent Chrome, Firefox, Edge or " +
			"Safari with hardware acceleration enabled."
	);
} else {
	try {
		setupChrome(new Playground(canvas, apps));
	} catch (err) {
		console.error("Failed to start the playground:", err);
		showFatal("Something went wrong initialising WebGL on this device.");
	}
}
