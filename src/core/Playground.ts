import { Clock, SRGBColorSpace, WebGLRenderer } from "three";
import { Pane } from "tweakpane";
import type { FolderApi } from "tweakpane";
import type { App, AppContext, AppModule } from "./App";

const REPO_URL = "https://github.com/DanKane2029/three-js-playground";

/** URL-safe slug for an app name, e.g. "Planet Generator" -> "planet-generator". */
const slugify = (name: string): string =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

/** GitHub link to an app's educational write-up in docs/apps/<slug>/. */
const docsUrl = (name: string): string =>
	`${REPO_URL}/blob/main/docs/apps/${slugify(name)}/README.md`;

/**
 * Owns the renderer, the render loop, the Tweakpane panel, resize handling and
 * pointer routing, and switches between the registered apps.
 *
 * Apps are loaded lazily (via each {@link AppModule}'s `load`), so only the
 * active app's code is downloaded. Loaded instances are cached and reused. The
 * active app is mirrored in the URL hash (e.g. `#ocean`) for direct linking.
 */
export class Playground {
	private readonly renderer: WebGLRenderer;
	private readonly pane: Pane;
	private readonly clock = new Clock();
	private readonly apps: AppModule[];
	private readonly selector: { app: string };
	private readonly appBinding: { refresh(): void };
	private readonly instances = new Map<string, App>();

	private current?: App;
	private appFolder: FolderApi | null = null;
	private readonly taglineEl: HTMLElement | null;

	/** Increments on every switch so a slow load that lost the race is ignored. */
	private loadToken = 0;

	constructor(canvas: HTMLCanvasElement, apps: AppModule[]) {
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
				if (next && next.name !== this.current?.name)
					void this.switchApp(next);
			});

		this.bindEvents(canvas);
		this.renderer.setAnimationLoop(this.frame);
		void this.boot(initial);
	}

	private get size(): { width: number; height: number } {
		return { width: window.innerWidth, height: window.innerHeight };
	}

	private async boot(initial: AppModule): Promise<void> {
		await this.switchApp(initial, true);
		window.addEventListener("hashchange", this.onHashChange);
		this.resize();
	}

	/** Find the app whose slug matches a `#slug` hash, if any. */
	private appForHash(hash: string): AppModule | undefined {
		const slug = hash.replace(/^#/, "");
		if (!slug) return undefined;
		return this.apps.find((a) => slugify(a.name) === slug);
	}

	/** Import (once) and instantiate an app, caching the instance. */
	private async resolve(entry: AppModule): Promise<App> {
		let inst = this.instances.get(entry.name);
		if (!inst) {
			inst = await entry.load();
			if (inst.name !== entry.name)
				console.warn(
					`App name mismatch: registry "${entry.name}" vs class "${inst.name}"`
				);
			this.instances.set(entry.name, inst);
		}
		return inst;
	}

	private async switchApp(entry: AppModule, replaceHash = false): Promise<void> {
		const token = ++this.loadToken;
		this.setStatus(`Loading ${entry.name}…`);

		let instance: App;
		try {
			instance = await this.resolve(entry);
		} catch (err) {
			console.error(`Failed to load app "${entry.name}"`, err);
			this.setStatus(`Failed to load ${entry.name}`);
			return;
		}
		// A newer switch started while we were importing — drop this result.
		if (token !== this.loadToken) return;

		this.current?.dispose();
		this.mount(instance);
		this.syncSelection(entry, replaceHash);
	}

	/** Set up an already-instantiated app and (re)build its control folder. */
	private mount(app: App): void {
		const { width, height } = this.size;
		const ctx: AppContext = { renderer: this.renderer, width, height };
		app.setup(ctx);
		app.resize(width, height);
		this.current = app;

		this.appFolder?.dispose();
		this.appFolder = this.pane.addFolder({ title: app.name });
		this.appFolder
			.addButton({ title: "📖 Read the docs" })
			.on("click", () =>
				window.open(docsUrl(app.name), "_blank", "noopener,noreferrer")
			);
		app.setupControls(this.appFolder);

		if (this.taglineEl) this.taglineEl.textContent = app.description;
	}

	/** Keep the dropdown and the URL hash in sync with the active app. */
	private syncSelection(entry: AppModule, replaceHash: boolean): void {
		this.selector.app = entry.name;
		this.appBinding.refresh();
		const slug = slugify(entry.name);
		if (window.location.hash.replace(/^#/, "") !== slug) {
			if (replaceHash)
				window.history.replaceState(null, "", `#${slug}`);
			else window.location.hash = slug;
		}
	}

	private setStatus(text: string): void {
		if (this.taglineEl) this.taglineEl.textContent = text;
	}

	/** React to back/forward navigation or a manually edited `#slug`. */
	private onHashChange = (): void => {
		const next = this.appForHash(window.location.hash);
		if (next && next.name !== this.current?.name) void this.switchApp(next);
	};

	private frame = (): void => {
		if (!this.current) return;
		const dt = this.clock.getDelta();
		this.current.update(dt, this.clock.elapsedTime);
		this.current.render(this.renderer);
	};

	private resize = (): void => {
		const { width, height } = this.size;
		this.renderer.setSize(width, height);
		this.current?.resize(width, height);
	};

	private bindEvents(canvas: HTMLCanvasElement): void {
		window.addEventListener("resize", this.resize);

		canvas.addEventListener("pointerdown", (e) =>
			this.current?.onPointerDown?.(e)
		);
		canvas.addEventListener("pointermove", (e) =>
			this.current?.onPointerMove?.(e)
		);
		canvas.addEventListener("pointerup", (e) =>
			this.current?.onPointerUp?.(e)
		);
		canvas.addEventListener("pointerleave", (e) =>
			this.current?.onPointerLeave?.(e)
		);
		canvas.addEventListener(
			"wheel",
			(e) => {
				if (this.current?.onWheel) {
					e.preventDefault();
					this.current.onWheel(e);
				}
			},
			{ passive: false }
		);
	}
}
