import {
	ClampToEdgeWrapping,
	HalfFloatType,
	LinearFilter,
	Mesh,
	NoBlending,
	OrthographicCamera,
	PlaneGeometry,
	RGBAFormat,
	Scene,
	ShaderMaterial,
	Vector2,
	WebGLRenderTarget,
} from "three";
import type { IUniform, WebGLRenderer } from "three";
import type { FolderApi } from "tweakpane";
import type { AppContext } from "../core/App";
import { App } from "../core/App";
import {
	advectionFrag,
	baseVertex,
	clearFrag,
	curlFrag,
	displayFrag,
	divergenceFrag,
	gradientSubtractFrag,
	pressureFrag,
	splatFrag,
	vorticityFrag,
} from "../shaders/fluidShaders";

const SIM_RESOLUTION = 128;
const DYE_RESOLUTION = 512;
const SPLAT_FORCE = 6000;

interface DoubleFBO {
	read: WebGLRenderTarget;
	write: WebGLRenderTarget;
	swap(): void;
}

interface Pointer {
	x: number;
	y: number;
	prevX: number;
	prevY: number;
	dx: number;
	dy: number;
	moved: boolean;
	color: [number, number, number];
}

/** A real-time GPU fluid simulation (grid-based Navier-Stokes). */
export class FluidSim extends App {
	readonly name = "Fluid";
	readonly description =
		"A real-time GPU fluid simulation — drag to stir dye through the flow.";

	private readonly params = {
		curl: 30,
		velocityFade: 0.2,
		dyeFade: 1.0,
		pressureIterations: 20,
		splatRadius: 0.25,
	};

	private renderer!: WebGLRenderer;
	private geometry!: PlaneGeometry;
	private quad!: Mesh;

	private velocity!: DoubleFBO;
	private dye!: DoubleFBO;
	private pressure!: DoubleFBO;
	private divergence!: WebGLRenderTarget;
	private curl!: WebGLRenderTarget;

	private readonly simTexel = new Vector2(
		1 / SIM_RESOLUTION,
		1 / SIM_RESOLUTION
	);
	private width = 1;
	private height = 1;
	private idleTime = 0;
	private autoTimer = 0;

	private mAdvection!: ShaderMaterial;
	private mDivergence!: ShaderMaterial;
	private mCurl!: ShaderMaterial;
	private mVorticity!: ShaderMaterial;
	private mPressure!: ShaderMaterial;
	private mGradient!: ShaderMaterial;
	private mSplat!: ShaderMaterial;
	private mClear!: ShaderMaterial;
	private mDisplay!: ShaderMaterial;

	private readonly pointer: Pointer = {
		x: 0.5,
		y: 0.5,
		prevX: 0.5,
		prevY: 0.5,
		dx: 0,
		dy: 0,
		moved: false,
		color: [0.15, 0.08, 0.2],
	};

	constructor() {
		super();
		this.scene = new Scene();
		this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
	}

	setup(ctx: AppContext): void {
		this.renderer = ctx.renderer;
		this.width = ctx.width;
		this.height = ctx.height;

		this.geometry = new PlaneGeometry(2, 2);
		this.mDisplay = this.createMaterial(displayFrag, {
			uTexture: { value: null },
		});
		this.quad = new Mesh(this.geometry, this.mDisplay);
		this.quad.frustumCulled = false;
		this.scene.add(this.quad);

		this.mAdvection = this.createMaterial(advectionFrag, {
			uVelocity: { value: null },
			uSource: { value: null },
			dt: { value: 0 },
			dissipation: { value: 0 },
		});
		this.mDivergence = this.createMaterial(divergenceFrag, {
			uVelocity: { value: null },
		});
		this.mCurl = this.createMaterial(curlFrag, {
			uVelocity: { value: null },
		});
		this.mVorticity = this.createMaterial(vorticityFrag, {
			uVelocity: { value: null },
			uCurl: { value: null },
			curl: { value: 0 },
			dt: { value: 0 },
		});
		this.mPressure = this.createMaterial(pressureFrag, {
			uPressure: { value: null },
			uDivergence: { value: null },
		});
		this.mGradient = this.createMaterial(gradientSubtractFrag, {
			uPressure: { value: null },
			uVelocity: { value: null },
		});
		this.mSplat = this.createMaterial(splatFrag, {
			uTarget: { value: null },
			aspectRatio: { value: 1 },
			color: { value: [0, 0, 0] },
			point: { value: new Vector2() },
			radius: { value: 0.0025 },
		});
		this.mClear = this.createMaterial(clearFrag, {
			uTexture: { value: null },
			value: { value: 0 },
		});

		this.initFramebuffers();
		this.seedSplats(6);
	}

	private createMaterial(
		fragmentShader: string,
		uniforms: Record<string, IUniform>
	): ShaderMaterial {
		return new ShaderMaterial({
			vertexShader: baseVertex,
			fragmentShader,
			uniforms: { uTexelSize: { value: this.simTexel }, ...uniforms },
			depthTest: false,
			depthWrite: false,
			blending: NoBlending,
		});
	}

