# Mandelbulb

A three-dimensional cousin of the [Mandelbrot set](../mandelbrot-set/): an
intricate, organic fractal you can orbit around in real time. It's raymarched
with a **distance estimator**, combining the fractal math of the Mandelbrot with
the sphere-tracing technique of [Raymarch SDF](../raymarch-sdf/).

Source: [`src/apps/Mandelbulb.ts`](../../../src/apps/Mandelbulb.ts),
[`src/shaders/mandelbulbShader.ts`](../../../src/shaders/mandelbulbShader.ts)

## From complex numbers to "triplex" numbers

The Mandelbrot set iterates $z \to z^2 + c$ on **complex** numbers, which are
inherently 2D. There's no true 3D number system that behaves like the complex
numbers, so the Mandelbulb uses an *invented* one — "triplex" numbers — where
squaring (or raising to a power) is defined geometrically in **spherical
coordinates**.

Write a 3D point in spherical form:

$$
r = |z|, \qquad \theta = \arccos\!\left(\frac{z_z}{r}\right), \qquad \phi = \operatorname{atan}(z_y, z_x)
$$

Raising to the power $p$ scales the radius and **multiplies both angles** — a
direct analogy to how squaring a complex number squares its magnitude and doubles
its angle:

$$
z^p = r^p \big(\sin(p\theta)\cos(p\phi),\; \sin(p\phi)\sin(p\theta),\; \cos(p\theta)\big)
$$

The iteration is then the familiar $z \to z^p + c$. With $p = 8$ (the canonical
choice) the surface bristles with the characteristic bulbs and filaments.

```glsl
float theta = acos(z.z / r);
float phi   = atan(z.y, z.x);
float zr    = pow(r, uPower);
theta *= uPower;
phi   *= uPower;
z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta)) + pos;
```

## Distance estimation

We can't use an exact SDF — the fractal has infinite detail. Instead we use a
**distance estimator** (DE): a formula that gives a safe *lower bound* on the
distance to the fractal, which is exactly what sphere tracing needs. The standard
DE (from the Douady–Hubbard potential of the set) tracks a running derivative
$\text{dr}$ of the iteration alongside $z$:

$$
\text{dr}_{n+1} = p\,r_n^{\,p-1}\,\text{dr}_n + 1, \qquad
\text{DE} = \tfrac{1}{2}\,\frac{\ln r}{\,}\,\frac{r}{\text{dr}}
$$

```glsl
dr = pow(r, uPower - 1.0) * uPower * dr + 1.0;   // running derivative
// ... after the loop:
return 0.5 * log(r) * r / dr;                     // distance estimate
```

Intuitively, $\text{dr}$ measures how fast the iteration is stretching space near
this point; dividing by it converts "how many iterations until escape" into an
approximate distance. That distance drives the same sphere-tracing loop used in
[Raymarch SDF](../raymarch-sdf/#sphere-tracing-raymarching): step forward by the
DE, repeat until we're within a tiny epsilon of the surface.

The iteration stops early when $r > 2$ (the point has escaped) or when it hits the
**iterations** budget (assumed inside the set). More iterations = finer detail
and crisper edges.

## Orbit-trap coloring

To color the surface we record the **orbit trap** — the closest the iterating
point ever came to the origin:

```glsl
trap = min(trap, r);   // nearest approach, updated each iteration
```

This value varies smoothly across the surface and captures the fractal's internal
structure, so mixing two colors by it (`mix(colorA, colorB, trap)`) reveals the
bulbs and valleys. Rays that *just* miss the surface are brightened by their step
count to produce a soft **glow** halo.

## Lighting

Once a ray hits, the surface normal is estimated from the gradient of the DE
(central differences, exactly as in [Raymarch SDF](../raymarch-sdf/#surface-normals-from-the-gradient)),
and shaded with simple diffuse lighting plus a step-count-based ambient
occlusion (rays that took many steps were squeezing through tight crevices, so
they're darkened).

## Controls

- **power** — the exponent $p$. 8 is classic; other values give wildly different
  forms. **animate power** sweeps it over time.
- **iterations** — detail vs. performance.
- **glow** — intensity of the halo around the silhouette.
- **color A / B** — the orbit-trap gradient.

## Further reading

- [Daniel White's original Mandelbulb page](https://www.skytopia.com/project/fractal/mandelbulb.html)
- Inigo Quilez, [Mandelbulb](https://iquilezles.org/articles/mandelbulb/)
- [Mandelbrot Set](../mandelbrot-set/) — the 2D fractal this generalizes
