import { Clock, SRGBColorSpace, WebGLRenderer } from "three";
import { Pane } from "tweakpane";
import type { FolderApi } from "tweakpane";
import type { App, AppContext } from "./App";

/**
 * Owns the renderer, the render loop, the Tweakpane panel, resize handling and
 * pointer routing, and switches between the registered apps.
 */
export class Playground {
	private readonly renderer: WebGLRenderer;
	private readonly pane: Pane;
	private readonly clock = new Clock();
	private readonly apps: App[];
	private readonly selector: { app: string };

	private current!: App;
	private appFolder: FolderApi | null = null;
	private readonly taglineEl: HTMLElement | null;

	constructor(canvas: HTMLCanvasElement, apps: App[]) {
		if (apps.length === 0)
			throw new Error("Playground needs at least one app");
		this.apps = apps;

		this.renderer = new WebGLRenderer({ canvas, antialias: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.outputColorSpace = SRGBColorSpace;

		this.pane = new Pane({
			container: document.getElementById("ui") ?? undefined,
			title: "Controls",
		});
		this.taglineEl = document.getElementById("app-tagline");

		this.selector = { app: apps[0].name };
		this.pane
			.addBinding(this.selector, "app", {
				label: "App",
				options: Object.fromEntries(apps.map((a) => [a.name, a.name])),
			})
			.on("change", (ev) => {
				const next = this.apps.find((a) => a.name === ev.value);
				if (next && next !== this.current) this.switchApp(next);
			});

		this.bindEvents(canvas);
		this.loadApp(apps[0]);
		this.resize();
		this.renderer.setAnimationLoop(this.frame);
	}

	private get size(): { width: number; height: number } {
		return { width: window.innerWidth, height: window.innerHeight };
	}

	private loadApp(app: App): void {
		const { width, height } = this.size;
		const ctx: AppContext = { renderer: this.renderer, width, height };
		this.current = app;
		app.setup(ctx);
		app.resize(width, height);

		this.appFolder?.dispose();
		this.appFolder = this.pane.addFolder({ title: app.name });
		app.setupControls(this.appFolder);

		if (this.taglineEl) this.taglineEl.textContent = app.description;
	}

	private switchApp(next: App): void {
		this.current.dispose();
		this.loadApp(next);
	}

	private frame = (): void => {
		const dt = this.clock.getDelta();
		this.current.update(dt, this.clock.elapsedTime);
		this.current.render(this.renderer);
	};

	private resize = (): void => {
		const { width, height } = this.size;
		this.renderer.setSize(width, height);
		this.current.resize(width, height);
	};

	private bindEvents(canvas: HTMLCanvasElement): void {
		window.addEventListener("resize", this.resize);

		canvas.addEventListener("pointerdown", (e) =>
			this.current.onPointerDown?.(e)
		);
		canvas.addEventListener("pointermove", (e) =>
			this.current.onPointerMove?.(e)
		);
		canvas.addEventListener("pointerup", (e) =>
			this.current.onPointerUp?.(e)
		);
		canvas.addEventListener("pointerleave", (e) =>
			this.current.onPointerLeave?.(e)
		);
		canvas.addEventListener(
			"wheel",
			(e) => {
				if (this.current.onWheel) {
					e.preventDefault();
					this.current.onWheel(e);
				}
			},
			{ passive: false }
		);
	}
}
