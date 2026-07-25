import "./style.scss";

import type { App } from "./core/App";
import { Playground } from "./core/Playground";

// @imported-apps-marker
import { GroovyTexture } from "./apps/GroovyTexture";
import { MandelbrotSet } from "./apps/MandelbrotSet";
import { TerrainGenerator } from "./apps/terrain_generator/TerrainGenerator";
import { BloomField } from "./apps/BloomField";
import { ParticleFlow } from "./apps/ParticleFlow";
import { PbrViewer } from "./apps/PbrViewer";
import { Pixelate } from "./apps/Pixelate";
import { Raymarch } from "./apps/Raymarch";
import { Mandelbulb } from "./apps/Mandelbulb";
import { FluidSim } from "./apps/FluidSim";
import { Ocean } from "./apps/Ocean";

const canvas = document.getElementById("scene") as HTMLCanvasElement;

const apps: App[] = [
	// @app-list-marker
	new GroovyTexture(),
	new MandelbrotSet(),
	new TerrainGenerator(),
	new BloomField(),
	new ParticleFlow(),
	new PbrViewer(),
	new Pixelate(),
	new Raymarch(),
	new Mandelbulb(),
	new FluidSim(),
	new Ocean(),
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
