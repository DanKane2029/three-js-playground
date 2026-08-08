import type { BigFixed } from "../../core/bigFixed";
import {
	add,
	fracBitsForDepth,
	fromDecimalString,
	fromNumber,
	mul,
	rescale,
	shl,
	sub,
	toNumber,
} from "../../core/bigFixed";

/**
 * The view onto the complex plane: an arbitrary-precision centre plus a scale.
 *
 * Two representation choices carry the whole design:
 *
 * - The centre is fixed-point, not a double. It is the coordinate that needs
 *   hundreds of significant digits; everything else is a small offset from it.
 *
 * - The scale is stored as **log2 of the half-height**, not the half-height
 *   itself. A double bottoms out at ~5e-324, so a linear scale would cap the
 *   zoom at around 320 decades no matter how precise the centre was. As a log
 *   it is just a small negative number, and depth is unbounded.
 */
export class DeepView {
	private re: BigFixed;
	private im: BigFixed;
	/** Base-2 log of the view's half-height in complex-plane units. */
	private log2Scale: number;

	constructor(re: string, im: string, log2Scale: number) {
		const frac = fracBitsForDepth(log2Scale);
		this.re = fromDecimalString(re, frac);
		this.im = fromDecimalString(im, frac);
		this.log2Scale = log2Scale;
	}

	/** Working precision, in fractional bits. */
	get frac(): number {
		return this.re.frac;
	}

	get depthLog2(): number {
		return this.log2Scale;
	}

	/** Depth expressed as decimal decades below the initial view. */
	get depthDecades(): number {
		return -this.log2Scale * Math.LOG10E * Math.LN2;
	}

	get centerRe(): BigFixed {
		return this.re;
	}

	get centerIm(): BigFixed {
		return this.im;
	}

	/** Integer part of the log scale; the exponent in `scale = mantissa * 2^exp`. */
	get scaleExp(): number {
		return Math.floor(this.log2Scale);
	}

	/** Fractional part as a mantissa in [1, 2). */
	get scaleMantissa(): number {
		return 2 ** (this.log2Scale - this.scaleExp);
	}

	/**
	 * The half-height as a plain double. Flushes to zero below ~1e-308, so this
	 * is only safe for the float uniform path and for display; the fixed-point
	 * routines below never go through it.
	 */
	get scaleAsNumber(): number {
		return this.scaleMantissa * 2 ** this.scaleExp;
	}

	/**
	 * Multiplies an O(1) double by the view scale, in fixed-point. Going via
	 * `scaleAsNumber` would underflow past ~1e-308; splitting off the power of
	 * two and applying it as an exact bit shift has no such limit.
	 */
	private scaled(t: number): BigFixed {
		return shl(
			fromNumber(t * this.scaleMantissa, this.frac),
			this.scaleExp
		);
	}

	/**
	 * The complex point under a pixel. Mirrors the fragment shader's mapping:
	 * normalised coordinates span -1..1 vertically, stretch by the aspect ratio
	 * horizontally, and flip in y because screen y grows downward.
	 */
	complexAt(
		px: number,
		py: number,
		width: number,
		height: number
	): { re: BigFixed; im: BigFixed } {
		return {
			re: add(this.re, this.scaled((2 * px - width) / height)),
			im: add(this.im, this.scaled((height - 2 * py) / height)),
		};
	}

	/**
	 * Pan by a pixel delta. Both axes divide by height: the horizontal term
	 * picks up an aspect factor of width/height that cancels its own /width.
	 */
	panByPixels(dx: number, dy: number, height: number): void {
		this.re = add(this.re, this.scaled((-2 * dx) / height));
		this.im = add(this.im, this.scaled((2 * dy) / height));
	}

	/**
	 * Scale by `k` about a pixel, holding the complex point under it fixed.
	 * Zooming about the viewport centre would make deep navigation impossible:
	 * past a few dozen decades the target drifts off screen long before arrival.
	 */
	zoomAt(
		px: number,
		py: number,
		width: number,
		height: number,
		k: number
	): void {
		const target = this.complexAt(px, py, width, height);
		const kf = fromNumber(k, this.frac);
		this.re = add(target.re, mul(sub(this.re, target.re), kf));
		this.im = add(target.im, mul(sub(this.im, target.im), kf));
		this.log2Scale += Math.log2(k);
		this.ensurePrecision();
	}

	/**
	 * Widen the fixed-point precision to match the current depth. Only ever
	 * grows: narrowing on zoom-out would discard digits that a subsequent zoom
	 * back in would need.
	 */
	private ensurePrecision(): void {
		const want = fracBitsForDepth(this.log2Scale);
		if (want <= this.frac) return;
		this.re = rescale(this.re, want);
		this.im = rescale(this.im, want);
	}

	/**
	 * Displacement from a reference point to this view's centre, measured in
	 * units of the view's half-height.
	 *
	 * The ratio is what makes this safe: the raw displacement is on the order of
	 * the scale itself and would flush to zero as a double long before the zoom
	 * runs out, whereas the ratio stays O(1) at any depth. Dividing out the
	 * scale as an exact bit shift keeps it that way.
	 */
	offsetInScreenUnits(re: BigFixed, im: BigFixed): { x: number; y: number } {
		const norm = (d: BigFixed): number =>
			toNumber(shl(d, -this.scaleExp)) / this.scaleMantissa;
		return {
			x: norm(sub(this.re, re)),
			y: norm(sub(this.im, im)),
		};
	}

	/** Centre as doubles. For display only — meaningless past ~15 decades. */
	centerAsNumbers(): { re: number; im: number } {
		return { re: toNumber(this.re), im: toNumber(this.im) };
	}
}
