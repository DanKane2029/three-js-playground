# Three.js Playground

A collection of small real-time graphics experiments built with
[Three.js](https://threejs.org/) and TypeScript. Pick an app from the panel in
the top-right corner and tweak its parameters live.

**Stack:** Three.js · TypeScript · [Vite](https://vite.dev/) ·
[Tweakpane](https://tweakpane.github.io/docs/) · ESLint 9 · Prettier 3.

## Getting started

Install [Node.js](https://nodejs.org/) and npm, then:

```bash
npm install       # install dependencies
npm run dev       # start the dev server with hot reload
npm run build     # type-check and produce a production build in dist/
npm run preview   # serve the production build locally
npm run lint      # lint with ESLint
npm run format    # format with Prettier
```

The app is deployed to GitHub Pages from `main` via
`.github/workflows/deploy.yml`.

## Architecture

Each experiment is an [`App`](src/core/App.ts) subclass that owns its own scene
and camera and implements the lifecycle hooks it needs (`setup`, `update`,
`resize`, `render`, `dispose`) plus optional pointer/wheel handlers. The
[`Playground`](src/core/Playground.ts) orchestrator owns the renderer and render
loop, handles resizing and pointer routing, and switches between apps. Controls
are declared per app by binding a `params` object to a Tweakpane folder in
`setupControls`, and each app disposes its GPU resources on teardown.

### Scaffolding new apps

`npm run generate-code` runs the [Plop](https://plopjs.com/) generators to
scaffold a new app (registered automatically in `src/main.ts`) or shader from the
templates in `code-generators/`.

## The apps

### Groovy Texture

A vibrant 1970s-inspired five-pointed star. A fragment shader uses a signed
distance function to draw color bands moving inward. The five colors, wave speed,
and star size are all adjustable.

### Mandelbrot Set

The famous fractal, computed in a fragment shader by iterating
$Z_{n+1}=Z_n^2+C$ and coloring each pixel by how quickly the sequence escapes.
Drag to pan and scroll to zoom; the five gradient colors and iteration count are
adjustable.

### Terrain Generator

A spherical planet whose surface is displaced by Perlin noise. A gradient grid is
uploaded as a data texture and sampled in the vertex shader to push vertices
along their normals — positive height becomes green land, negative becomes blue
water. Regenerate the noise, change the spin, or toggle wireframe.

### Bloom Field

A ring of emissive shapes rendered through an `EffectComposer` pipeline with an
`UnrealBloomPass`. Adjust the bloom strength, radius, and threshold.

### Particle Flow

A GPU-driven particle field: every particle's animated position is computed in
the vertex shader from its seed and time, plus a repulsion from the pointer. Move
the pointer to push the swarm around; tune count, speed, swirl, size, pointer
strength, and color.

### PBR Viewer

A physically based scene lit by image-based lighting (`RoomEnvironment` via
`PMREMGenerator`) with orbit controls. Adjust metalness, roughness, environment
intensity, and auto-rotation.

### Pixelate

A spinning shape run through a custom pixelate post-process shader (a `ShaderPass`
that snaps output pixels to a grid). Adjust the pixel size.
