/**
 * Arbitrary-precision binary fixed-point reals, built on native `BigInt`.
 *
 * Deep zooming into the Mandelbrot set needs coordinates carrying hundreds of
 * significant bits — far past the ~53 a double provides. Fixed-point rather
 * than floating bignum is the right shape here because the only values that
 * need this treatment (the view centre and the reference orbit) are all bounded
 * by the escape radius. With no exponent to track, a multiply is one `BigInt`
 * multiply and a shift.
 *
 * A value is `v / 2^frac`. Binary operations assume both operands share the
 * same `frac`; use {@link rescale} to line them up if they do not.
 */
export interface BigFixed {
	/** The value scaled by `2^frac`. */
	readonly v: bigint;
	/** Fractional bits of precision. */
	readonly frac: number;
}

/** Guard bits carried above what the zoom depth strictly requires. */
export const GUARD_BITS = 64;

export const zero = (frac: number): BigFixed => ({ v: 0n, frac });

/**
 * Precision needed to resolve detail at a given depth, where `log2Scale` is the
 * base-2 log of the view's half-height. The depth itself consumes `-log2Scale`
 * bits before a single significant digit is left over, hence the guard.
 */
export function fracBitsForDepth(log2Scale: number): number {
	return Math.max(64, Math.ceil(-log2Scale) + GUARD_BITS);
}

/**
 * Converts a double to fixed-point. Decomposes into an exact `m * 2^e` first;
 * the direct `BigInt(x * 2 ** frac)` route overflows for `frac > 1023` and
 * rounds badly well before that.
 */
export function fromNumber(x: number, frac: number): BigFixed {
	if (!Number.isFinite(x) || x === 0) return zero(frac);

	const neg = x < 0;
	let a = Math.abs(x);
	let e = 0;
	// Normalise the mantissa into [2^52, 2^53) so it is an exact integer.
	while (a < 2 ** 52) {
		a *= 2;
		e--;
	}
	while (a >= 2 ** 53) {
		a /= 2;
		e++;
	}

	const m = BigInt(Math.round(a));
	const s = e + frac;
	const v = s >= 0 ? m << BigInt(s) : m >> BigInt(-s);
	return { v: neg ? -v : v, frac };
}

/**
 * Converts to the nearest double. Keeps only the top ~53 significant bits
 * before handing off to `Number`, so it stays O(1) rather than paying for a
 * full big-integer decimal conversion — this runs once per reference-orbit
 * iteration, of which there can be millions.
 *
 * Values far below the double range flush to zero, which is correct: callers
 * that need sub-1e-308 magnitudes must stay in fixed-point or use an explicit
 * mantissa/exponent split.
 */
export function toNumber(a: BigFixed): number {
	if (a.v === 0n) return 0;
	if (a.frac <= 53) return Number(a.v) / 2 ** a.frac;

	// v >> (frac - 53) approximates v / 2^(frac-53), so the value is that over
	// 2^53. Number() of a BigInt wider than 53 bits rounds to nearest, which is
	// exactly the approximation wanted here.
	const top = Number(a.v >> BigInt(a.frac - 53));
	return top * 2 ** -53;
}

/**
 * Widens the narrower operand so both share a scale.
 *
 * Mismatches are easy to create by accident: the view deepens, its precision
 * grows, and any value captured beforehand is now at a different scale. Left
 * unaligned, `a.v - b.v` would subtract quantities in different units and
 * return a plausible-looking wrong answer rather than failing. The comparison
 * costs nothing next to the BigInt multiply it guards.
 */
function align(a: BigFixed, b: BigFixed): [BigFixed, BigFixed, number] {
	if (a.frac === b.frac) return [a, b, a.frac];
	const frac = Math.max(a.frac, b.frac);
	return [rescale(a, frac), rescale(b, frac), frac];
}

export function add(a: BigFixed, b: BigFixed): BigFixed {
	const [x, y, frac] = align(a, b);
	return { v: x.v + y.v, frac };
}

export function sub(a: BigFixed, b: BigFixed): BigFixed {
	const [x, y, frac] = align(a, b);
	return { v: x.v - y.v, frac };
}

export const neg = (a: BigFixed): BigFixed => ({ v: -a.v, frac: a.frac });

/**
 * Product, truncated back to `frac` bits. `>>` on a negative BigInt floors
 * rather than truncating toward zero, biasing results by at most one ulp
 * downward — irrelevant against the guard bits.
 */
export function mul(a: BigFixed, b: BigFixed): BigFixed {
	const [x, y, frac] = align(a, b);
	return { v: (x.v * y.v) >> BigInt(frac), frac };
}

/** Multiply by a power of two. Exact in both directions. */
export const shl = (a: BigFixed, bits: number): BigFixed => ({
	v: bits >= 0 ? a.v << BigInt(bits) : a.v >> BigInt(-bits),
	frac: a.frac,
});

/** Reinterpret at a different precision. Widening is exact. */
export function rescale(a: BigFixed, frac: number): BigFixed {
	if (frac === a.frac) return a;
	const d = frac - a.frac;
	return { v: d >= 0 ? a.v << BigInt(d) : a.v >> BigInt(-d), frac };
}

/**
 * Parses a decimal string such as "-0.743643887037158704752191506114774".
 * Deep coordinates are published in decimal and cannot survive a round trip
 * through a double, so they have to be read straight into fixed-point.
 */
export function fromDecimalString(s: string, frac: number): BigFixed {
	const t = s.trim();
	const neg = t.startsWith("-");
	const body = t.replace(/^[+-]/, "");
	const [intPart = "0", fracPart = ""] = body.split(".");

	if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart))
		throw new Error(`Not a decimal number: ${s}`);

	const digits = BigInt((intPart || "0") + fracPart);
	const denom = 10n ** BigInt(fracPart.length);
	// Round to nearest rather than truncating, so the last digit is honoured.
	const scaled = (digits << BigInt(frac)) + denom / 2n;
	const v = scaled / denom;
	return { v: neg ? -v : v, frac };
}
