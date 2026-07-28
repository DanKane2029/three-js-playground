# Ocean

A 3D ocean you can orbit around: rolling swells with sharp crests and broad
troughs, foam on the peaks, a mirror-like sky reflection near the horizon, and a
glinting sun. The water is a flat mesh displaced entirely in the **vertex
shader** by a sum of Gerstner waves.

Source: [`src/apps/Ocean.ts`](../../../src/apps/Ocean.ts),
[`src/shaders/oceanShader.ts`](../../../src/shaders/oceanShader.ts),
[`src/shaders/skyShader.ts`](../../../src/shaders/skyShader.ts),
[`src/shaders/glsl/sky.ts`](../../../src/shaders/glsl/sky.ts)

## Why not just sine waves?

The obvious way to make waves is to offset each vertex's height by a sine:
$y = A\sin(kx - \omega t)$. But that gives rounded, symmetric hills — nothing like
the ocean, where crests are **sharp** and troughs are **broad and flat**.

The reason real waves look that way: water particles don't just bob up and down,
they move in **circles**. As a crest approaches, the surface water moves *toward*
it and up; as it passes, the water moves away and down. That circular motion piles
water up at the crests and stretches it out in the troughs.

## Gerstner (trochoidal) waves

A **Gerstner wave** models exactly that circular motion. Instead of only moving a
vertex vertically, it also moves it **horizontally**, back and forth along the
wave's direction. For a single wave with direction $\vec{D}$, wavenumber
$k = 2\pi / L$ (for wavelength $L$), angular frequency $\omega$, amplitude $A$, and
steepness $Q$, a point at horizontal position $\vec{p}$ is displaced to:

$$
\begin{aligned}
\vec{p}_{xz} &\mathrel{+}= Q\,A\,\vec{D}\,\cos(k\,\vec{D}\cdot\vec{p} + \omega t) \\
y &\mathrel{+}= A\,\sin(k\,\vec{D}\cdot\vec{p} + \omega t)
\end{aligned}
$$

The horizontal term (the $\cos$) is what sharpens the crests. The **steepness**
$Q$ controls how pronounced that is — at $Q = 0$ it's a plain sine wave; increase
it and the crests peak. Too much and the crest folds over itself (a loop), so the
per-wave steepness is capped:

$$
Q_i = \frac{\text{steepness}}{k_i\,A_i\,N}
$$

where $N$ is the number of waves. The app sums $N = 4$ waves of different
wavelengths and directions (fanned around the wind direction) to build a natural,
non-repeating swell — a crude **wave spectrum**.

```glsl
for (int i = 0; i < NUM; i++) {
    vec2 D = normalize(uDir[i]);
    float term = uK[i] * dot(D, p) + uOmega[i] * uTime;
    float Qi = uSteepness / (uK[i] * uAmp[i] * float(NUM));
    horiz  += Qi * uAmp[i] * D * cos(term);
    height += uAmp[i] * sin(term);
    // ... normal accumulation ...
}
```

### Realistic wave speed (dispersion)

The waves don't all move at the same speed. In deep water the **dispersion
relation** ties a wave's frequency to its wavelength:

$$
\omega = \sqrt{g\,k}
$$

So long waves travel faster than short ones (as in the real sea). The app
computes each wave's $\omega$ this way from gravity $g$, scaled by a **speed**
control.

## Analytic normals

Lighting needs the surface normal, and because we have a closed-form surface we
can differentiate it directly rather than sampling neighbors. Summing the partial
derivatives of the Gerstner sum gives (in the plane's local frame, where up is
$+z$):

$$
\vec{n} = \Big(-\!\sum D_{i,x}\,k_iA_i\cos(\cdot),\; -\!\sum D_{i,y}\,k_iA_i\cos(\cdot),\; 1 - \sum Q_i k_i A_i \sin(\cdot)\Big)
$$

computed in the same loop as the displacement, then normalized. (The mesh is a
plane rotated flat, so its local $+z$ becomes world "up.")

## Shading the water

The fragment shader combines several effects:

- **Fresnel reflection.** Water is dark when you look straight down into it but
  mirror-like at grazing angles. The Schlick approximation blends between a deep
  water color and the reflected sky based on view angle:
  $$
  F = F_0 + (1 - F_0)(1 - \vec{n}\cdot\vec{v})^5, \qquad F_0 \approx 0.02
  $$
  The reflection samples the **same** procedural sky the sky dome uses (via the
  shared [`sky.ts`](../../../src/shaders/glsl/sky.ts)), so reflections always
  match the real sky.
- **Sun glitter.** A high-exponent Blinn–Phong specular term adds the sharp,
  sparkling glint of the sun on the surface.
- **Foam.** The highest crests are blended toward white.
- **Distance fog.** Far water fades into the horizon sky color, hiding the edge of
  the mesh so the ocean looks boundless.

The **sky** itself is a large inward-facing dome shaded by a vertical gradient
plus a sun disk and glow; the **Sun** controls (elevation/azimuth) move the sun,
which updates the sky, the reflection, and the specular glint together.

## Controls

- **amplitude / wavelength** — overall wave height and size.
- **choppiness** — the steepness $Q$ (rounded swell → sharp, breaking-looking crests).
- **wind dir** — the direction the waves travel.
- **speed** — time scale of the motion.
- **foam** — how much white appears on the crests.
- **water color** — the deep-water base color.
- **Sun → elevation / azimuth** — the sun's position in the sky.

## Further reading

- Mark Finch, [Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models) (GPU Gems Ch. 1 — the source of these Gerstner formulas)
- [Trochoidal (Gerstner) wave](https://en.wikipedia.org/wiki/Trochoidal_wave) (Wikipedia)
- [Dispersion of water waves](https://en.wikipedia.org/wiki/Dispersion_(water_waves))
