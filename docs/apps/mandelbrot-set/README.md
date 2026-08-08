# Mandelbrot Set

The most famous fractal, rendered live in a fragment shader. Every pixel is a
point in the complex plane; its color encodes how that point behaves under
repeated squaring. Drag to pan, scroll to zoom.

Source: [`src/apps/MandelbrotSet.ts`](../../../src/apps/MandelbrotSet.ts),
[`src/shaders/mandlebrotSetShader.ts`](../../../src/shaders/mandlebrotSetShader.ts)

## The definition

Treat each pixel as a complex number $c = x + iy$. Starting from $z_0 = 0$,
iterate:

$$
z_{n+1} = z_n^2 + c
$$

The **Mandelbrot set** is the set of $c$ for which this sequence stays bounded
forever. Points inside the set never escape; points outside race off to
infinity. The intricate boundary between them is the fractal.

Squaring a complex number expands in real components as:

$$
z^2 = (x + iy)^2 = (x^2 - y^2) + i\,(2xy)
$$

## The escape-time algorithm

We can't iterate forever, so we use two stopping rules:

1. **Escape.** Once $|z| > 2$ the point is guaranteed to diverge. We actually
   wait until $|z| > 256$, because the smooth-coloring estimate below is
   asymptotic in $|z|$ and a tight bailout leaves visible banding. We test
   $|z|^2$ to avoid a square root.
2. **Budget.** If we reach `maxIterations` without escaping, we treat the point
   as (probably) inside the set and paint it black.

The **number of iterations** to escape is the raw signal we color by: points
just outside the set take many iterations, points far away take very few.

## Smooth (continuous) coloring

Coloring by the integer iteration count produces ugly concentric **bands**,
because escape count jumps by whole numbers. The fix is to estimate a
*fractional* iteration count from how far past the escape radius $z$ landed:

$$
\nu = n - \log_2\!\left(\frac{\log |z_n|}{\log B}\right)
$$