	private createFBO(w: number, h: number): WebGLRenderTarget {
		return new WebGLRenderTarget(w, h, {
			type: HalfFloatType,
			format: RGBAFormat,
			minFilter: LinearFilter,
			magFilter: LinearFilter,
			wrapS: ClampToEdgeWrapping,
			wrapT: ClampToEdgeWrapping,
			depthBuffer: false,
			stencilBuffer: false,
		});
	}

	private createDoubleFBO(w: number, h: number): DoubleFBO {
		const fbo: DoubleFBO = {
			read: this.createFBO(w, h),
			write: this.createFBO(w, h),
			swap() {
				const tmp = this.read;
				this.read = this.write;
				this.write = tmp;
			},
		};
		return fbo;
	}

	private resolution(res: number): { w: number; h: number } {
		let aspect = this.width / this.height;
		if (aspect < 1) aspect = 1 / aspect;
		const min = Math.round(res);
		const max = Math.round(res * aspect);
		return this.width > this.height
			? { w: max, h: min }
			: { w: min, h: max };
	}

	private initFramebuffers(): void {
		this.disposeFramebuffers();
		const sim = this.resolution(SIM_RESOLUTION);
		const dye = this.resolution(DYE_RESOLUTION);
		this.simTexel.set(1 / sim.w, 1 / sim.h);

		this.velocity = this.createDoubleFBO(sim.w, sim.h);
		this.pressure = this.createDoubleFBO(sim.w, sim.h);
		this.divergence = this.createFBO(sim.w, sim.h);
		this.curl = this.createFBO(sim.w, sim.h);
		this.dye = this.createDoubleFBO(dye.w, dye.h);
	}

	private disposeFramebuffers(): void {
		for (const fbo of [this.velocity, this.pressure, this.dye]) {
			fbo?.read.dispose();
			fbo?.write.dispose();
		}
		this.divergence?.dispose();
		this.curl?.dispose();
	}

	private blit(
		material: ShaderMaterial,
		target: WebGLRenderTarget | null
	): void {
		this.quad.material = material;
		this.renderer.setRenderTarget(target);
		this.renderer.render(this.scene, this.camera);
	}

	resize(width: number, height: number): void {
		this.width = width;
		this.height = height;
		this.initFramebuffers();
		this.seedSplats(6);
	}

	update(dt: number): void {
		const step = Math.min(dt, 0.016666) || 0.016666;

		if (this.pointer.moved) {
			this.applySplat(
				this.pointer.x,
				this.pointer.y,
				this.pointer.dx * SPLAT_FORCE,
				this.pointer.dy * SPLAT_FORCE,
				this.pointer.color
			);
			this.pointer.moved = false;
			this.idleTime = 0;
		} else {
			// When left alone, drip in occasional splats so the sim stays alive.
			this.idleTime += step;
			if (this.idleTime > 1.5) {
				this.autoTimer += step;
				if (this.autoTimer > 0.5) {
					this.autoTimer = 0;
					this.seedSplats(1);
				}
			}
		}

		// Vorticity confinement.
		this.mCurl.uniforms.uVelocity.value = this.velocity.read.texture;
		this.blit(this.mCurl, this.curl);

		this.mVorticity.uniforms.uVelocity.value = this.velocity.read.texture;
		this.mVorticity.uniforms.uCurl.value = this.curl.texture;
		this.mVorticity.uniforms.curl.value = this.params.curl;
		this.mVorticity.uniforms.dt.value = step;
		this.blit(this.mVorticity, this.velocity.write);
		this.velocity.swap();

		// Make the velocity field divergence-free (pressure projection).
		this.mDivergence.uniforms.uVelocity.value = this.velocity.read.texture;
		this.blit(this.mDivergence, this.divergence);

		this.mClear.uniforms.uTexture.value = this.pressure.read.texture;
		this.mClear.uniforms.value.value = 0.8;
		this.blit(this.mClear, this.pressure.write);
		this.pressure.swap();

		this.mPressure.uniforms.uDivergence.value = this.divergence.texture;
		for (let i = 0; i < this.params.pressureIterations; i++) {
			this.mPressure.uniforms.uPressure.value =
				this.pressure.read.texture;
			this.blit(this.mPressure, this.pressure.write);
			this.pressure.swap();
		}

		this.mGradient.uniforms.uPressure.value = this.pressure.read.texture;
		this.mGradient.uniforms.uVelocity.value = this.velocity.read.texture;
		this.blit(this.mGradient, this.velocity.write);
		this.velocity.swap();

		// Advect velocity, then dye, through the (now divergence-free) field.
		this.mAdvection.uniforms.dt.value = step;
		this.mAdvection.uniforms.uVelocity.value = this.velocity.read.texture;
		this.mAdvection.uniforms.uSource.value = this.velocity.read.texture;
		this.mAdvection.uniforms.dissipation.value = this.params.velocityFade;
		this.blit(this.mAdvection, this.velocity.write);
		this.velocity.swap();

		this.mAdvection.uniforms.uVelocity.value = this.velocity.read.texture;
		this.mAdvection.uniforms.uSource.value = this.dye.read.texture;
		this.mAdvection.uniforms.dissipation.value = this.params.dyeFade;
		this.blit(this.mAdvection, this.dye.write);
		this.dye.swap();
	}

