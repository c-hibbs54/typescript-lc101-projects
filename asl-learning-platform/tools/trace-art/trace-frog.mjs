import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(HERE, 'source/kaeru.jpg')

const lib = fs.readFileSync(path.join(HERE, 'tracelib.js'), 'utf8')
const b64 = fs.readFileSync(SOURCE).toString('base64')

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)
const page = await browser.newPage()
page.on('console', (m) => console.log('[page]', m.text()))
await page.setContent(`<img id="i" src="data:image/jpeg;base64,${b64}">`)
await page.addScriptTag({ content: lib })

// Character bbox in the source: x 49..808, y 279..1120 (760 x 842).
// Fit the height into 190 of the 200 viewBox, leaving room for a ground shadow.
const S = 190 / 842

// Head silhouette in SOURCE coords, from the traced face + crown bboxes
// (x 87..744, y 278..759). Two versions:
//   GEN    - generous, used to keep the static headband whole
//   SHRUNK - pulled in, so the fluttering copy of the tails keeps ~50px of
//            overlap tucked back under the head where the seam can't show
const outside = (rx, ry) => `((x-415.5)/${rx})**2 + ((y-518.5)/${ry})**2 > 1`

const opts = {
  palette: [
    { name: 'bg',    rgb: [240, 240, 240], bg: true },
    { name: 'base',  rgb: [80, 64, 104] },
    { name: 'shade', rgb: [64, 48, 80] },
    { name: 'ink',   rgb: [24, 16, 48] },
    { name: 'lime',  rgb: [200, 240, 88] },
  ],
  split: {
    ink: [
      // Moving copy: everything well outside the head. Drawn *first*, so the
      // only part of it that stays visible is the bit beyond the silhouette -
      // the tails. Anything else it caught gets painted over by the body.
      { name: 'tail', where: `x > 420 && ${outside(280, 200)}`, overlap: true },
      // Consumed and discarded: the genuine tails, so the static band stops at
      // the head edge instead of drawing the tails a second time.
      { name: 'discard', where: outside(340, 250) },
    ],
  },
  // Exclude the tails: they move, so a static backing under them would show.
  silhouette: { name: 'backing', where: `!(x > 420 && ${outside(340, 250)})`, erode: 1 },
  solidBacking: true,
  srcX: 49, srcY: 279,
  scale: S,
  offX: (200 - 760 * S) / 2,
  offY: 2,
  closePasses: 3,
  closeMin: 5,
  eps: 1.6,
  tension: 0.6,
  minArea: 80,
  minAreaByClass: { tail: 3000 },
  // `base` too: its holes are the band, eyes, mouth and nostrils, every one of
  // which is repainted by a later layer, and anything that somehow isn't lands
  // on the body-coloured backing. Keeping ~6KB of hole outlines buys nothing.
  solid: ['lime', 'backing', 'base'],
  minHoleArea: 60,
}

const out = await page.evaluate(async (o) => {
  const img = document.getElementById('i')
  await img.decode()
  return window.TRACE(img, o)
}, opts)

out.result = out.result.filter((r) => r.cls !== 'discard')
fs.writeFileSync(path.join(HERE, 'frog-trace.json'), JSON.stringify(out))
console.log('components:', out.result.length, 'total path bytes:', out.result.reduce((a, r) => a + r.d.length, 0))
for (const r of out.result) {
  console.log(`${r.cls.padEnd(6)} area=${String(r.area).padStart(7)} rings=${r.rings} bbox=[${r.bbox.join(', ')}] dlen=${r.d.length}`)
}
await browser.close()
