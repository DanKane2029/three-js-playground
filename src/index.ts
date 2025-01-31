import "./style.scss";

import * as THREE from "three";
import { App } from "./apps/App";

// @imported-apps-marker
import { TerrainGenerator } from "./apps/terrain_generator/TerrainGenerator";
import { GroovyTextureApp } from "./apps/GroovyTexture";
import { MandlebrotSet } from "./apps/MandlebrotSet";

const canvas = document.getElementById("canvas");
const renderer = new THREE.WebGLRenderer({
	antialias: true,
	canvas: canvas,
});

renderer.setSize(canvas.clientWidth, canvas.clientHeight);
window.onresize = () => {
	console.log("resize");
	renderer.setSize(canvas.clientWidth, canvas.clientHeight);
};

const appList: App[] = [
	// @app-list-marker
	new TerrainGenerator(),
	new MandlebrotSet(renderer),
	new GroovyTextureApp(),
];

let curApp: App = appList[appList.length - 1];

/**
 * Global animate function. This function calls the animate function on the current app every frame.
 */
const animate = () => {
	requestAnimationFrame(animate);
	curApp.animate();
	renderer.render(curApp.scene, curApp.camera);
};

/**
 * Ends the current app and switches to a new app.
 *
 * @param app - The app to load and start.
 */
const loadApp = (app: App) => {
	curApp.scene.clear();
	curApp.teardown();
	curApp = app;
	curApp.setup();

	const appPropertiesElement = document.getElementById("app-controls");
	appPropertiesElement.innerHTML = "";

	appPropertiesElement.appendChild(
		curApp.inputProperties.generateHTMLElement()
	);

	// change input callbacks for the new app
	renderer.domElement.onclick = curApp.onClick.bind(curApp);
	renderer.domElement.onmousemove = curApp.onMouseMove.bind(curApp);
	renderer.domElement.onmousedown = curApp.onMouseDown.bind(curApp);
	renderer.domElement.onmouseup = curApp.onMouseUp.bind(curApp);
	renderer.domElement.onmouseleave = curApp.onMouseLeave.bind(curApp);
	renderer.domElement.onwheel = curApp.onWheel.bind(curApp);
};

const appSelector = document.getElementById("app-selector-dropdown");
appSelector.addEventListener("change", (e: Event) => {
	const selectedAppName: string = (e.target as HTMLSelectElement).value;
	const selectedApp: App = appList.find(
		(app: App) => app.name === selectedAppName
	);
	loadApp(selectedApp);
});

appList.reverse().forEach((app: App) => {
	const option = document.createElement("option");
	option.value = app.name;
	option.innerText = app.name;
	appSelector.appendChild(option);
});

loadApp(curApp);
animate();