where $B$ is the bailout radius. This is the *renormalized iteration count*
derived from the
[Douady–Hubbard potential](https://en.wikipedia.org/wiki/Mandelbrot_set#Continuous_.28smooth.29_coloring).
The normalization by $\log B$ is what makes it well behaved: at $|z| = B$ the
value is exactly $n$, and at $|z| = B^2$ — one iteration of overshoot — it is
exactly $n - 1$. So $\nu$ grows by precisely 1 between successive escapes, which
is what makes the gradient continuous.

It is only valid on the escape path. A point that ran out of budget can have
$|z| < 1$, making $\log|z|$ negative and $\log_2$ of it undefined, so the shader
branches before evaluating it.

The palette has seven stops — black, your five colors, then black again — and
**cycles**: the parameter wraps with `fract`, and because both ends are black
the cycle closes seamlessly. Cycling matters once you zoom, where escape counts
run into the thousands and a non-repeating ramp would saturate to one color.

## The precision problem

Here is the interesting part.

The naive shader computes $c$ per pixel and iterates it directly. That caps how
far you can zoom, and the cap arrives early. A 32-bit float carries about 7
significant decimal digits, so next to a coordinate of order 1 it resolves about
$10^{-7}$. Once the view is narrow enough that adjacent pixels differ by less
than that, they map to the *same* $c$, and the image dissolves into blocks — at
roughly $5 \times 10^4$ magnification, a few hundred scroll notches in.

There is no API escape hatch. WebGL2's GLSL ES 3.00 has no `double`, and WGSL
has no `f64` either. More mantissa bits on a GPU can only be *emulated*.

It helps to see that this is really **two** separate problems:

| Problem | Symptom | Fix |
| --- | --- | --- |
| **Mantissa** — not enough significant digits for $c$ | blocky pixels | perturbation |
| **Exponent** — $\delta$ itself underflows the float range | image goes flat | floatexp |

Emulating a wider mantissa with a hi/lo float pair ("double-float") addresses
only the first. Its high component is still a `float32`, so the exponent range
is exactly where it started. That is why this app skips that approach entirely.

## Perturbation

The trick is to stop representing $c$ at all.

Pick one **reference point** $C$ near the view and compute its orbit $Z_n$ on
the CPU at arbitrary precision. A nearby pixel is $c = C + \delta$, and its
orbit is $z_n = Z_n + \varepsilon_n$. Substituting and expanding, the squaring
telescopes:

$$
z_{n+1} = (Z_n + \varepsilon_n)^2 + C + \delta
        = \underbrace{Z_n^2 + C}_{Z_{n+1}} + 2 Z_n \varepsilon_n + \varepsilon_n^2 + \delta
$$

leaving a recurrence in the *difference* alone:

$$
\varepsilon_{n+1} = 2 Z_n \varepsilon_n + \varepsilon_n^2 + \delta
$$

$\delta$ and $\varepsilon$ are minuscule in absolute terms, but only their
leading handful of significant digits is ever needed — all the hundreds of
digits live in $Z$, which arrives precomputed. So the GPU keeps working in
`float32` while the zoom goes arbitrarily deep. The reference orbit is computed
once per view in a Web Worker, using fixed-point arithmetic built on `BigInt`,
and uploaded as an `RG32F` texture with one texel per iteration.

The shader factors the recurrence as $(2Z + \varepsilon)\varepsilon + \delta$ to
spend one complex multiply instead of two.

### Glitches, and rebasing

Perturbation has a failure mode. When $|Z_n + \varepsilon_n|$ is far smaller
than $|Z_n|$, the sum cancels catastrophically, $\varepsilon$ loses its leading
digits, and the pixel renders as a blobby artifact — a "glitch".

The original remedy (2014) detected such pixels statistically and re-rendered
them against additional reference orbits, in several passes. **Rebasing**
(Zhuoran, 2021) replaces all of that with one branch: whenever $|z| <
|\varepsilon|$, restart the reference at index 0 and carry $z$ across as the new
$\varepsilon$. Since $Z_0 = 0$, the substitution $z = Z_0 + z$ is an *identity*
rather than an approximation — so it is exact, needs no second reference orbit,
and needs no extra passes.

```glsl
eps = cmul(fetchZ(m) * 2.0 + eps, eps) + dc;
m++;
vec2 z = fetchZ(m) + eps;          // escape test uses the full value
if (dot(z, z) < dot(eps, eps) || m >= refLen - 1) {
    eps = z;                        // rebase
    m = 0;
}
```

The same branch handles running off the end of the stored orbit, which is what
keeps every fetch in range.

## Beyond the float32 exponent

Perturbation fixes the mantissa problem but leaves the exponent one. A `float32`
bottoms out near $1.2 \times 10^{-38}$; below that $\delta$ flushes to zero,
every pixel receives the same value, and the image goes flat.

So below a threshold depth the shader recompiles into a **floatexp** variant,
which carries the exponent separately: a value is $m \cdot 2^{e}$ with the
mantissa held in $[0.5, 1)$ and $e$ an ordinary float, free to run to $-100000$.
Every operation must renormalize, so it is several times slower — which is why
it is compiled on demand rather than used throughout. The current mode is shown
in the **Precision** readout.

One tempting shortcut does *not* work: rescaling $\varepsilon$ and $\delta$ by a
per-frame factor $S$. Substituting $\varepsilon = Su$ and $\delta = Sv$ gives
$u' = 2Zu + Su^2 + v$, and rebasing sets $\varepsilon \leftarrow z$ with $z$ of
order 1 — so $u = z/S$ and the $Su^2$ term becomes $O(1/S)$. It overflows at
exactly the moment rebasing fires. Scaling and rebasing are incompatible.

With both pieces in place, zoom depth is no longer bounded by the GPU at all. It
is bounded only by how many digits the CPU reference orbit carries and how long
you are willing to let it compute.

## Pan and zoom

The view centre is stored as a fixed-point `BigInt`, and the scale as the
**base-2 logarithm** of the half-height. The logarithm matters as much as the
precision: a double bottoms out at $5 \times 10^{-324}$, so storing the scale
linearly would cap the zoom near 320 decades no matter how precise the centre
was.

Multiplying a pixel offset by the scale splits off the power of two and applies
it as an exact bit shift, so nothing underflows anywhere along the path.

Zooming is anchored to the **cursor**, not the viewport centre. Past a few dozen
decades a feature drifts off screen long before you reach it, which makes
centre-zoom unusable at these depths.

## Controls

- **Detail** — multiplier on the iteration budget. The budget itself is derived
  from zoom depth, because escape times grow geometrically as you descend; a
  fixed cap renders deep views as flat interior color.
- **Colour cycle** — how much smooth-iteration span one full palette cycle
  covers.
- **View** — read-only: half-height, current iteration budget, reference orbit
  length, and which precision mode is compiled.
- **Colors 1–5** — the gradient stops used for smooth coloring.

## Further reading

- [Mandelbrot set](https://en.wikipedia.org/wiki/Mandelbrot_set) (Wikipedia)
- Inigo Quilez, [Smooth iteration count](https://iquilezles.org/articles/msetsmooth/)
- K. I. Martin, [SuperFractalThing](https://web.archive.org/web/20160408070057/http://superfractalthing.co.nf/sft_maths.pdf) —
  the original perturbation write-up
- Zhuoran, [rebasing](https://fractalforums.org/programming/11/perturbation-theory-glitches-improvement/4360) —
  the glitch fix used here
