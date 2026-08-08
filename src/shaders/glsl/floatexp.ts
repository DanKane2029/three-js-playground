/**
 * Shared GLSL: floating-point numbers with an unbounded exponent.
 *
 * Perturbation solves the *mantissa* problem — it stops the renderer needing
 * hundreds of significant digits on the GPU. It does nothing for the *exponent*
 * problem. A float32 bottoms out at ~1.2e-38, so once the view's half-height
 * passes that, delta itself flushes to zero, every pixel gets the same value
 * and the image goes flat. That happens around 1e-30 in practice, well before
 * any precision runs out.
 *
 * Note that double-float (hi/lo pair) emulation does *not* help here: its high
 * component is still a float32, so it buys mantissa bits and leaves the
 * exponent range exactly where it was.
 *
 * The fix is to carry the exponent separately: a value is `m * 2^e` with the
 * mantissa held in [0.5, 1) and the exponent an ordinary float, free to run to
 * -100000 and beyond. Every operation has to renormalise, which is why this is
 * gated behind a depth threshold rather than used everywhere.
 *
 * Naive per-pixel rescaling is not a shortcut around this. Substituting
 * eps = S*u and delta = S*v into the perturbed recurrence gives
 * u' = 2*Z*u + S*u^2 + v, and rebasing sets eps <- z with z of order 1, so
 * u = z/S and the S*u^2 term becomes O(1/S) — it overflows at exactly the
 * moment rebasing fires. Scaling and rebasing are incompatible.
 *
 * Injected into shader source with a template literal, e.g.
 * `fragmentShader: /* glsl *\/ \`${floatExpGLSL} ... \``.
 */
export const floatExpGLSL = /* glsl */ `
	struct FE { float m; float e; };

	/**
	 * Renormalises a raw (mantissa, exponent) pair so the mantissa lands back in
	 * [0.5, 1).
	 *
	 * frexp would do this split in one instruction, but it is GLSL ES 3.10 and
	 * WebGL2 only guarantees 3.00, so this pays for a log2 and an exp2 instead.
	 * The +1 puts the result in [0.5, 1) rather than [1, 2): for m = 0.75,
	 * floor(log2 m) = -1, so k = 0 and the mantissa is unchanged; for m = 1.5,
	 * k = 1 and it becomes 0.75.
	 */
	FE feNorm(float m, float e) {
		if (m == 0.0) return FE(0.0, 0.0);
		float k = floor(log2(abs(m))) + 1.0;
		return FE(m * exp2(-k), e + k);
	}

	FE feFromFloat(float x) { return feNorm(x, 0.0); }

	/** Only safe once the value is known to sit inside the float32 range. */
	float feToFloat(FE a) { return a.m * exp2(a.e); }

	FE feNeg(FE a) { return FE(-a.m, a.e); }

	/**
	 * Sum. The operands are aligned to the larger exponent; past ~30 bits of
	 * separation the smaller one cannot affect a float32 mantissa at all, so it
	 * is dropped rather than shifted into oblivion.
	 */
	FE feAdd(FE a, FE b) {
		if (a.m == 0.0) return b;
		if (b.m == 0.0) return a;
		float d = a.e - b.e;
		if (d > 30.0) return a;
		if (d < -30.0) return b;
		if (d >= 0.0) return feNorm(a.m + b.m * exp2(-d), a.e);
		return feNorm(b.m + a.m * exp2(d), b.e);
	}

	FE feSub(FE a, FE b) { return feAdd(a, feNeg(b)); }

	/**
	 * Product. Both mantissas are in [0.5, 1), so the result is in [0.25, 1)
	 * and renormalising shifts by at most one bit.
	 */
	FE feMul(FE a, FE b) { return feNorm(a.m * b.m, a.e + b.e); }

	/** Ordering for non-negative values, which is all the caller compares. */
	bool feLess(FE a, FE b) {
		if (a.m == 0.0) return b.m != 0.0;
		if (b.m == 0.0) return false;
		if (a.e != b.e) return a.e < b.e;
		return a.m < b.m;
	}

	bool feGreater(FE a, FE b) { return feLess(b, a); }
`;
