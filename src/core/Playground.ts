import { Clock, SRGBColorSpace, WebGLRenderer } from "three";
import { Pane } from "tweakpane";
import type { FolderApi } from "tweakpane";
import type { App, AppContext } from "./App";

const REPO_URL = "https://github.com/DanKane2029/three-js-playground";

/** URL-safe slug for an app name, e.g. "Planet Generator" -> "planet-generator". */
const slugify = (name: string): string =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

/** GitHub link to an app's educational write-up in docs/apps/<slug>/. */
const docsUrl = (app: App): string =>
	`${REPO_URL}/blob/main/docs/apps/${slugify(app.name)}/README.md`;

/**
 * Owns the renderer, the render loop, the Tweakpane panel, resize handling and
 * pointer routing, and switches between the registered apps. The active app is
 * mirrored in the URL hash (e.g. `#ocean`) so it can be linked to directly.
 */
export class Playground {
	private readonly renderer: WebGLRenderer;
	private readonly pane: Pane;
	private readonly clock = new Clock();
	private readonly apps: App[];
	private readonly selector: { app: string };
	private readonly appBinding: { refresh(): void };

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

		// Honour a deep link like `#ocean`; otherwise start with the first app.
		const initial = this.appForHash(window.location.hash) ?? apps[0];

		this.selector = { app: initial.name };
		this.appBinding = this.pane
			.addBinding(this.selector, "app", {
				label: "App",
				options: Object.fromEntries(apps.map((a) => [a.name, a.name])),
			})
			.on("change", (ev) => {
				const next = this.apps.find((a) => a.name === ev.value);
				if (next && next !== this.current) this.switchApp(next);
			});

		this.bindEvents(canvas);
		this.loadApp(initial);

		// Reflect the initial app in the URL without adding a history entry.
		const slug = slugify(initial.name);
		if (window.location.hash.replace(/^#/, "") !== slug)
			window.history.replaceState(null, "", `#${slug}`);
		window.addEventListener("hashchange", this.onHashChange);

		this.resize();
		this.renderer.setAnimationLoop(this.frame);
	}

	private get size(): { width: number; height: number } {
		return { width: window.innerWidth, height: window.innerHeight };
	}

	/** Find the app whose slug matches a `#slug` hash, if any. */
	private appForHash(hash: string): App | undefined {
		const slug = hash.replace(/^#/, "");
		if (!slug) return undefined;
		return this.apps.find((a) => slugify(a.name) === slug);
	}

	private loadApp(app: App): void {
		const { width, height } = this.size;
		const ctx: AppContext = { renderer: this.renderer, width, height };
		this.current = app;
		app.setup(ctx);
		app.resize(width, height);

		this.appFolder?.dispose();
		this.appFolder = this.pane.addFolder({ title: app.name });

		// A link to this app's educational docs, above its controls.
		this.appFolder
			.addButton({ title: "📖 Read the docs" })
			.on("click", () =>
				window.open(docsUrl(app), "_blank", "noopener,noreferrer")
			);

		app.setupControls(this.appFolder);

		if (this.taglineEl) this.taglineEl.textContent = app.description;
	}

	private switchApp(next: App): void {
		this.current.dispose();
		this.loadApp(next);

		// Keep the dropdown and the URL in sync with the active app.
		this.selector.app = next.name;
		this.appBinding.refresh();
		const slug = slugify(next.name);
		if (window.location.hash.replace(/^#/, "") !== slug)
			window.location.hash = slug;
	}

	/** React to back/forward navigation or a manually edited `#slug`. */
	private onHashChange = (): void => {
		const next = this.appForHash(window.location.hash);
		if (next && next !== this.current) this.switchApp(next);
	};

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
