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

which is exactly what the shader computes:

```glsl
float x = z.x * z.x - z.y * z.y + c.x;   // real part
float y = 2.0 * z.x * z.y      + c.y;   // imaginary part
z = vec2(x, y);
```

## The escape-time algorithm

We can't iterate forever, so we use two stopping rules:

1. **Escape.** If $|z| > 2$ the point is guaranteed to diverge, so we stop. We
   test $|z|^2 > 4$ to avoid a square root (`dot(z, z) < 4.0`).
2. **Budget.** If we reach `maxIterations` without escaping, we treat the point
   as (probably) inside the set.

```glsl
while (dot(z, z) < 4.0 && iterations < maxIterations) {
    // z = z^2 + c
    iterations += 1.0;
}
```

The **number of iterations** to escape is the raw signal we color by: points
just outside the set take many iterations, points far away take very few.

## Smooth (continuous) coloring

Coloring by the integer iteration count produces ugly concentric **bands**,
because escape count jumps by whole numbers. The fix is to estimate a
*fractional* iteration count from how far past the escape radius $z$ landed:

$$
\nu = n - \log\big(\log |z_n|\big)
$$

This is a simplification of the *renormalized iteration count* derived from the
[Douady–Hubbard potential](https://en.wikipedia.org/wiki/Mandelbrot_set#Continuous_.28smooth.29_coloring)
of the set. Intuitively: on the last step $z$ overshoots the escape radius by a
different amount at each pixel, and $\log\log|z|$ measures that overshoot, giving
a smooth value between integer counts. The shader then maps it through a color
gradient:

```glsl
float smoothIterations = iterations - log(log(dot(z, z)));
float colorValue = smoothIterations / maxIterations;
gl_FragColor = colorGradient(colorValue * 10.0, palette);
```

The palette is seven stops — black, your five colors, then black again — so the
color sweeps through the spectrum as points approach the set and fades to black
deep inside and far outside.

## Pan and zoom

The pixel's clip coordinate `xy` (in $[-1, 1]$) is mapped into the complex plane
by a zoom scale and an offset:

$$
c = \texttt{xy} \cdot \sqrt{\text{zoom}} + \text{offset}
$$

- **Scrolling** multiplies/divides `zoom`, shrinking the window onto the plane.
- **Dragging** adds to `offset`, translating the view. The drag delta is scaled
  by $\sqrt{\text{zoom}}$ so panning feels the same speed at every zoom level.

### The precision limit

The Mandelbrot set has infinite detail, but GPU floats are 32-bit. Zoom in far
enough and $\sqrt{\text{zoom}}$ becomes tiny; neighboring pixels map to complex
numbers so close together that they round to the same float, and the image turns
blocky. That's a hardware limit, not a bug — the "true" set keeps going forever.

## Controls

- **maxIterations** — the iteration budget. Higher reveals more boundary detail
  (and costs more per pixel).
- **Colors 1–5** — the gradient stops used for smooth coloring.

## Further reading

- [Mandelbrot set](https://en.wikipedia.org/wiki/Mandelbrot_set) (Wikipedia)
- Inigo Quilez, [Smooth iteration count](https://iquilezles.org/articles/msetsmooth/)
