# Groovy Texture

A vibrant, 1970s-inspired five-pointed star surrounded by concentric color bands
that pulse inward. The whole image is drawn by a single **fragment shader** — no
geometry beyond a full-screen quad. Every pixel independently decides its color
from its distance to the star.

Source: [`src/apps/GroovyTexture.ts`](../../../src/apps/GroovyTexture.ts),
[`src/shaders/groovyShader.ts`](../../../src/shaders/groovyShader.ts)

## Core idea: signed distance functions

A **signed distance function** (SDF) maps a point to its distance from a shape's
surface. The sign tells you which side you're on:

$$
\text{sdf}(p) \begin{cases} < 0 & p \text{ is inside} \\ = 0 & p \text{ is on the boundary} \\ > 0 & p \text{ is outside} \end{cases}
$$

Once you can measure "how far is this pixel from the star, and inside or
outside?", coloring becomes easy: quantize that distance into bands.

## The star distance function

The star SDF (after Inigo Quilez) exploits the star's rotational symmetry. A
regular star with $n$ points repeats every $\frac{2\pi}{n}$ radians, so instead
of reasoning about the whole star we **fold** the plane into a single wedge and
solve there.

```glsl
float an = 3.141593 / float(n);   // half-angle of one point
float en = 3.141593 / m;          // m in [2, n] controls how sharp the points are
vec2  acs = vec2(cos(an), sin(an));
vec2  ecs = vec2(cos(en), sin(en));

// Fold the angle into one symmetric wedge:
float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
p = length(p) * vec2(cos(bn), abs(sin(bn)));

// Distance to the edge of that wedge:
p -= r * acs;
p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
return length(p) * sign(p.x);
```

The key trick is `mod(atan(p.x, p.y), 2*an) - an`: it converts the point's angle
into an angle within one wedge. `length(p) * vec2(cos(bn), abs(sin(bn)))` rebuilds
the point in that folded space, and the `abs` mirrors the wedge so we only have
to compute distance to **one edge**. Parameters:

- $n = 5$ — the number of points.
- $m = 3.4$ — controls concavity between points (larger = spikier).
- $r$ — the star's size (the **Star Size** slider).

## Turning distance into color bands

With a distance `dist` in hand, the bands come from **quantizing** it and looking
up a color, cycling through the palette with the modulo operator:

```glsl
int   num_colors = 5;
float threshold  = mod(time * waveSpeed, float(num_colors));
int   color_index = int(dist * float(num_colors) * float(num_colors) + threshold);
gl_FragColor = colorList[color_index % num_colors];
```

Two ideas make it "groovy":

1. **Banding.** Multiplying distance by a scale and truncating to an integer
   turns a smooth distance field into discrete rings. `% num_colors` cycles the
   palette so the rings repeat forever outward.
2. **Animation.** Adding `mod(time * waveSpeed, …)` shifts every band's index
   over time. Because the shift is applied to the index, the whole ring pattern
   appears to march **inward** toward the star, like a wave.

## Controls

- **Wave Speed** — how fast the bands travel inward ($\text{waveSpeed}$).
- **Star Size** — the radius $r$ passed to the SDF.
- **Colors 1–5** — the palette the band index cycles through.

## Why a full-screen quad?

The app renders a `PlaneGeometry(2, 2)` that exactly fills clip space, so the
fragment shader runs once per screen pixel. The vertex shader passes clip-space
coordinates to the fragment shader as `xy`, which become the plane on which the
star is drawn. See [`createFullscreenQuad`](../../../src/core/fullscreenQuad.ts).

## Further reading

- Inigo Quilez, [2D distance functions](https://iquilezles.org/articles/distfunctions2d/)
- Inigo Quilez, [Distance to a regular star polygon](https://iquilezles.org/articles/distfunctions2d/)
