import * as THREE from "three";
import { App } from "./App";
import {
	AppInputProperties,
	NumberInput,
	ColorInput,
	ListType,
} from "./AppInputProperties";

import { groovyShader } from "../shaders/groovyShader";
import { Rectangle } from "./geometry/Rectangle";

const Z_PLANE = 0;

class GroovyTextureApp extends App {
	width: number;
	height: number;

	clock: THREE.Clock;
	groovyMaterial: THREE.ShaderMaterial;
	inputProperties: AppInputProperties;

	constructor() {
		const width: number = document.body.clientWidth;
		const height: number = document.body.clientHeight;
		super(
			"Groovy Texture",
			new THREE.Scene(),
			new THREE.OrthographicCamera(
				-width / 2,
				width / 2,
				height / 2,
				-height / 2,
				1,
				1000
			)
		);

		this.width = width;
		this.height = height;
		this.clock = new THREE.Clock();
		this.groovyMaterial = new THREE.ShaderMaterial();
		this.inputProperties = new AppInputProperties({
			waveSpeed: new NumberInput("Wave Speed", 0, 10, 1.5),
			starSize: new NumberInput("Star Size", 0, 1),
			colorList: new ListType("Colors", [
				new ColorInput(
					"Color 1",
					new THREE.Color(0.58824, 0.74902, 0.40392)
				),
				new ColorInput(
					"Color 2",
					new THREE.Color(0.39216, 0.5098, 0.40392)
				),
				new ColorInput(
					"Color 3",
					new THREE.Color(0.98431, 0.82353, 0.4)
				),
				new ColorInput(
					"Color 4",
					new THREE.Color(0.81176, 0.45882, 0.16078)
				),
				new ColorInput(
					"Color 5",
					new THREE.Color(0.94118, 0.94118, 1.0)
				),
			]),
		});
	}

	setup(): void {
		this.clock.start();
		this.camera.position.set(0, 0, 1);
		this.camera.lookAt(new THREE.Vector3(0, 0, 0));
		this.scene.background = new THREE.Color(0, 0.5, 1);
		this.scene.add(new THREE.AmbientLight(new THREE.Color(1, 1, 1), 0.1));

		const waveSpeed = (
			this.inputProperties.inputMap["waveSpeed"] as NumberInput
		).curValue;

		const starRadius = (
			this.inputProperties.inputMap["starSize"] as NumberInput
		).curValue;

		const colorList: THREE.Vector4[] = (
			this.inputProperties.inputMap["colorList"] as ListType
		).list.map(
			(input: ColorInput) =>
				new THREE.Vector4(
					input.color.r,
					input.color.g,
					input.color.b,
					1.0
				)
		);

		this.groovyMaterial = new THREE.ShaderMaterial(
			groovyShader(1, waveSpeed, colorList, starRadius)
		);

		this.groovyMaterial.side = THREE.DoubleSide;
		const plane: Rectangle = new Rectangle(
			this.width,
			this.height,
			this.groovyMaterial
		);
		plane.name = "Plane";
		plane.position.set(0, 0, Z_PLANE);
		this.scene.add(plane);
	}

	teardown(): void {
		this.clock.stop();
	}

	animate(): void {
		this.groovyMaterial.uniforms["time"].value =
			this.clock.getElapsedTime();

		this.groovyMaterial.uniforms["waveSpeed"].value = (
			this.inputProperties.inputMap["waveSpeed"] as NumberInput
		).curValue;

		this.groovyMaterial.uniforms["starSize"].value = (
			this.inputProperties.inputMap["starSize"] as NumberInput
		).curValue;

		const colorList: THREE.Vector4[] = (
			this.inputProperties.inputMap["colorList"] as ListType
		).list.map(
			(input: ColorInput) =>
				new THREE.Vector4(
					input.color.r,
					input.color.g,
					input.color.b,
					1.0
				)
		);

		this.groovyMaterial.uniforms["colorList"].value = colorList;

		this.groovyMaterial.uniformsNeedUpdate = true;
	}
}

export { GroovyTextureApp };
