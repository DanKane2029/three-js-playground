# Bloom Field

A ring of brightly colored shapes that **glow**, bleeding light into the pixels
around them. Bloom is one of the most recognizable post-processing effects — it's
what makes bright things feel genuinely bright on a display that can't actually
emit more light than "white."

Source: [`src/apps/BloomField.ts`](../../../src/apps/BloomField.ts)

## What bloom simulates

Real cameras and eyes scatter light: look at a bright light and it "blooms" into
a soft halo. On a monitor, the brightest color is pure white — you can't make a
pixel *brighter* than that. Bloom fakes the perception of extreme brightness by
**spreading** a bright region's light into its neighbors, so the eye reads it as
dazzling.

## The pipeline

Bloom is a post-processing effect (see [Pixelate](../pixelate/) for the basics of
render-to-texture). Three.js's `UnrealBloomPass` runs four conceptual stages:

```
1. Bright pass   →  2. Downsample + blur  →  3. Upsample + combine  →  4. Composite
   keep only the      build a pyramid of       add the blurred          add the glow
   bright pixels      progressively blurrier    levels back together     back onto the
                      copies                                             original image
```

### 1. Bright pass (threshold)

First we isolate the pixels worth glowing. Brightness is measured as **luminance**
— a weighted sum of the channels that matches human sensitivity (we're most
sensitive to green):

$$
L = 0.21\,R + 0.72\,G + 0.07\,B
$$

Pixels below the **threshold** are discarded; pixels above it are kept (with a
soft "knee" so the transition isn't a hard edge). This is why the shapes in this
app use bright, saturated `MeshBasicMaterial` colors — they clear the threshold.

### 2. Multi-scale Gaussian blur

The bright pixels are blurred — but a glow needs a *wide*, soft falloff, and a
wide blur is expensive. Two tricks make it cheap:

- **Separable Gaussian.** A 2D Gaussian blur can be done as a horizontal blur
  followed by a vertical one. That turns an $O(k^2)$ kernel into two $O(k)$
  passes:

  $$
  G(x, y) = G(x)\,G(y), \qquad G(x) = \frac{1}{\sqrt{2\pi}\,\sigma}\,e^{-x^2 / 2\sigma^2}
  $$

- **Mip pyramid.** The image is repeatedly halved in resolution, and each smaller
  copy is blurred. A small blur on a half-size image covers twice the area of the
  full-size image, so combining several levels yields a very wide glow for a
  fraction of the cost. This is the "Unreal" bloom technique.

### 3 & 4. Combine and composite

The blurred pyramid levels are added back together (weighted by **radius**, which
biases toward wider or tighter levels), scaled by **strength**, and added on top
of the original rendered image. Finally an `OutputPass` applies tone mapping and
converts to sRGB for display.

## The composer in this app

```
RenderPass       // draw the rotating shapes into a texture
UnrealBloomPass  // threshold → blur pyramid → additive glow
OutputPass       // tone map + sRGB
```

Because bloom needs the app to own its render pipeline, `BloomField` overrides
the base `render()` method to call `composer.render()` instead of the default
`renderer.render(scene, camera)`.

## Controls

- **strength** — overall intensity of the glow that's added back.
- **radius** — how far the glow spreads (biases the pyramid levels).
- **threshold** — the luminance cutoff for what glows. Lower = more of the image
  blooms.

## Further reading

- [Physically based bloom](https://learnopengl.com/Guest-Articles/2022/Phys.-Based-Bloom) (LearnOpenGL)
- Three.js [UnrealBloomPass](https://threejs.org/examples/#webgl_postprocessing_unreal_bloom)
