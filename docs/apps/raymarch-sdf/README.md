# Raymarch SDF

Three primitives — a sphere, a box, and a torus — melt together, drift on a
checkered floor, and cast soft shadows. Nothing here is made of triangles. The
entire 3D scene is drawn by a **single fragment shader** that "walks" a ray
through space for every pixel. Drag to orbit.

Source: [`src/apps/Raymarch.ts`](../../../src/apps/Raymarch.ts),
[`src/shaders/raymarchShader.ts`](../../../src/shaders/raymarchShader.ts)

## Signed distance fields in 3D

A **signed distance function** returns the distance from a point to the nearest
surface (negative inside). Three primitives used here:

$$
\begin{aligned}
\text{sphere}(p, r) &= |p| - r \\
\text{box}(p, b) &= |\max(q, 0)| + \min(\max(q_x, q_y, q_z), 0), \quad q = |p| - b \\
\text{torus}(p, R, r) &= \big|\,(\,|p_{xz}| - R,\; p_y)\,\big| - r
\end{aligned}
$$

The whole scene is one function `map(p)` that returns the distance to the nearest
object — the `min` of all the primitives (and the ground plane $p_y + 1.2$).

## Sphere tracing (raymarching)

To render, we shoot a ray from the camera through each pixel and find where it
first hits a surface. The trick that makes this efficient is **sphere tracing**:
the SDF tells us the distance to the *nearest* surface, so we know we can safely
step forward by exactly that much without passing through anything.

```glsl
float t = 0.0;
for (int i = 0; i < 128; i++) {
    vec3 p = ro + rd * t;     // point along the ray
    float d = map(p);         // safe distance to nearest surface
    if (d < 0.001) break;     // close enough — we hit something
    t += d;                   // leap forward by that safe distance
    if (t > 40.0) break;      // ray escaped to the background
}
```

In empty space the steps are huge; near a surface they shrink to a crawl,
converging on the exact hit point. The camera ray directions come from an
invisible perspective camera whose position and orientation are passed to the
shader as uniforms — that's how OrbitControls drives the view (see
[`rayCamera`](../../../src/core/rayCamera.ts)).

## Smooth union: melting shapes together

A plain `min` of two SDFs produces a hard crease where they meet. The **smooth
minimum** blends them with a rounded seam, so the shapes look like they're made
of the same fluid:

$$
\text{smin}(a, b, k) = \text{mix}(b, a, h) - k\,h\,(1 - h), \qquad
h = \text{clamp}\!\left(0.5 + \frac{0.5\,(b - a)}{k},\, 0,\, 1\right)
$$

$k$ is the blend radius — the **blend** slider. Larger $k$ = gooier merges.

## Surface normals from the gradient

Lighting needs a surface normal. For an SDF, the normal is simply the
**gradient** of the distance field — the direction in which distance increases
fastest — estimated with central differences:

$$
\vec{n} \approx \text{normalize}\begin{pmatrix} \text{map}(p + \vec{e}_x) - \text{map}(p - \vec{e}_x) \\ \text{map}(p + \vec{e}_y) - \text{map}(p - \vec{e}_y) \\ \text{map}(p + \vec{e}_z) - \text{map}(p - \vec{e}_z) \end{pmatrix}
$$

## Soft shadows and ambient occlusion — for free

Because we can measure distance to the scene from *any* point, two effects that
are expensive in triangle rendering become almost trivial:

- **Soft shadows.** March a ray from the surface toward the light. If it hits
  something, we're in shadow. But we also track how *closely* the ray passed
  other surfaces — `min(res, 10·h/t)` — which produces a soft penumbra instead of
  a hard edge, mimicking a light of finite size.
- **Ambient occlusion.** Sample the SDF at a few points stepping out along the
  normal. If those samples read smaller than the step distance, nearby geometry
  is crowding this point, so we darken it. This is what shades the crevices where
  shapes meet.

## Domain repetition: infinite scenes

Applying `mod` to the coordinates before evaluating the SDF **tiles space**,
repeating the shapes forever with no extra cost:

$$
q = \operatorname{mod}(p + \tfrac{s}{2},\, s) - \tfrac{s}{2}
$$

The **repeat** slider sets the spacing $s$ (0 turns it off).

## Coloring

Surface color comes from a **cosine palette** (Inigo Quilez): a compact way to
express a whole gradient with a few vectors,

$$
\text{color}(t) = \vec{a} + \vec{b}\cdot\cos\!\big(2\pi\,(t + \vec{\phi})\big)
$$

driven here by the surface normal. The ground uses a simple checkerboard from
`mod(floor(x) + floor(z), 2)`, and distance **fog** fades everything into the
background with an exponential falloff.

## Controls

- **speed** — how fast the primitives animate.
- **blend** — the smooth-union radius $k$.
- **repeat** — domain repetition spacing (0 = a single scene).
- **fog** — how quickly distance fades to background.
- **palette A / B** — the cosine-palette colors.

## Further reading

- Inigo Quilez, [Distance functions (3D)](https://iquilezles.org/articles/distfunctions/)
- Inigo Quilez, [Smooth minimum](https://iquilezles.org/articles/smin/) and [Palettes](https://iquilezles.org/articles/palettes/)
- Inigo Quilez, [Soft shadows](https://iquilezles.org/articles/rmshadows/)
