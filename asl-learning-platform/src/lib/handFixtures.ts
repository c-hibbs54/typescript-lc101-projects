import type { HandLandmarks, Point3D } from '../types/asl'

/**
 * A forward model of a signing hand: joint angles in, 21 MediaPipe landmarks out.
 *
 * There is no webcam in a test run and no recorded landmark corpus in this
 * repo, so the classifier's prototypes and its regression tests both need
 * *some* source of plausible 21-point hands. Writing those out as literal
 * coordinates does not scale past a couple of shapes, and cannot express the
 * thing that matters most here — that a finger folds at three joints, not one.
 * So describe each letter the way a person would (fingers curved until the tips
 * meet the thumb, hand tipped forward) and let the model place the points.
 *
 * The model is deliberately three-dimensional. Fingers curl *toward the camera*
 * when the palm faces it, which is movement in z, and flattening that to the
 * image plane is what makes a fist and a hook look alike. MediaPipe reports z
 * in roughly the same units as x and y, with the wrist at the origin and
 * smaller meaning nearer, so that is the convention here.
 *
 * Nothing in the app imports this — it exists for the tests and for the
 * measurement step that generates `LETTER_PROTOTYPES`.
 */

// ---------------------------------------------------------------------------
// Canonical palm
// ---------------------------------------------------------------------------

/** Wrist -> middle knuckle. Every other length below is a multiple of it. */
const PALM = 0.3

const WRIST: Point3D = { x: 0.5, y: 0.9, z: 0 }
const THUMB_CMC: Point3D = { x: 0.43, y: 0.83, z: 0.01 }
const THUMB_MCP: Point3D = { x: 0.37, y: 0.75, z: 0.01 }
const INDEX_MCP: Point3D = { x: 0.42, y: 0.62, z: 0 }
const MIDDLE_MCP: Point3D = { x: 0.5, y: 0.6, z: 0 }
const RING_MCP: Point3D = { x: 0.57, y: 0.62, z: 0 }
const PINKY_MCP: Point3D = { x: 0.63, y: 0.66, z: 0.01 }

/** Phalanx lengths as multiples of PALM: [proximal, intermediate, distal]. */
const SEGMENTS = {
  index: [0.5, 0.3, 0.22],
  middle: [0.54, 0.32, 0.23],
  ring: [0.5, 0.3, 0.21],
  pinky: [0.38, 0.22, 0.17],
} as const

/** Thumb: [metacarpophalangeal -> interphalangeal, interphalangeal -> tip]. */
const THUMB_SEGMENTS = [0.32, 0.26] as const

/** Out of the palm, toward the camera. Fingers flex this way. */
const PALM_FORWARD: Point3D = { x: 0, y: 0, z: -1 }

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

function rad(deg: number): number {
  return (deg * Math.PI) / 180
}

function add(p: Point3D, v: Point3D, scale = 1): Point3D {
  return { x: p.x + v.x * scale, y: p.y + v.y * scale, z: p.z + v.z * scale }
}

