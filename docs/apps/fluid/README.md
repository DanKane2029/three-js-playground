# Fluid

A real-time fluid simulation you can stir with the pointer. Dye swirls, folds, and
diffuses through a velocity field that obeys (a discretized form of) the equations
of fluid motion. Everything runs on the GPU: the fluid's state lives entirely in
textures, and each simulation step is a full-screen shader pass.

Source: [`src/apps/FluidSim.ts`](../../../src/apps/FluidSim.ts),
[`src/shaders/fluidShaders.ts`](../../../src/shaders/fluidShaders.ts)

## What we're simulating

An incompressible fluid is described by the **Navier–Stokes equations**. For a
velocity field $\vec{u}$ and pressure $p$:

$$
\frac{\partial \vec{u}}{\partial t} = -(\vec{u}\cdot\nabla)\vec{u} - \frac{1}{\rho}\nabla p + \nu\,\nabla^2\vec{u} + \vec{f}, \qquad \nabla\cdot\vec{u} = 0
$$

The terms, left to right: **advection** (the fluid carries itself along),
**pressure** gradient, **viscosity** (diffusion), and external **forces**. The
second equation, $\nabla\cdot\vec{u} = 0$, is the *incompressibility* constraint:
fluid can't be created or destroyed, so the field must have zero divergence.

This app follows Jos Stam's **"Stable Fluids"** method, which solves these terms
one at a time each frame. The trick that makes it stable (and GPU-friendly) is
how it handles advection.

## GPGPU: the simulation lives in textures

There's no particle list and no CPU physics loop. Instead each field is a
floating-point texture (a `WebGLRenderTarget`):

- **velocity** — a 2-channel field, $(u_x, u_y)$ per cell.
- **dye** — the visible color carried by the fluid.
- **pressure**, **divergence**, **curl** — scratch fields for the solver.

Because a shader can't read and write the same texture at once, each evolving
field uses **ping-pong buffers**: read from one, write the result to a second,
then swap. This "compute in a fragment shader" pattern is called **GPGPU**
(general-purpose GPU) and is what lets us update a 128×128 (or larger) grid dozens
of times per frame.

## The steps, in order

Each frame runs these passes ([`fluidShaders.ts`](../../../src/shaders/fluidShaders.ts)):

### 1. Advection (semi-Lagrangian)

Instead of pushing values forward (which blows up), we look **backward**: for each
cell, ask "where did the fluid now here come from?" and copy that value. We trace
the velocity back one timestep and sample there:

$$
q_{\text{new}}(\vec{x}) = q_{\text{old}}\big(\vec{x} - \Delta t\,\vec{u}(\vec{x})\big)
$$

```glsl
vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * uTexelSize;
gl_FragColor = texture2D(uSource, coord) / (1.0 + dissipation * dt);
```

Because we always sample *existing* values, the result can never exceed the input
range — this is why the method is "stable" for any timestep. The `dissipation`
divisor slowly fades the field (dye fades to black; velocity loses energy).

### 2. Vorticity confinement

Numerical advection smears out small swirls. **Curl** measures local rotation:

$$
\omega = \nabla \times \vec{u} = \frac{\partial u_y}{\partial x} - \frac{\partial u_x}{\partial y}
$$

The vorticity pass computes $\omega$, then adds a force that pushes velocity back
toward those swirls — restoring the wispy, turbulent detail that makes the fluid
look alive. The **curl** slider controls its strength.

### 3. Projection: making the field divergence-free

After advection the velocity generally violates $\nabla\cdot\vec{u}=0$ (it has
sources and sinks). **Helmholtz decomposition** says any field is a
divergence-free part plus the gradient of some scalar. We find that scalar — the
**pressure** — and subtract its gradient. Concretely:

1. **Divergence.** Compute $\nabla\cdot\vec{u}$ with finite differences.
2. **Pressure solve.** Solve the Poisson equation $\nabla^2 p = \nabla\cdot\vec{u}$.
   There's no closed form, so we relax it with **Jacobi iteration** — each pass
   averages a cell's four neighbors and nudges toward the solution:

   $$
   p_{i,j} \leftarrow \frac{p_{i-1,j} + p_{i+1,j} + p_{i,j-1} + p_{i,j+1} - \text{div}_{i,j}}{4}
   $$

   More iterations = a more accurate (less "springy") fluid. This is the
   **pressure iters** slider.
3. **Gradient subtract.** Remove the pressure gradient from the velocity:
   $\vec{u} \leftarrow \vec{u} - \nabla p$. Now the field is divergence-free.

### 4. Splatting forces and dye

Your pointer injects momentum and color. Each move adds a soft Gaussian blob to
both the velocity field (a push in the drag direction) and the dye field (a
color):

$$
\text{splat}(\vec{x}) = e^{-|\vec{x} - \vec{p}|^2 / r}\cdot \vec{c}
$$

The velocity blob's "color" is actually the drag vector $(\Delta x, \Delta y)$, so
dragging faster pushes the fluid harder.

### 5. Display

Finally the dye texture is drawn to the screen.

## Two resolutions

The velocity/pressure simulation runs at a modest grid (128) — the *motion*
doesn't need to be high-resolution. The **dye** is advected at a higher grid
(512) so the visible color stays crisp. Because advection samples by UV
coordinates, the two grids interoperate for free.

## Controls

- **curl** — vorticity confinement strength (swirliness).
- **velocity fade / dye fade** — how quickly motion and color dissipate.
- **pressure iters** — Jacobi iterations; higher is more accurate but costlier.
- **splat radius** — size of the pointer's influence.
- **Splat / Clear** — inject random dye, or wipe the canvas.

## Further reading

- Jos Stam, [Stable Fluids](https://pages.cs.wisc.edu/~chaol/data/cs777/stam-stable_fluids.pdf) (the original paper)
- Mark Harris, [Fast Fluid Dynamics Simulation on the GPU](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu) (GPU Gems)
- Pavel Dobryakov, [WebGL Fluid Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) (a well-known implementation of this technique)
