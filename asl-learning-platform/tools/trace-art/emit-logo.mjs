import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '../../src/components/logoMark.ts')
const t = JSON.parse(fs.readFileSync(path.join(HERE, 'logo-trace.json'), 'utf8'))
const ink = t.result.filter((r) => r.cls === 'ink')
const lime = t.result.filter((r) => r.cls === 'lime')
// Fail loudly rather than emit a half-built mark: the handshape is one linework
// component, and the fill is however many pieces the linework cuts it into.
if (ink.length !== 1) throw new Error(`expected 1 ink component, traced ${ink.length} - re-check the ring cut in trace-logo.mjs`)
if (!lime.length) throw new Error('traced no fill components')
const q = (s) => `'${s}'`
const out = `/**
 * The SignJutsu mark, traced from the supplied logo drawing.
 *
 * The enclosing ring is a true circle in the original, so it is drawn as one
 * rather than traced - crisper at the 28px the navbar renders it at, and a
 * fraction of the path data. Everything else (the raised-fingers handshape and
 * its linework) is traced the same way the mascot is.
 *
 * Paths are in a 0 0 48 48 viewBox. Draw the fill before the linework: the
 * linework carries knocked-out holes that the fill shows through.
 *
 * GENERATED - do not hand-edit. Regenerate with tools/trace-art (see its README).
 */

/** Enclosing ring: stroke it, don't fill it. */
export const MARK_RING = { cx: ${t.ring.cx}, cy: ${t.ring.cy}, r: ${t.ring.r}, width: ${t.ring.w} } as const

/** Handshape fill. */
export const MARK_FILL: readonly string[] = [
${lime.map((r) => `  ${q(r.d)},`).join('\n')}
]

/** Handshape linework, including the crease inside the palm. */
export const MARK_LINE = ${q(ink[0].d)}
`
fs.writeFileSync(OUT, out)
console.log('bytes', out.length, 'fill parts', lime.length)
