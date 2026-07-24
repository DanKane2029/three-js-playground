# Planet Generator

A procedurally generated mini planet — continents, oceans, mountains, ice caps,
an atmosphere, drifting clouds, and a starfield — all built from noise and
lighting math, with no textures or 3D models. Drag to orbit, scroll to zoom, and
regenerate for an endless variety of worlds.

Source: [`src/apps/terrain_generator/TerrainGenerator.ts`](../../../src/apps/terrain_generator/TerrainGenerator.ts),
[`src/shaders/planetShader.ts`](../../../src/shaders/planetShader.ts),
[`src/shaders/atmosphereShader.ts`](../../../src/shaders/atmosphereShader.ts),
[`src/shaders/cloudShader.ts`](../../../src/shaders/cloudShader.ts),
[`src/shaders/glsl/noise.ts`](../../../src/shaders/glsl/noise.ts)

## 1. Noise: the source of all the detail

Everything organic here comes from **gradient noise** — a smooth, pseudo-random
function of space. Given a point, it returns a value that looks random but varies
continuously, so nearby points get similar values. This app uses **3D simplex
noise** ($\text{snoise}(\vec{p})$), sampled at the point's position *on the
sphere*.

Why 3D noise sampled in 3D space, rather than a 2D noise sampled by UV
coordinates? Because a sphere can't be wrapped in a 2D image without a **seam**
and **pole pinching** (the same problem as a world map distorting Greenland).
Sampling a genuinely 3D noise field at the surface point sidesteps this entirely —
the terrain is seamless everywhere.

### Fractal Brownian motion (fBm)

A single noise sample is smooth and blobby. Real terrain has detail at many
scales — continents, then hills, then bumps. We get that by summing several
**octaves** of noise, each at double the frequency and half the amplitude of the
last:

$$
\text{fbm}(\vec{p}) = \sum_{i=0}^{N-1} \frac{1}{2^{i}}\; \text{snoise}\!\left(2^{i}\,\vec{p}\right)
$$

```glsl
float fbm(vec3 p, int octaves, float lacunarity, float gain) {
    float sum = 0.0, amp = 0.5, freq = 1.0;
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        sum  += amp * snoise(p * freq);
        freq *= lacunarity;   // 2.0 — each octave doubles frequency
        amp  *= gain;         // 0.5 — and halves amplitude
    }
    return sum;
}
```

- **lacunarity** (2.0) — how much finer each octave is.
- **gain** (0.5) — how much weaker each octave is.
- **octaves** — how many layers (the **octaves** slider): more = more fine detail.

The **seed** is simply an offset added to the sample position, shifting the whole
noise field to a different region — that's how "Regenerate" makes a new planet.

## 2. Shaping the surface

Sample the fBm at each surface direction to get a normalized elevation
$n \in [0, 1]$. A **sea level** parameter then splits the surface into ocean and
land:

$$
r(\hat{d}) = R + \max(n - \text{seaLevel},\; 0)\cdot \frac{\text{amplitude}}{1 - \text{seaLevel}}
$$

Everything below sea level stays at the base radius $R$, producing a **flat
ocean**; land rises above it. The vertex shader displaces each vertex outward
along its direction $\hat d$ by this radius.

### Recomputing normals

Displacing vertices changes the surface's shape, so the original sphere normals
are wrong. We estimate the true normal by sampling the displaced height at two
nearby points (offset along the surface tangents) and taking the cross product of
the resulting edges:

$$
\vec{n} = \text{normalize}\big((p_1 - p_0) \times (p_2 - p_0)\big)
$$

Correct normals are what make the mountains catch the light and read as 3D.

## 3. Coloring by biome

Land is colored by **elevation bands** — beaches near the shore rising to snowy
peaks — with smooth transitions using `smoothstep`:

```glsl
albedo = uSand;
albedo = mix(albedo, uGrass,  smoothstep(0.02, 0.16, h));
albedo = mix(albedo, uForest, smoothstep(0.16, 0.42, h));
albedo = mix(albedo, uRock,   smoothstep(0.42, 0.72, h));
albedo = mix(albedo, uSnow,   smoothstep(0.76, 0.95, h));
```

Two extra touches:

- **Ocean depth.** Water is colored by how far below sea level it is, so shallow
  coastal water is lighter than deep ocean.
- **Polar ice caps.** Latitude is just $|\hat{d}_y|$ (the y-component of the
  surface direction). Near the poles it approaches 1, and we blend toward snow.

Crucially, the biome color is computed **per fragment** (per pixel), re-evaluating
the noise in the fragment shader. If we only had the per-vertex elevation, the
coastlines would follow the triangle edges and look faceted. Per-pixel evaluation
gives smooth, mesh-independent shorelines.

## 4. Lighting the surface

The surface is shaded with a **Lambert diffuse** term (brightness proportional to
the angle between the normal and the sun) plus ambient fill:

$$
\text{color} = \text{albedo} \cdot \big(\text{ambient} + \max(\vec{n}\cdot\vec{L},\, 0)\big)
$$

Water additionally gets a **Blinn–Phong specular** highlight — the bright glint
of the sun on the sea — using the half-vector $\vec{h} = \text{normalize}(\vec{L} + \vec{V})$:

$$
\text{specular} = \big(\max(\vec{n}\cdot\vec{h},\, 0)\big)^{64}
$$

## 5. The atmosphere (Fresnel rim glow)

The blue halo is a separate, slightly larger sphere rendered with a **Fresnel**
term. The Fresnel effect says surfaces reflect more at grazing angles — here we
use it to make the atmosphere glow brightest around the planet's silhouette,
where our view skims tangent to the sphere:

$$
\text{glow} = \big(1 - |\vec{V}\cdot\vec{n}|\big)^{p}
$$

The sphere is drawn **back-side** with **additive blending**, so the glow builds
up around the rim and fades toward the center. The exponent $p$ (power) controls
how tight the rim is.

## 6. Clouds and stars

- **Clouds** are another sphere just above the surface. Its fragment shader
  samples fBm noise offset by time (so clouds drift), and a `smoothstep` on a
  **coverage** threshold decides where cloud is opaque vs. clear. They're lit
  softly by the same sun direction.
- **Stars** are a few thousand `Points` scattered on a large sphere shell around
  the scene, placed with uniformly distributed random directions.

## Controls

- **preset** — Earth-like, Desert, Ice, Lava, Alien (sets palette + parameters).
- **Regenerate** — new random seed → new world.
- **seaLevel / amplitude / frequency / octaves** — shape the terrain.
- **snow caps** — latitude at which polar ice begins.
- **atmosphere / clouds** — toggles, strength, colors, coverage, drift speed.
- **Motion** — auto-rotate and spin speed (independent of orbit controls).
- **Biome colors** — the seven elevation-band colors.

## Further reading

- Ken Perlin / Stefan Gustavson, [simplex noise](https://en.wikipedia.org/wiki/Simplex_noise)
- Inigo Quilez, [fBm](https://iquilezles.org/articles/fbm/)
- [Fresnel equations](https://en.wikipedia.org/wiki/Fresnel_equations)
