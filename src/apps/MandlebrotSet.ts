import * as THREE from "three";

import { App } from "./App";
import { Rectangle } from "./geometry/Rectangle";
import { MandlebrotSetShader } from "../shaders/mandlebrotSetShader";
import { AppInputProperties, ListType, ColorInput } from "./AppInputProperties";

const Z_PLANE = 0;

class MouseDrag {
	start: THREE.Vector2 | undefined;
	end: THREE.Vector2 | undefined;

	constructor() {
		this.start = new THREE.Vector2(0, 0);
		this.end = new THREE.Vector2(0, 0);
	}

	reset(): void {
		this.start = undefined;
		this.end = undefined;
	}
}

class MandlebrotSet extends App {
	width: number;
	height: number;
	renderer: THREE.WebGLRenderer;
	maxIterations: number;
	mandlebrotSetMaterial: THREE.ShaderMaterial;
	clock: THREE.Clock;
	offset: THREE.Vector2;
	dragData: MouseDrag;
	zoom: number;
	zoomDelta: number;

	constructor(renderer: THREE.WebGLRenderer) {
		const width: number = document.body.clientWidth;
		const height: number = document.body.clientHeight;
		super(
			"Mandlebrot Set",
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
		this.renderer = renderer;
		this.maxIterations = 10000;
		this.mandlebrotSetMaterial = new THREE.ShaderMaterial();
		this.clock = new THREE.Clock();
		this.offset = new THREE.Vector2(-0.5, 0);
		this.zoom = 2;
		this.zoomDelta = 0.95;
		this.dragData = new MouseDrag();
		this.dragData.reset();

		this.inputProperties = new AppInputProperties({
			colorList: new ListType("Colors", [
				new ColorInput("Color 1", new THREE.Color(0.99, 0.0, 1.0)),
				new ColorInput("Color 2", new THREE.Color(0.99, 1.0, 0.0)),
				new ColorInput("Color 3", new THREE.Color(0.0, 1.0, 0.22)),
				new ColorInput("Color 4", new THREE.Color(0.0, 0.97, 1.0)),
				new ColorInput("Color 5", new THREE.Color(0.235, 0.0, 1.0)),
			]),
		});
	}

	setup(): void {
		this.clock.start();
		this.camera.lookAt(new THREE.Vector3(0, 0, 0));
		this.scene.add(new THREE.AmbientLight(new THREE.Color(1, 1, 1), 0.1));
		this.scene.background = new THREE.Color(0.1, 0.3, 0.8);
		console.log(this.inputProperties);
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

		this.mandlebrotSetMaterial = new THREE.ShaderMaterial(
			MandlebrotSetShader(
				this.clock.getElapsedTime(),
				this.maxIterations,
				this.offset,
				this.zoom,
				colorList
			)
		);
		this.mandlebrotSetMaterial.side = THREE.DoubleSide;
		const testRect: Rectangle = new Rectangle(
			this.width,
			this.height,
			this.mandlebrotSetMaterial
		);

		testRect.position.set(0, 0, Z_PLANE);
		this.scene.add(testRect);
	}

	teardown(): void {
		this.clock.stop();
	}

	animate(): void {
		this.mandlebrotSetMaterial.uniforms["time"].value =
			this.clock.getElapsedTime();

		this.mandlebrotSetMaterial.uniforms["zoom"].value = this.zoom;

		if (this.dragData.start && this.dragData.end) {
			const offsetClone = this.offset.clone();
			const startClone = this.dragData.start.clone();
			const endClone = this.dragData.end.clone();
			this.mandlebrotSetMaterial.uniforms["offset"].value =
				offsetClone.add(
					endClone
						.sub(startClone)
						.multiplyScalar(Math.sqrt(this.zoom))
				);
		} else {
			this.mandlebrotSetMaterial.uniforms["offset"].value = this.offset;
		}

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

		this.mandlebrotSetMaterial.uniforms["colorList"].value = colorList;

		this.mandlebrotSetMaterial.uniformsNeedUpdate = true;
	}

	onMouseDown(event: MouseEvent): void {
		if (event.target instanceof Element) {
			const p = new THREE.Vector2(
				-event.clientX / event.target.clientWidth,
				event.clientY / event.target.clientHeight
			);

			if (!this.dragData.start) {
				this.dragData.start = p;
			}

			this.dragData.end = p;
		}
	}

	onMouseMove(event: PointerEvent): void {
		if (event.target instanceof Element) {
			this.dragData.end = new THREE.Vector2(
				-event.clientX / event.target.clientWidth,
				event.clientY / event.target.clientHeight
			);
		}
	}

	onMouseUp(event: MouseEvent): void {
		this.offset.add(
			this.dragData.end
				.sub(this.dragData.start)
				.multiplyScalar(Math.sqrt(this.zoom))
		);
		console.log(this.offset, this.zoom);
		this.dragData.reset();
	}

	onMouseLeave(event: MouseEvent): void {
		this.dragData.reset();
	}

	onWheel(event: WheelEvent): void {
		if (event.deltaY < 0) {
			this.zoom *= this.zoomDelta;
		} else {
			this.zoom /= this.zoomDelta;
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	onClick(event: PointerEvent): void {}
}

export { MandlebrotSet };