function cross(a: Point3D, b: Point3D): Point3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function unit(v: Point3D): Point3D {
  const len = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

/** Rotate `v` about unit axis `k` by `deg` (Rodrigues). */
function rotateAbout(v: Point3D, k: Point3D, deg: number): Point3D {
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  const kv = cross(k, v)
  const kd = k.x * v.x + k.y * v.y + k.z * v.z
  return {
    x: v.x * c + kv.x * s + k.x * kd * (1 - c),
    y: v.y * c + kv.y * s + k.y * kd * (1 - c),
    z: v.z * c + kv.z * s + k.z * kd * (1 - c),
  }
}

/**
 * A direction from two angles: `heading` swings within the image plane (0 =
 * straight up, +90 = toward the pinky side), `lift` tips out of it (+ = toward
 * the camera, - = behind the palm).
 */
function direction(headingDeg: number, liftDeg: number): Point3D {
  const h = rad(headingDeg)
  const l = rad(liftDeg)
  return { x: Math.sin(h) * Math.cos(l), y: -Math.cos(h) * Math.cos(l), z: -Math.sin(l) }
}

/**
 * Walks a digit out from its knuckle. Each joint's flex is cumulative and bends
 * the chain toward the palm side, about the axis perpendicular to both the
 * digit and the palm normal — which is what a real knuckle does.
 */
function chain(
  base: Point3D,
  baseDir: Point3D,
  lengths: readonly number[],
  flex: readonly number[],
): Point3D[] {
  const axis = unit(cross(baseDir, PALM_FORWARD))
  const out: Point3D[] = []
  let here = base
  let bend = 0
  for (let i = 0; i < lengths.length; i++) {
    bend += flex[i]
    const dir = rotateAbout(baseDir, axis, bend)
    here = add(here, dir, lengths[i] * PALM)
    out.push(here)
  }
  return out
}

// ---------------------------------------------------------------------------
// Pose vocabulary
// ---------------------------------------------------------------------------

/** Flex at [knuckle, middle joint, fingertip joint], in degrees. */
export const FINGER_SHAPES = {
  /** Fully extended. */
  straight: [3, 3, 2],
  /** Folded into a fist: every joint near its limit. */
  fist: [80, 100, 55],
  /**
   * X's hook: crooked hard at the middle joint, but the knuckle stays open and
   * the last joint barely folds. The middle joint is within ten degrees of a
   * fist's, which is why a PIP angle alone cannot tell X from A — and the tip
   * still reaches half again as far, which is why `indexExtension` can.
   */
  hook: [30, 90, 15],
  /** C's open curve — nothing touching the thumb. */
  curveWide: [30, 45, 20],
  /** O's closed curve — the tip comes round to meet the thumb. */
  curveTight: [48, 72, 42],
  /** E: folded over the thumb, last joint open so the tips stand out in front. */
  clawed: [55, 95, 10],
  /** D/F's companion fingers: folded until the tip meets the thumb. */
  toThumb: [55, 85, 45],
} as const

export type FingerShape = keyof typeof FINGER_SHAPES

export interface FingerPose {
  shape: FingerShape
  /** Sideways fan at the knuckle: + toward the pinky. */
  splay?: number
}

export interface ThumbPose {
  /** Swing within the palm plane: 0 = up alongside the fingers, +90 = across toward the pinky. */
  heading: number
  /** Out of the palm plane: + = in front (across the fingers), - = tucked behind them. */
  lift: number
  /** Flex at the thumb's own joint. */
  flex: number
}

export interface HandPose {
  thumb: ThumbPose
  index: FingerPose
  middle: FingerPose
  ring: FingerPose
  pinky: FingerPose
  /** Whole-hand rotation in the image plane: 0 = fingers up, 90 = sideways, 180 = down. */
  rotate?: number
}

/** Natural fan of a relaxed hand, before any per-letter splay. */
const BASE_SPLAY = { index: -8, middle: -2, ring: 5, pinky: 12 } as const

const MCP: Record<'index' | 'middle' | 'ring' | 'pinky', Point3D> = {
  index: INDEX_MCP,
  middle: MIDDLE_MCP,
  ring: RING_MCP,
  pinky: PINKY_MCP,
}

function rotateInPlane(p: Point3D, deg: number): Point3D {
  if (!deg) return p
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  const dx = p.x - WRIST.x
  const dy = p.y - WRIST.y
  return { x: WRIST.x + dx * c - dy * s, y: WRIST.y + dx * s + dy * c, z: p.z }
}

/** Builds the 21 landmarks for a pose, in MediaPipe's order. */
export function buildHand(pose: HandPose): HandLandmarks {
  const finger = (name: 'index' | 'middle' | 'ring' | 'pinky') => {
    const spec = pose[name]
    const dir = direction(BASE_SPLAY[name] + (spec.splay ?? 0), 0)
    return chain(MCP[name], dir, SEGMENTS[name], FINGER_SHAPES[spec.shape])
  }

  const thumbDir = direction(pose.thumb.heading, pose.thumb.lift)
  const thumb = chain(THUMB_MCP, thumbDir, THUMB_SEGMENTS, [0, pose.thumb.flex])

  const points: Point3D[] = [
    WRIST,
    THUMB_CMC,
    THUMB_MCP,
    ...thumb,
    INDEX_MCP,
    ...finger('index'),
    MIDDLE_MCP,
    ...finger('middle'),
    RING_MCP,
    ...finger('ring'),
    PINKY_MCP,
    ...finger('pinky'),
  ]
  return points.map((p) => rotateInPlane(p, pose.rotate ?? 0))
}

// ---------------------------------------------------------------------------
// The alphabet
// ---------------------------------------------------------------------------

/** Rotation that puts wrist -> knuckles level with the horizon (G, H). */
const SIDEWAYS = 81
/**
 * Rotation for Q and P. Not 180: nobody aims those at the floor, they tip the
 * hand forward and down maybe 40 degrees past horizontal, and pretending
 * otherwise is what made Q unrecognizable.
 */
const DOWNWARD = 140

const fist: FingerPose = { shape: 'fist' }

/** One reference pose per static letter. */
export const LETTER_POSES: Record<string, HandPose> = {
  // Fist with the thumb standing alongside the index, not across it.
  A: { thumb: { heading: -10, lift: 15, flex: 10 }, index: fist, middle: fist, ring: fist, pinky: fist },
  // Flat hand, fingers together and straight, thumb folded in across the palm.
  B: {
    thumb: { heading: 70, lift: 25, flex: 25 },
    index: { shape: 'straight', splay: 7 },
    middle: { shape: 'straight', splay: 2 },
    ring: { shape: 'straight', splay: -4 },
    pinky: { shape: 'straight', splay: -9 },
  },
  // An open curve. The thumb is held away from the fingertips - that gap is the
  // whole difference from O, so the pose has to actually contain it.
  C: {
    thumb: { heading: 46, lift: 26, flex: 14 },
    index: { shape: 'curveWide' },
    middle: { shape: 'curveWide' },
    ring: { shape: 'curveWide' },
    pinky: { shape: 'curveWide' },
  },
  // Index alone straight up; the other three fold down onto the thumb.
  D: {
    thumb: { heading: 22, lift: 30, flex: 45 },
    index: { shape: 'straight', splay: 6 },
    middle: { shape: 'toThumb' },
    ring: { shape: 'toThumb' },
    pinky: { shape: 'toThumb' },
  },
  // Fingers folded down over the thumb, which is tucked underneath them.
  E: {
    thumb: { heading: 74, lift: 32, flex: 40 },
    index: { shape: 'clawed' },
    middle: { shape: 'clawed' },
    ring: { shape: 'clawed' },
    pinky: { shape: 'clawed' },
  },
  // Index tip and thumb tip meet; the other three stay up and together.
  F: {
    thumb: { heading: 24, lift: 34, flex: 40 },
    index: { shape: 'curveTight' },
    middle: { shape: 'straight', splay: 2 },
    ring: { shape: 'straight', splay: -4 },
    pinky: { shape: 'straight', splay: -9 },
  },
  // Index and thumb extended alongside each other, hand level. Twin of Q.
  G: {
    thumb: { heading: 6, lift: 18, flex: 8 },
    index: { shape: 'straight', splay: 6 },
    middle: fist,
    ring: fist,
    pinky: fist,
    rotate: SIDEWAYS,
  },
  // Index and middle out together, hand level. Twin of U.
  H: {
    thumb: { heading: 64, lift: 25, flex: 30 },
    index: { shape: 'straight', splay: 5 },
    middle: { shape: 'straight', splay: -1 },
    ring: fist,
    pinky: fist,
    rotate: SIDEWAYS,
  },
  // Pinky alone.
  I: {
    thumb: { heading: 70, lift: 25, flex: 30 },
    index: fist,
    middle: fist,
    ring: fist,
    pinky: { shape: 'straight', splay: 4 },
  },
  // Index and middle in a V with the thumb standing up between them. Twin of P.
  K: {
    thumb: { heading: 24, lift: 18, flex: 18 },
    index: { shape: 'straight', splay: -10 },
    middle: { shape: 'straight', splay: 10 },
    ring: fist,
    pinky: fist,
  },
  // Thumb and index at a right angle.
  L: {
    thumb: { heading: -84, lift: 8, flex: 5 },
    index: { shape: 'straight', splay: 6 },
    middle: fist,
    ring: fist,
    pinky: fist,
  },
  // Fist, thumb tucked behind three fingers - deepest of the four, tip out
  // toward the pinky side.
  M: { thumb: { heading: 92, lift: -28, flex: 12 }, index: fist, middle: fist, ring: fist, pinky: fist },
  // Same, but only behind two - so the tip stops nearer the middle of the palm.
  N: { thumb: { heading: 74, lift: -24, flex: 40 }, index: fist, middle: fist, ring: fist, pinky: fist },
  // Every fingertip comes round to meet the thumb, closing the ring.
  O: {
    thumb: { heading: 30, lift: 30, flex: 44 },
    index: { shape: 'curveTight' },
    middle: { shape: 'curveTight' },
    ring: { shape: 'curveTight' },
    pinky: { shape: 'curveTight' },
  },
  // K, tipped forward and down. Twin of K.
  P: {
    thumb: { heading: 24, lift: 18, flex: 18 },
    index: { shape: 'straight', splay: -10 },
    middle: { shape: 'straight', splay: 10 },
    ring: fist,
    pinky: fist,
    rotate: DOWNWARD,
  },
  // G, tipped forward and down. Twin of G.
  Q: {
    thumb: { heading: 6, lift: 18, flex: 8 },
    index: { shape: 'straight', splay: 6 },
    middle: fist,
    ring: fist,
    pinky: fist,
    rotate: DOWNWARD,
  },
  // Index and middle crossed over one another.
  R: {
    thumb: { heading: 64, lift: 25, flex: 30 },
    index: { shape: 'straight', splay: 15 },
    middle: { shape: 'straight', splay: -11 },
    ring: fist,
    pinky: fist,
  },
  // Fist with the thumb across the front of the fingers.
  S: { thumb: { heading: 62, lift: 34, flex: 46 }, index: fist, middle: fist, ring: fist, pinky: fist },
  // Fist with the thumb tip poking up between index and middle.
  T: { thumb: { heading: 26, lift: 34, flex: 10 }, index: fist, middle: fist, ring: fist, pinky: fist },
  // Index and middle up TOGETHER - near parallel, which is the whole
  // difference from V. Twin of H.
  U: {
    thumb: { heading: 64, lift: 25, flex: 30 },
    index: { shape: 'straight', splay: 6 },
    middle: { shape: 'straight', splay: 0 },
    ring: fist,
    pinky: fist,
  },
  // Index and middle up and APART. Splayed wide enough to be unmistakable,
  // because that angle is the only thing separating it from U.
  V: {
    thumb: { heading: 64, lift: 25, flex: 30 },
    index: { shape: 'straight', splay: -18 },
    middle: { shape: 'straight', splay: 14 },
    ring: fist,
    pinky: fist,
  },
  // Three fingers up and apart, pinky down under the thumb.
  W: {
    thumb: { heading: 78, lift: 25, flex: 35 },
    index: { shape: 'straight', splay: -12 },
    middle: { shape: 'straight', splay: 0 },
    ring: { shape: 'straight', splay: 12 },
    pinky: fist,
  },
  // Index hooked over an otherwise closed fist.
  X: { thumb: { heading: -4, lift: 15, flex: 10 }, index: { shape: 'hook' }, middle: fist, ring: fist, pinky: fist },
  // Thumb and pinky out, everything else down.
  Y: {
    thumb: { heading: -80, lift: 8, flex: 5 },
    index: fist,
    middle: fist,
    ring: fist,
    pinky: { shape: 'straight', splay: 10 },
  },
}

/** The 21 landmarks for a letter's reference pose. */
export function buildLetterHand(letter: string): HandLandmarks {
  const pose = LETTER_POSES[letter]
  if (!pose) throw new Error(`no reference pose for ${letter}`)
  return buildHand(pose)
}
