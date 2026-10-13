import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '../../src/components/kaeruPaths.ts')
const { result } = JSON.parse(fs.readFileSync(path.join(HERE, 'frog-trace.json'), 'utf8'))
const by = (cls) => result.filter((r) => r.cls === cls)
const pick = (cls, area) => {
  const r = by(cls).find((r) => r.area === area)
  if (!r) throw new Error(`no ${cls} with area ${area}`)
  return r
}
const cx = (r) => (r.bbox[0] + r.bbox[2]) / 2
const cy = (r) => (r.bbox[1] + r.bbox[3]) / 2
const f1 = (v) => +v.toFixed(1)

const tail   = pick('tail', 16223)
const band   = pick('ink', 56149)
const mouth  = pick('ink', 5055)
const pupils = [pick('ink', 3075), pick('ink', 3060)]
const smallInk = by('ink').filter((r) => ![56149, 5055, 3075, 3060].includes(r.area))
const belly  = pick('lime', 60144)
const eyes   = [pick('lime', 7322), pick('lime', 7371)]   // left, right
const backing = by('backing')[0]
const bases  = by('base').map((r) => r.d)
const shades = by('shade').map((r) => r.d)

const q = (s) => `'${s}'`
const list = (arr, indent = '  ') => arr.map((d) => `${indent}${q(d)},`).join('\n')

const eyeGeom = eyes.map((e) => ({
  cx: f1(cx(e)), cy: f1(cy(e)),
  r: f1(Math.max(e.bbox[2] - e.bbox[0], e.bbox[3] - e.bbox[1]) / 2),
}))
const mouthBox = mouth.bbox.map(f1)

const out = `/**
 * Kaeru's artwork, traced from the supplied character drawing.
 *
 * The source is flat vector-style art in five colours, so each region was
 * segmented by colour and its outline traced, simplified, and smoothed into a
 * path. Rebuilding it as SVG (rather than shipping the bitmap) is what lets the
 * parts move independently - see Mascot.tsx.
 *
 * Paths are in a 0 0 200 200 viewBox. Layer order is load-bearing: BASE, then
 * SHADE, then LIME, then INK reproduces the original, because every hole in a
 * lower layer is filled by a higher one.
 *
 * GENERATED - do not hand-edit. Regenerate with tools/trace-art (see its README).
 */

/** Headband and its tails, as one shape that reaches back under the head.
 *  Drawn *before* the body, so only the part beyond the silhouette shows. */
export const KAERU_TAIL = ${q(tail.d)}

/** Solid backing of the whole character, body-coloured and drawn first, so a
 *  hairline anywhere in the layers above shows body rather than the page. */
export const KAERU_BACKING = ${q(backing.d)}

/** Body, head, ears and limbs. */
export const KAERU_BASE: readonly string[] = [
${list(bases)}
]

/** Haunches, feet, the seam across the folded arms, and the lower eyelids. */
export const KAERU_SHADE: readonly string[] = [
${list(shades)}
]

export const KAERU_BELLY = ${q(belly.d)}

/** Eyes, left then right. */
export const KAERU_EYES: readonly string[] = [
${list(eyes.map((e) => e.d))}
]

/** Headband where it lies on the head. */
export const KAERU_BAND = ${q(band.d)}

export const KAERU_MOUTH = ${q(mouth.d)}

/** Slit pupils, left then right. Translated for the cursor glance. */
export const KAERU_PUPILS: readonly string[] = [
${list(pupils.map((p) => p.d))}
]

/** Nostrils and the two dark slivers at the outer eye corners. */
export const KAERU_INK_DETAIL: readonly string[] = [
${list(smallInk.map((r) => r.d))}
]

/** Eye circles, measured off the traced artwork, for the blink lids and the
 *  content-squint arcs that replace the pupils. */
export const KAERU_EYE_GEOM = [
${eyeGeom.map((e) => `  { cx: ${e.cx}, cy: ${e.cy}, r: ${e.r} },`).join('\n')}
] as const

/** Bounding box of the traced mouth: x0, y0, x1, y1. The happy mouth is drawn
 *  from these so it lands where the resting one does. */
export const KAERU_MOUTH_BOX = [${mouthBox.join(', ')}] as const
`
fs.writeFileSync(OUT, out)
console.log('bytes', out.length)
console.log('eyes', JSON.stringify(eyeGeom), 'mouth', JSON.stringify(mouthBox))
console.log('base', bases.length, 'shade', shades.length, 'smallInk', smallInk.length)
