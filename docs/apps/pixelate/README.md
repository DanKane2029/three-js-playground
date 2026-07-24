# Pixelate

A spinning shape rendered normally, then run through a **post-processing** shader
that snaps the image to a coarse grid for a blocky, "pixel art" look. This app is
a gentle introduction to the render-to-texture pipeline that also powers
[Bloom Field](../bloom-field/).

Source: [`src/apps/Pixelate.ts`](../../../src/apps/Pixelate.ts),
[`src/shaders/pixelateShader.ts`](../../../src/shaders/pixelateShader.ts)

## Post-processing: rendering to a texture

Normally a scene is drawn straight to the screen. **Post-processing** instead
draws it into an off-screen image (a *render target*), then runs one or more
full-screen shader passes that read that image and transform it. Three.js
manages this with an `EffectComposer` and a chain of passes:

```
RenderPass  →  ShaderPass (pixelate)  →  OutputPass
 draw scene      warp the image         tone-map + sRGB to screen
 into a texture  (our shader)           color conversion
```

Each pass reads the previous pass's output through a uniform named `tDiffuse`
(the convention Three.js uses for "the image so far").

## The pixelation math

Pixelation is **quantization** of texture coordinates. The screen is measured in
UV coordinates $u, v \in [0, 1]$. We choose a block size in pixels and convert it
to a cell size in UV space:

$$
\text{cell} = \frac{\text{pixelSize}}{\text{resolution}}
$$

Then we snap each pixel's UV down to the nearest cell and sample the **center**
of that cell:

$$
\text{coord} = \text{cell} \cdot \left( \left\lfloor \frac{uv}{\text{cell}} \right\rfloor + 0.5 \right)
$$

```glsl
vec2 cell  = pixelSize / resolution;
vec2 coord = cell * (floor(vUv / cell) + 0.5);
gl_FragColor = texture2D(tDiffuse, coord);
```

Every pixel inside one cell reads the **same** texel — the one at the cell's
center — so an entire cell becomes one flat color block. The $+0.5$ matters: it
samples the center of the cell rather than its corner, which keeps the blocks
visually centered and avoids bias toward one edge.

Because the cell size is derived from `resolution`, the blocks stay square when
the window is a non-square aspect ratio, and the resolution uniform is updated on
resize.

## Why divide by resolution at all?

UV space is always $[0,1]$ regardless of window size, so a fixed UV cell size
would produce different-looking blocks on different screens. Dividing a
pixel-space block size by the resolution converts "8 screen pixels" into the
correct fraction of UV space for the current viewport.

## Controls

- **pixelSize** — the width of one block, in screen pixels. Larger = chunkier.

## Further reading

- Three.js manual, [post-processing](https://threejs.org/manual/#en/post-processing)
