# PBR Viewer

A metallic knot and accent spheres lit entirely by a surrounding environment,
with sliders for metalness and roughness. This app demonstrates **physically
based rendering** (PBR) and **image-based lighting** (IBL) — the modern standard
for realistic materials. Drag to orbit.

Source: [`src/apps/PbrViewer.ts`](../../../src/apps/PbrViewer.ts)

## What "physically based" means

Older shading models used ad-hoc parameters (a "shininess" number, arbitrary
specular colors). PBR instead models how light actually interacts with surfaces,
under two principles:

- **Energy conservation** — a surface can't reflect more light than it receives.
- **Microfacet theory** — a surface is treated as countless tiny mirrors
  (microfacets); their statistical distribution determines how sharp or blurry
  reflections are.

The result: materials look correct under *any* lighting, and artists describe
them with two intuitive sliders.

## The metalness / roughness workflow

- **Metalness** ($0 \to 1$): is this a metal or not? Metals have no diffuse
  color — they reflect their surroundings tinted by their base color. Non-metals
  (dielectrics) have a diffuse color and a dim, white-ish reflection.
- **Roughness** ($0 \to 1$): how polished is the surface? Low roughness gives
  sharp, mirror-like reflections; high roughness scatters them into a soft sheen.

## The microfacet BRDF (what the GPU evaluates)

A BRDF (bidirectional reflectance distribution function) describes how much light
from direction $\vec{l}$ reflects toward the viewer $\vec{v}$. Three.js uses a
Cook–Torrance specular term:

$$
f_\text{spec} = \frac{D(\vec{h})\, F(\vec{v}, \vec{h})\, G(\vec{l}, \vec{v})}{4\,(\vec{n}\cdot\vec{l})(\vec{n}\cdot\vec{v})}
$$

The three factors, each a piece of physics:

- **$D$ — Normal Distribution (GGX/Trowbridge–Reitz).** How many microfacets are
  aligned with the half-vector $\vec{h}$. **Roughness** widens this lobe.
- **$F$ — Fresnel (Schlick approximation).** Reflectivity increases at grazing
  angles — every surface becomes mirror-like edge-on:
  $$
  F(\theta) = F_0 + (1 - F_0)(1 - \cos\theta)^5
  $$
  Dielectrics have $F_0 \approx 0.04$; metals use their base color as $F_0$.
- **$G$ — Geometry / shadow-masking (Smith).** Accounts for microfacets that
  shadow or occlude each other, which matters most at grazing angles.

You don't write this shader here — `MeshStandardMaterial` implements it. The app
just feeds it `metalness` and `roughness`.

## Image-based lighting

There are no light objects in this scene. Instead, the whole environment acts as
one big area light. This is **image-based lighting**:

1. `RoomEnvironment` builds a small synthetic scene (a room with bright panels)
   to act as the light source.
2. `PMREMGenerator` converts it into a **prefiltered mipmapped radiance
   environment map** — a cubemap where each mip level is pre-blurred to match a
   roughness value. This is the clever part: instead of integrating the BRDF over
   the whole environment per pixel (impossibly expensive), the integral is
   **precomputed** and baked into mip levels. A rough surface just samples a
   blurrier mip.

$$
L_\text{out}(\vec{v}) \approx \underbrace{\text{irradiance}(\vec{n})}_{\text{diffuse}} + \underbrace{\text{prefiltered}(\vec{r}, \text{roughness})}_{\text{specular}}
$$

The scene's `environmentIntensity` scales this contribution (the **envIntensity**
slider).

## Tone mapping

The environment produces high-dynamic-range values that can exceed 1.0. The
renderer applies **ACES Filmic tone mapping** to compress that HDR range into the
$[0,1]$ a display can show, preserving highlight detail instead of clipping to
white. The app sets this in `setup()` and restores the previous setting on
teardown.

## Controls

- **metalness / roughness** — the two PBR material sliders.
- **envIntensity** — brightness of the image-based lighting.
- **autoRotate** — spin the camera automatically (OrbitControls).

## Further reading

- [Theory of physically based rendering](https://learnopengl.com/PBR/Theory) (LearnOpenGL)
- Google Filament's [PBR documentation](https://google.github.io/filament/Filament.html) (deep dive)
