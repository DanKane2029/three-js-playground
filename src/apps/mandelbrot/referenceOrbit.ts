import type { BigFixed } from "../../core/bigFixed";
import { add, mul, shl, sub, toNumber } from "../../core/bigFixed";

/**
 * A high-precision orbit, sampled down to floats for the GPU.
 *
 * `points` holds interleaved (Zx, Zy) with **Z_0 = 0 at index 0**, so index `m`
 * is the value after `m` iterations. The perturbed loop in the shader relies on
 * that offset: it reads Z_m to advance epsilon, then reads Z_{m+1} to form the
 * full z. Storing Z_1 first would shift every fetch by one and quietly corrupt
 * the whole image.
 */
export interface ReferenceOrbit {
	/** Interleaved (Zx, Zy), `2 * length` entries. */
	readonly points: Float32Array;
	/** Number of stored points, i.e. the highest valid index plus one. */
	readonly length: number;
	/** Whether the reference itself escaped rather than hitting the cap. */
	readonly escaped: boolean;
}

export interface OrbitRequest {
	readonly re: BigFixed;
	readonly im: BigFixed;
	readonly maxIterations: number;
	readonly bailout: number;
}

/**
 * Iterates Z -> Z^2 + C at full precision, recording each Z as a pair of
 * float32s.
 *
 * float32 storage is deliberate. Z is O(1) in magnitude and the perturbed
 * iteration only needs it to float32 *relative* accuracy — all the significant
 * digits that make deep zoom work live in C, which is consumed here and never
 * shipped to the GPU. Storing doubles would double the texture for no gain in
 * the regime this targets.
 */
export function computeReferenceOrbit(req: OrbitRequest): ReferenceOrbit {
	const { re, im, maxIterations, bailout } = req;
	const frac = re.frac;
	const cap = Math.max(2, maxIterations + 1);
	const points = new Float32Array(cap * 2);

	let zr: BigFixed = { v: 0n, frac };
	let zi: BigFixed = { v: 0n, frac };

	// Index 0 is Z_0 = 0, already zeroed by the Float32Array constructor.
	let length = 1;
	let escaped = false;
	const bail2 = bailout * bailout;

	while (length < cap) {
		// (a + bi)^2 = a^2 - b^2 + 2ab i
		const r2 = mul(zr, zr);
		const i2 = mul(zi, zi);
		const nextR = add(sub(r2, i2), re);
		const nextI = add(shl(mul(zr, zi), 1), im);
		zr = nextR;
		zi = nextI;

		const fr = toNumber(zr);
		const fi = toNumber(zi);
		points[length * 2] = fr;
		points[length * 2 + 1] = fi;
		length++;

		if (fr * fr + fi * fi > bail2) {
			escaped = true;
			break;
		}
	}

	return { points: points.subarray(0, length * 2), length, escaped };
}
