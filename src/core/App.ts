import type { Camera, Scene, WebGLRenderer } from "three";
import type { FolderApi } from "tweakpane";

/** Context handed to an app when it becomes active. */
export interface AppContext {
	renderer: WebGLRenderer;
	width: number;
	height: number;
}

/**
 * Base class every playground app extends. Each app owns its own `scene` and
 * `camera` and implements only the lifecycle hooks it needs. Controls are
 * declared by binding an app's `params` object to a Tweakpane folder inside
 * {@link App.setupControls}.
 */
export abstract class App {
	/** Human-readable name shown in the app selector. */
	abstract readonly name: string;

	/** Short description shown under the title while the app is active. */
	readonly description: string = "";

	scene!: Scene;
	camera!: Camera;

	/** Called once when the app becomes active. Build the scene here. */
	setup(_ctx: AppContext): void {}

	/** Called every frame. `dt` is seconds since the last frame. */
	update(_dt: number, _elapsed: number): void {}

	/** Called on viewport resize. Update cameras / render targets here. */
	resize(_width: number, _height: number): void {}

	/**
	 * Renders the app for one frame. Override to use a custom pipeline (e.g. an
	 * EffectComposer for post-processing); the default renders scene + camera.
	 */
	render(renderer: WebGLRenderer): void {
		renderer.render(this.scene, this.camera);
	}

	/** Bind this app's `params` to the given Tweakpane folder. */
	setupControls(_folder: FolderApi): void {}

	/** Called once when the app is torn down. Dispose GPU resources here. */
	dispose(): void {}

	// Optional pointer / wheel handlers. The orchestrator invokes these with
	// optional chaining, so an app that omits them can never crash.
	onPointerDown?(event: PointerEvent): void;
	onPointerMove?(event: PointerEvent): void;
	onPointerUp?(event: PointerEvent): void;
	onPointerLeave?(event: PointerEvent): void;
	onWheel?(event: WheelEvent): void;
}
