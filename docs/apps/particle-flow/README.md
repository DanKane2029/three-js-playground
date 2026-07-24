# Particle Flow

A swirling field of tens of thousands of particles that react to your pointer.
The key idea: **every particle's motion is computed on the GPU**, in the vertex
shader, from a formula — the CPU never touches individual particles each frame.

Source: [`src/apps/ParticleFlow.ts`](../../../src/apps/ParticleFlow.ts),
[`src/shaders/particleShader.ts`](../../../src/shaders/particleShader.ts)

## Why compute motion on the GPU?

A GPU runs the vertex shader for every vertex **in parallel**. If each particle's
position at time $t$ can be written as a pure function of its identity and $t$,
then we can move 24,000 particles essentially for free — no per-particle loops on
the CPU, no re-uploading positions every frame. The CPU only sets a handful of
uniforms (time, speed, pointer position).

Each particle stores just two things, uploaded once:

- `position` — its **home** location (a random point in a cube).
- `aSeed` — a random number in $[0, 1)$ that makes each particle unique.

## The flow field

The particle's animated position is its home displaced by a smooth, time-varying
**flow field** built from sines and cosines:

```glsl
float t = time * uSpeed + aSeed * 6.2831853;   // per-particle phase
vec3 flow = vec3(
    sin(t + p.y * uSwirl),
    cos(t * 1.1 + p.z * uSwirl),
    sin(t * 0.9 + p.x * uSwirl)
);
p += flow;
```

Two details give it life:

- **Per-particle phase.** Adding `aSeed * 2π` offsets each particle's place in
  the cycle, so they don't all move in lockstep — the field looks organic.
- **Position-dependent argument.** Feeding `p.y`, `p.z`, `p.x` into the waves
  (scaled by `uSwirl`) means nearby particles flow in slightly different
  directions, producing curl and swirl instead of a uniform drift.

## Pointer repulsion

The pointer becomes a point in 3D space that pushes particles away. The force
points away from the pointer and falls off with distance:

$$
\vec{F} = \hat{a} \cdot \frac{\text{strength}}{d^2 + 1}, \qquad
\vec{a} = p - \text{pointer}, \quad d = |\vec{a}|
$$

```glsl
vec3 away = p - uPointer;
float d = length(away);
p += normalize(away + 1e-4) * uPointerStrength / (d * d + 1.0);
```

The $d^2$ falloff mimics an inverse-square law (like gravity or electrostatics),
so the shove is strong up close and fades quickly. The $+1$ in the denominator is
important: it caps the force at close range so particles right on the pointer
don't fly off to infinity (avoiding a division-by-zero singularity).

### Where is the pointer in 3D?

The mouse is a 2D screen position, but the particles live in 3D. The app
**unprojects** the pointer's normalized device coordinates through the camera to
a ray, then intersects that ray with the $z = 0$ plane to get a world-space
point (see `update()` in the app). That world point becomes `uPointer`.

## Drawing the particles

The particles are rendered as **point sprites**. Two shader details control how
they look:

- **Perspective size.** `gl_PointSize = uSize * (40.0 / -mv.z)` scales each point
  by $1/\text{distance}$, so nearer particles are bigger — matching how real
  perspective works.
- **Soft round dots.** In the fragment shader, `gl_PointCoord` gives the position
  within the square point ($[0,1]^2$). A `smoothstep` of the distance from the
  center fades the alpha to zero at the edges, turning the square into a soft
  circle.

The material uses **alpha blending** rather than additive blending. Additive
blending sums overlapping particles' colors and quickly saturates dense regions
to solid white; normal alpha blending keeps dense clusters reading as the
particle's color.

## Controls

- **count** — number of particles (rebuilds the geometry).
- **speed / swirl** — animation rate and how much the flow curls.
- **size** — base point size.
- **pointerStrength** — how hard the pointer pushes.
- **color** — particle tint.

## Further reading

- [Curl noise / flow fields](https://www.bit-101.com/blog/2021/07/curl-noise/)
- Three.js [Points](https://threejs.org/docs/#api/en/objects/Points)
