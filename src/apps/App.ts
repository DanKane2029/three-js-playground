import { Camera, Scene } from "three";
import { AppInputProperties } from "./AppInputProperties";

/**
 * Interface that defines the base functionaility each application must implement.
 */
class App {
	name: string;
	scene: Scene;
	camera: Camera;
	inputProperties: AppInputProperties;

	constructor(name: string, scene: Scene, camera: Camera) {
		this.name = name;
		this.scene = scene;
		this.camera = camera;
		this.inputProperties = new AppInputProperties();
	}
	/**
	 * Called once when the application starts.
	 */
	setup(): void {
		// do nothing
	}

	/**
	 * Called once when the application ends.
	 */
	teardown(): void {
		// do nothing
	}

	/**
	 * Called every frame.
	 */
	animate(): void {
		// do nothing
	}

	/**
	 * Called every time the user clicks.
	 *
	 * @param event - The event object created by clicking.
	 */
	onClick?(event: PointerEvent): void {
		// do nothing
	}

	/**
	 * Called every time the user moves to mouse.
	 *
	 * @param event - The event object created by moving the mouse.
	 */
	onMouseMove?(event: PointerEvent): void {
		// do nothing
	}

	/**
	 * Called every time the user presses the left mouse button.
	 *
	 * @param event - The event object created by pressing the left mouse button down
	 */
	onMouseDown?(event: MouseEvent): void {
		// do nothing
	}

	/**
	 * Called every time the user releasing the left mouse button.
	 *
	 * @param event - The event object created by releasing the left mouse button.
	 */
	onMouseUp?(event: MouseEvent): void {
		// do nothing
	}

	/**
	 * Called every time the mouse leaves the application canvas.
	 *
	 * @param event - The event object created when the mouse leaves the application canvas.
	 */
	onMouseLeave?(event: MouseEvent): void {
		// do nothing
	}

	/**
	 * Called every time the user used the mouse wheele.
	 *
	 * @param event - The event object created when the user moves the mouse wheele.
	 */
	onWheel?(event: WheelEvent): void {
		// do nothing
	}
}

export { App };
