import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(HERE, 'source/mark.jpg')

const lib = fs.readFileSync(path.join(HERE, 'tracelib.js'), 'utf8')
const b64 = fs.readFileSync(SOURCE).toString('base64')

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)
const page = await browser.newPage()
page.on('console', (m) => console.log('[page]', m.text()))
await page.setContent(`<img id="i" src="data:image/jpeg;base64,${b64}">`)
await page.addScriptTag({ content: lib })

// Ring measured off the source: outer edge x 162..615 at the vertical middle,
// 14px thick, so centre (388.5, 507.5), outer radius 226.5.
const RING = { cx: 388.5, cy: 507.5, rOuter: 226.5, thick: 14 }
const S = 46 / (RING.rOuter * 2)          // fit the mark into 48 with 1 unit of padding

const opts = {
  palette: [
    { name: 'bg',   rgb: [244, 244, 244], bg: true },
    { name: 'ink',  rgb: [1, 2, 2] },
    { name: 'lime', rgb: [202, 254, 68] },
    // The wordmark's violet, kept in the palette so its pixels classify to
    // themselves instead of being dragged into the ink or the background.
    { name: 'word', rgb: [43, 1, 74] },
  ],
  split: {
    // The ring is a perfect circle - it is drawn as one, not traced, so anything
    // out near the rim is discarded here.
    ink: [{ name: 'discard', where: `Math.hypot(x-${RING.cx}, y-${RING.cy}) > 200 || y > 745` }],
    lime: [{ name: 'discard', where: 'y > 745' }],
  },
  srcX: RING.cx - RING.rOuter,
  srcY: RING.cy - RING.rOuter,
  scale: S,
  offX: 1,
  offY: 1,
  closePasses: 3,
  closeMin: 5,
  eps: 1.1,
  tension: 0.6,
  minArea: 200,
  solid: ['lime'],
  minHoleArea: 120,
}

const out = await page.evaluate(async (o) => {
  const img = document.getElementById('i')
  await img.decode()
  return window.TRACE(img, o)
}, opts)

out.result = out.result.filter((r) => r.cls !== 'discard' && r.cls !== 'word')
out.ring = {
  cx: +((RING.cx - opts.srcX) * S + 1).toFixed(2),
  cy: +((RING.cy - opts.srcY) * S + 1).toFixed(2),
  r: +((RING.rOuter - RING.thick / 2) * S).toFixed(2),
  w: +(RING.thick * S).toFixed(2),
}
fs.writeFileSync(path.join(HERE, 'logo-trace.json'), JSON.stringify(out))
console.log('ring', JSON.stringify(out.ring))
for (const r of out.result) {
  console.log(`${r.cls.padEnd(5)} area=${String(r.area).padStart(6)} rings=${r.rings} bbox=[${r.bbox.join(', ')}] dlen=${r.d.length}`)
}
await browser.close()
