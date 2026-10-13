# trace-art

Turns the flat-colour character drawings in `source/` into the SVG path modules the app renders:

| source            | generated                        | rendered by                   |
| ----------------- | -------------------------------- | ----------------------------- |
| `source/kaeru.jpg` | `src/components/kaeruPaths.ts`  | `src/components/Mascot.tsx`   |
| `source/mark.jpg`  | `src/components/logoMark.ts`    | `src/components/Logo.tsx`     |

## Why trace instead of shipping the image

A bitmap can only be moved as one rigid block. Tracing each colour region into its own path is
what lets the mascot breathe, blink, follow the cursor and flutter his headband tails
independently — and it keeps the logo crisp at the 32px the navbar renders it at.

The paths carry **no colour**. Every fill comes from a CSS custom property, which is why the same
artwork works in both themes and why the palette is retunable without re-tracing.

## Regenerating

```sh
cd tools/trace-art
npm i -D playwright            # only dependency; needs a Chromium
node trace-frog.mjs && node emit-frog.mjs
node trace-logo.mjs && node emit-logo.mjs
```

`CHROMIUM_PATH` overrides the browser binary if Playwright can't find one.

`trace-*.mjs` writes an intermediate `*-trace.json` (all components, with areas and bounding
boxes); `emit-*.mjs` turns that into the typed module. The split exists because the emitters pick
components out **by area** — if you replace the source art those numbers change and the emitters
will throw rather than silently mislabel a limb. Run the trace step, read the printed component
table, then update the areas in the emitter.

## How it works

`tracelib.js` runs in a page (it needs `canvas`) and does, per colour:

1. **Classify** every pixel to its nearest palette entry. Antialiased edge pixels land on whichever
   side they are closer to, which gives clean boundaries.
2. **Close JPEG halos** — a light fringe between two dark regions classifies as background and
   would leave a hairline gap, so a background pixel with enough coloured neighbours joins the
   majority (`closePasses`, `closeMin`).
3. **Label** 4-connected components and drop specks below `minArea`.
4. **Trace** each component's outline with Moore-neighbour boundary following, plus the outlines of
   any enclosed holes, simplify with Ramer–Douglas–Peucker (`eps`), and smooth the result into
   cubic Béziers (`tension`).

Two options matter when reading the output:

- `solid: [...]` keeps only a component's outer ring. The eyes use it so the pupils — which slide
  for the cursor glance — never expose a knocked-out hole behind them.
- `silhouette: {...}` emits one eroded backing shape for the whole character. Drawn first and
  body-coloured, it means a hairline left anywhere above it shows body rather than the page.

`split: { <colour>: [...] }` carves a colour into extra named masks by predicate. That is how the
headband tails become their own path so they can flutter: the moving copy reaches back under the
head (`overlap: true`, so it stays in the parent mask too) and is drawn *before* the body, so the
only part of it that stays visible is the bit beyond the silhouette.

## Layer order is load-bearing

Regions are traced independently, so nothing enforces stacking — the renderer has to get it right.
For the mascot: backing → base → shade → accent → linework, because every hole in a lower layer is
filled by a higher one. For the mark: fill before linework, and the linework needs
`fill-rule: evenodd` (every traced ring winds the same way, so the default `nonzero` would fill the
enclosed areas and turn the mark into a blob).