	render(renderer: WebGLRenderer): void {
		this.mDisplay.uniforms.uTexture.value = this.dye.read.texture;
		this.quad.material = this.mDisplay;
		renderer.setRenderTarget(null);
		renderer.render(this.scene, this.camera);
	}

	private applySplat(
		x: number,
		y: number,
		dx: number,
		dy: number,
		color: [number, number, number]
	): void {
		const radius = this.params.splatRadius / 100;
		this.mSplat.uniforms.aspectRatio.value = this.width / this.height;
		this.mSplat.uniforms.radius.value = radius;
		(this.mSplat.uniforms.point.value as Vector2).set(x, y);

		this.mSplat.uniforms.uTarget.value = this.velocity.read.texture;
		this.mSplat.uniforms.color.value = [dx, dy, 0];
		this.blit(this.mSplat, this.velocity.write);
		this.velocity.swap();

		this.mSplat.uniforms.uTarget.value = this.dye.read.texture;
		this.mSplat.uniforms.color.value = color;
		this.blit(this.mSplat, this.dye.write);
		this.dye.swap();
	}

	private seedSplats(count: number): void {
		for (let i = 0; i < count; i++) {
			const color = hsvColor(Math.random(), 1, 1, 0.25);
			this.applySplat(
				Math.random(),
				Math.random(),
				(Math.random() - 0.5) * 0.02 * SPLAT_FORCE,
				(Math.random() - 0.5) * 0.02 * SPLAT_FORCE,
				color
			);
		}
	}

	onPointerDown(event: PointerEvent): void {
		this.pointer.color = hsvColor(Math.random(), 1, 1, 0.25);
		this.pointer.x = event.clientX / this.width;
		this.pointer.y = 1 - event.clientY / this.height;
		this.pointer.prevX = this.pointer.x;
		this.pointer.prevY = this.pointer.y;
	}

	onPointerMove(event: PointerEvent): void {
		const x = event.clientX / this.width;
		const y = 1 - event.clientY / this.height;
		this.pointer.dx = x - this.pointer.prevX;
		this.pointer.dy = y - this.pointer.prevY;
		this.pointer.x = x;
		this.pointer.y = y;
		this.pointer.prevX = x;
		this.pointer.prevY = y;
		if (Math.abs(this.pointer.dx) > 0 || Math.abs(this.pointer.dy) > 0) {
			this.pointer.moved = true;
		}
	}

	setupControls(folder: FolderApi): void {
		folder.addBinding(this.params, "curl", { min: 0, max: 50, step: 1 });
		folder.addBinding(this.params, "velocityFade", {
			label: "velocity fade",
			min: 0,
			max: 4,
			step: 0.01,
		});
		folder.addBinding(this.params, "dyeFade", {
			label: "dye fade",
			min: 0,
			max: 4,
			step: 0.01,
		});
		folder.addBinding(this.params, "pressureIterations", {
			label: "pressure iters",
			min: 1,
			max: 50,
			step: 1,
		});
		folder.addBinding(this.params, "splatRadius", {
			label: "splat radius",
			min: 0.05,
			max: 1,
			step: 0.01,
		});
		folder
			.addButton({ title: "Splat" })
			.on("click", () => this.seedSplats(8));
		folder.addButton({ title: "Clear" }).on("click", () => this.clearDye());
	}

	private clearDye(): void {
		this.mClear.uniforms.uTexture.value = this.dye.read.texture;
		this.mClear.uniforms.value.value = 0;
		this.blit(this.mClear, this.dye.write);
		this.dye.swap();
	}

	dispose(): void {
		this.renderer.setRenderTarget(null);
		this.disposeFramebuffers();
		this.geometry.dispose();
		for (const m of [
			this.mAdvection,
			this.mDivergence,
			this.mCurl,
			this.mVorticity,
			this.mPressure,
			this.mGradient,
			this.mSplat,
			this.mClear,
			this.mDisplay,
		]) {
			m.dispose();
		}
		this.scene.clear();
	}
}

/** HSV → RGB, scaled by `intensity`, for vivid dye colors. */
function hsvColor(
	h: number,
	s: number,
	v: number,
	intensity: number
): [number, number, number] {
	const i = Math.floor(h * 6);
	const f = h * 6 - i;
	const p = v * (1 - s);
	const q = v * (1 - f * s);
	const t = v * (1 - (1 - f) * s);
	let r: number;
	let g: number;
	let b: number;
	switch (i % 6) {
		case 0:
			r = v;
			g = t;
			b = p;
			break;
		case 1:
			r = q;
			g = v;
			b = p;
			break;
		case 2:
			r = p;
			g = v;
			b = t;
			break;
		case 3:
			r = p;
			g = q;
			b = v;
			break;
		case 4:
			r = t;
			g = p;
			b = v;
			break;
		default:
			r = v;
			g = p;
			b = q;
			break;
	}
	return [r * intensity, g * intensity, b * intensity];
}
