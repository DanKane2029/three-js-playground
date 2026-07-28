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

new Playground(canvas, apps);

// Fullscreen toggle.
const fullscreenButton = document.getElementById("fullscreen-toggle");
fullscreenButton?.addEventListener("click", () => {
	if (document.fullscreenElement) {
		void document.exitFullscreen();
	} else {
		void document.documentElement.requestFullscreen();
	}
});
