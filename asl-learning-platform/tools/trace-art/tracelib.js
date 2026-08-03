// Runs inside the page. Traces flat-colour regions of an image into SVG paths.
window.TRACE = function trace(img, opts) {
  const W = img.naturalWidth, H = img.naturalHeight
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0)
  const px = g.getImageData(0, 0, W, H).data

  const pal = opts.palette            // [{name, rgb, bg?}]
  const N = W * H
  const cls = new Uint8Array(N)       // index into pal
  for (let i = 0; i < N; i++) {
    const r = px[i*4], gg = px[i*4+1], b = px[i*4+2], a = px[i*4+3]
    if (a < 128) { cls[i] = 0; continue }
    let best = 0, bd = Infinity
    for (let k = 0; k < pal.length; k++) {
      const p = pal[k].rgb
      const d = (r-p[0])**2 + (gg-p[1])**2 + (b-p[2])**2
      if (d < bd) { bd = d; best = k }
    }
    cls[i] = best
  }

  // JPEG edge halos read as background, so two regions that touch in the
  // original end up separated by a hairline of "nothing". Close those: a
  // background pixel with enough coloured neighbours joins the majority.
  const BG = pal.findIndex((p) => p.bg)
  const NB8 = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]
  for (let pass = 0; pass < (opts.closePasses ?? 0); pass++) {
    const next = cls.slice()
    for (let y = 1; y < H-1; y++) for (let x = 1; x < W-1; x++) {
      const i = y*W + x
      if (cls[i] !== BG) continue
      const counts = new Map()
      let nonBg = 0
      for (const [dx, dy] of NB8) {
        const k = cls[(y+dy)*W + (x+dx)]
        if (k !== BG) { nonBg++; counts.set(k, (counts.get(k) || 0) + 1) }
      }
      if (nonBg < (opts.closeMin ?? 6)) continue
      let bk = BG, bc = -1
      for (const [k, c] of counts) if (c > bc) { bc = c; bk = k }
      next[i] = bk
    }
    cls.set(next)
  }

  // Grow every region by a pixel so the traced outlines overlap instead of
  // leaving a seam. Later layers cover the overlap, so nothing shifts visually.
  function grow(mask, n) {
    let m = mask
    for (let k = 0; k < n; k++) {
      const out = m.slice()
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y*W + x
        if (!m[i]) continue
        if (x > 0)   out[i-1] = 1
        if (x < W-1) out[i+1] = 1
        if (y > 0)   out[i-W] = 1
        if (y < H-1) out[i+W] = 1
      }
      m = out
    }
    return m
  }

  // --- masks, with optional pre-split predicates -------------------------
  const masks = []   // {name, mask}
  for (let k = 0; k < pal.length; k++) {
    if (pal[k].bg) continue
    const base = new Uint8Array(N)
    for (let i = 0; i < N; i++) if (cls[i] === k) base[i] = 1
    const splits = (opts.split || {})[pal[k].name]
    if (!splits) { masks.push({ name: pal[k].name, mask: base }); continue }
    const taken = new Uint8Array(N)
    for (const s of splits) {
      const m = new Uint8Array(N)
      const fn = new Function('x', 'y', 'return ' + s.where)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y*W + x
        if (base[i] && fn(x, y)) { m[i] = 1; if (!s.overlap) taken[i] = 1 }
      }
      masks.push({ name: s.name, mask: m })
    }
    const rest = new Uint8Array(N)
    for (let i = 0; i < N; i++) if (base[i] && !taken[i]) rest[i] = 1
    masks.push({ name: pal[k].name, mask: rest })
  }

  const DILATE = opts.dilate ?? 0
  if (DILATE) for (const m of masks) m.mask = grow(m.mask, DILATE)

  // A solid backing of the whole character, pulled in a pixel so it can never
  // poke past a real edge. Drawn first and body-coloured, it means a hairline
  // left anywhere in the layers above shows body rather than the page.
  if (opts.silhouette) {
    const sil = new Uint8Array(N)
    const fn = new Function('x', 'y', 'return ' + (opts.silhouette.where || 'true'))
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y*W + x
      if (cls[i] !== BG && fn(x, y)) sil[i] = 1
    }
    let m = sil
    for (let k = 0; k < (opts.silhouette.erode ?? 1); k++) {
      const out = m.slice()
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y*W + x
        if (m[i]) continue
        if (x > 0)   out[i-1] = 0
        if (x < W-1) out[i+1] = 0
        if (y > 0)   out[i-W] = 0
        if (y < H-1) out[i+W] = 0
      }
      m = out
    }
    masks.unshift({ name: opts.silhouette.name || 'silhouette', mask: m })
  }

  // --- connected components (4-conn) ------------------------------------
  function components(mask) {
    const seen = new Uint8Array(N), out = []
    const stack = new Int32Array(N)
    for (let s = 0; s < N; s++) {
      if (!mask[s] || seen[s]) continue
      let sp = 0; stack[sp++] = s; seen[s] = 1
      const pix = []
      let x0 = W, y0 = H, x1 = -1, y1 = -1
      while (sp) {
        const i = stack[--sp]; pix.push(i)
        const x = i % W, y = (i - x) / W
        if (x < x0) x0 = x; if (x > x1) x1 = x
        if (y < y0) y0 = y; if (y > y1) y1 = y
        if (x > 0   && mask[i-1] && !seen[i-1]) { seen[i-1] = 1; stack[sp++] = i-1 }
        if (x < W-1 && mask[i+1] && !seen[i+1]) { seen[i+1] = 1; stack[sp++] = i+1 }
        if (y > 0   && mask[i-W] && !seen[i-W]) { seen[i-W] = 1; stack[sp++] = i-W }
        if (y < H-1 && mask[i+W] && !seen[i+W]) { seen[i+W] = 1; stack[sp++] = i+W }
      }
      out.push({ pix, bbox: [x0, y0, x1, y1], area: pix.length })
    }
    return out.sort((a, b) => b.area - a.area)
  }

  // --- Moore-neighbour boundary trace on a local grid -------------------
  // grid: Uint8Array of (w+2)*(h+2) with a 1px empty border, so no bounds checks.
  function contour(grid, w, h, sx, sy) {
    const at = (x, y) => grid[y*w + x]
    const D = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]
    const pts = [[sx, sy]]
    let cx = sx, cy = sy, bx = sx - 1, by = sy      // backtrack: known-empty
    const seenState = new Set([`${cx},${cy},${bx},${by}`])
    for (let guard = 0; guard < w*h*8; guard++) {
      // index of the backtrack direction, then scan clockwise from it
      let d0 = 0
      for (let k = 0; k < 8; k++) if (cx + D[k][0] === bx && cy + D[k][1] === by) { d0 = k; break }
      let nx = -1, ny = -1, pbx = bx, pby = by, found = false
      for (let k = 1; k <= 8; k++) {
        const d = D[(d0 + k) % 8]
        const tx = cx + d[0], ty = cy + d[1]
        if (at(tx, ty)) { nx = tx; ny = ty; found = true; break }
        pbx = tx; pby = ty
      }
      if (!found) break                             // isolated pixel
      bx = pbx; by = pby; cx = nx; cy = ny
      const state = `${cx},${cy},${bx},${by}`
      if (seenState.has(state)) break                // closed the ring
      seenState.add(state)
      pts.push([cx, cy])
    }
    // The walk closes by stepping back onto the start pixel, so the ring would
    // end with a duplicate of its first point.
    while (pts.length > 1 && pts[pts.length-1][0] === pts[0][0] && pts[pts.length-1][1] === pts[0][1]) pts.pop()
    return pts
  }

  function rdp(pts, eps) {
    if (pts.length < 3) return pts.slice()
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length-1] = 1
    const stack = [[0, pts.length-1]]
    while (stack.length) {
      const [a, b] = stack.pop()
      const [ax, ay] = pts[a], [bx, by] = pts[b]
      const dx = bx-ax, dy = by-ay, len = Math.hypot(dx, dy)
      let bi = -1, bd = -1
      for (let i = a+1; i < b; i++) {
        const d = len < 1e-9
          ? Math.hypot(pts[i][0]-ax, pts[i][1]-ay)
          : Math.abs((pts[i][0]-ax)*dy - (pts[i][1]-ay)*dx) / len
        if (d > bd) { bd = d; bi = i }
      }
      if (bd > eps && bi > 0) { keep[bi] = 1; stack.push([a, bi], [bi, b]) }
    }
    return pts.filter((_, i) => keep[i])
  }

  // Closed Catmull-Rom -> cubic Bezier.
  function toPath(pts, map, k) {
    const n = pts.length
    if (n < 3) return ''
    const P = pts.map(map)
    const f = (v) => (Math.round(v * 10) / 10)
    let d = `M${f(P[0][0])} ${f(P[0][1])}`
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n]
      const c1 = [p1[0] + (p2[0]-p0[0])*k/6, p1[1] + (p2[1]-p0[1])*k/6]
      const c2 = [p2[0] - (p3[0]-p1[0])*k/6, p2[1] - (p3[1]-p1[1])*k/6]
      d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
    }
    return d + 'Z'
  }

  // Outer + hole contours for one component.
  function shapeOf(comp, eps) {
    const [x0, y0, x1, y1] = comp.bbox
    const w = x1 - x0 + 3, h = y1 - y0 + 3
    const grid = new Uint8Array(w * h)
    for (const i of comp.pix) {
      const x = i % W, y = (i - x) / W
      grid[(y - y0 + 1) * w + (x - x0 + 1)] = 1
    }
    const off = ([x, y]) => [x + x0 - 1, y + y0 - 1]
    // outer: topmost-leftmost filled pixel
    let sx = -1, sy = -1
    for (let y = 0; y < h && sy < 0; y++) for (let x = 0; x < w; x++) if (grid[y*w+x]) { sx = x; sy = y; break }
    const rings = [rdp(contour(grid, w, h, sx, sy).map(off), eps)]
    // holes: complement pixels unreachable from the border
    const out = new Uint8Array(w * h)
    const st = [0]; out[0] = 1
    while (st.length) {
      const i = st.pop(), x = i % w, y = (i - x) / w
      const push = (j) => { if (j >= 0 && j < w*h && !out[j] && !grid[j]) { out[j] = 1; st.push(j) } }
      if (x > 0) push(i-1); if (x < w-1) push(i+1)
      if (y > 0) push(i-w); if (y < h-1) push(i+w)
    }
    const holeMask = new Uint8Array(w * h)
    for (let i = 0; i < w*h; i++) if (!grid[i] && !out[i]) holeMask[i] = 1
    // label holes locally
    const seen = new Uint8Array(w * h)
    for (let s = 0; s < w*h; s++) {
      if (!holeMask[s] || seen[s]) continue
      const st2 = [s]; seen[s] = 1; const pix = []
      while (st2.length) {
        const i = st2.pop(); pix.push(i)
        const x = i % w, y = (i - x) / w
        const push = (j) => { if (holeMask[j] && !seen[j]) { seen[j] = 1; st2.push(j) } }
        if (x > 0) push(i-1); if (x < w-1) push(i+1)
        if (y > 0) push(i-w); if (y < h-1) push(i+w)
      }
      if (pix.length < (opts.minHoleArea ?? 40)) continue
      let hx = -1, hy = -1
      for (const i of pix) { const y = (i - i%w)/w, x = i%w; if (hy < 0 || y < hy || (y === hy && x < hx)) { hx = x; hy = y } }
      rings.push(rdp(contour(holeMask, w, h, hx, hy).map(off), eps))
    }
    return rings
  }

  const S = opts.scale, OX = opts.offX, OY = opts.offY, SX = opts.srcX, SY = opts.srcY
  const map = ([x, y]) => [(x - SX) * S + OX, (y - SY) * S + OY]
  const eps = opts.eps ?? 2
  const k = opts.tension ?? 1

  const result = []
  for (const { name, mask } of masks) {
    for (const comp of components(mask)) {
      const minA = (opts.minAreaByClass || {})[name] ?? opts.minArea ?? 60
      if (comp.area < minA) continue
      let rings = shapeOf(comp, eps)
      if ((opts.solid || []).includes(name)) rings = rings.slice(0, 1)
      const d = rings.map((r) => toPath(r, map, k)).join('')
      const [x0, y0, x1, y1] = comp.bbox
      result.push({
        cls: name, area: comp.area, d,
        bbox: [
          +map([x0, y0])[0].toFixed(1), +map([x0, y0])[1].toFixed(1),
          +map([x1, y1])[0].toFixed(1), +map([x1, y1])[1].toFixed(1),
        ],
        rings: rings.length,
      })
    }
  }
  return { W, H, result }
}
