import { FEATURE_NAMES, LETTER_PROTOTYPES } from './classifier'
import type { HandRole } from '../types/asl'

/**
 * Pose data and pure drawing geometry for the ghost-hand reference illustration.
 *
 * Everything here is plain math on the same pose vectors the classifier uses -
 * no React, no DOM - so the illustration's framing can be unit tested against
 * real curriculum values instead of eyeballed. {@link GhostHand} only turns the
 * result into SVG elements.
 */

/**
 * Illustration-only poses for signs that don't have a classifier prototype
 * (J and Z are motion signs - the classifier can't attempt them - and ILY is
 * out of scope for live recognition in v1). These are never used for
 * classification, only to draw the ghost-hand reference illustration, so
 * approximate values are fine.
 *
 * Feature order matches classifier.ts's FEATURE_NAMES: [thumbCurl, indexCurl,
 * middleCurl, ringCurl, pinkyCurl, thumbToIndexMcp, thumbToPinkyMcp,
 * indexMiddleSpread, middleRingSpread, ringPinkySpread, handOrientation].
 */
const EXTRA_POSES: Record<string, number[]> = {
  // J traces a "J" in the air, but its held handshape is identical to I.
  J: LETTER_PROTOTYPES.I,
  // Z traces a "Z" with the index finger extended, other fingers curled.
  Z: [0.5, 0.05, 0.85, 0.85, 0.85, 0.35, 0.6, 0.1, 0.1, 0.1, 0.08],
  // I Love You: thumb, index, and pinky extended; middle and ring folded down.
  ILY: [0.1, 0.1, 0.85, 0.85, 0.05, 0.55, 0.75, 0.5, 0.1, 0.55, 0.08],
}

/**
 * Pose of the supporting (non-dominant) hand, for signs that use two hands.
 *
 * Deliberately empty: every sign in the current curriculum - the whole manual
 * alphabet plus the one-handed "I Love You" - is signed with a single hand, and
 * inventing a two-handed variant of a one-handed sign would teach learners
 * something false. This table is the single source of truth for two-handedness
 * and the extension point for genuinely two-handed signs (e.g. THANK-YOU's flat
 * receiving hand, or the two-handed number/word signs a later unit might add):
 * add the sign's id here with an 11-value pose vector and the ghost illustration
 * grows a second, green hand automatically. The two-hand layout below is covered
 * by tests that inject a synthetic secondary pose, so that path is known to work
 * before the first real entry lands here.
 *
 * Keys must be ids that {@link getGhostPose} can already resolve a primary pose
 * for - a secondary-only entry is ignored.
 */
const SECONDARY_POSES: Record<string, number[]> = {}

/** Both hands of a sign's reference illustration; `secondary` is null for one-handed signs. */
export interface GhostSign {
  /** Pose of the main/dominant signing hand - always drawn violet. */
  primary: number[]
  /** Pose of the supporting hand - always drawn green - or null when the sign is one-handed. */
  secondary: number[] | null
}

/** Returns an 11-value pose vector for the given sign id, or null if none is available yet. */
export function getGhostPose(signId: string): number[] | null {
  return LETTER_PROTOTYPES[signId] ?? EXTRA_POSES[signId] ?? null
}

/**
 * Returns the poses needed to draw a sign's reference illustration, or null if
 * the sign has no pose data at all. One-handed signs (all of them, today) come
 * back with `secondary: null`.
 */
export function getGhostSign(signId: string): GhostSign | null {
  const primary = getGhostPose(signId)
  if (!primary) return null
  return { primary, secondary: SECONDARY_POSES[signId] ?? null }
}

// ---------------------------------------------------------------------------
// Handshape geometry
// ---------------------------------------------------------------------------

const FEATURE_INDEX = Object.fromEntries(FEATURE_NAMES.map((name, i) => [name, i])) as Record<
  (typeof FEATURE_NAMES)[number],
  number
>

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Shape of one finger. There is deliberately no per-finger thickness here:
 * every finger is stroked at the width its CSS class defines
 * (`.ghost-hand__finger`, overridden for `.ghost-hand__thumb`), so thickness is
 * a styling concern and this module only produces centre-lines.
 */
interface FingerGeometry {
  baseX: number
  baseY: number
  curl: number
  splayDeg: number
  len1: number
  len2: number
}

/** A point in the hand's local drawing space. */
export interface Point2D {
  x: number
  y: number
}

/**
 * One digit's centre-line, plus the two endpoints the illustration needs to
 * run a gradient along it: purple where it leaves the palm, green at the tip.
 */
export interface Digit {
  d: string
  base: Point2D
  tip: Point2D
}

/** A smooth quadratic path from base -> bend -> tip for one finger. */
function fingerPath({ baseX, baseY, curl, splayDeg, len1, len2 }: FingerGeometry): Digit {
  const dir1 = splayDeg
  // Curled fingers foreshorten hard - a fist is compact, and without this the
  // tips arc out over the knuckles like a claw instead of folding in.
  const l1 = len1 * (1 - 0.36 * curl)
  const rad1 = (dir1 * Math.PI) / 180
  const bendX = baseX + l1 * Math.sin(rad1)
  const bendY = baseY - l1 * Math.cos(rad1)

  const dir2 = dir1 + curl * 122
  const l2 = len2 * (1 - 0.3 * curl)
  const rad2 = (dir2 * Math.PI) / 180
  const tipX = bendX + l2 * Math.sin(rad2)
  const tipY = bendY - l2 * Math.cos(rad2)

  return {
    d: `M ${baseX.toFixed(1)},${baseY.toFixed(1)} Q ${bendX.toFixed(1)},${bendY.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)}`,
    base: { x: baseX, y: baseY },
    tip: { x: tipX, y: tipY },
  }
}

function thumbPath(baseX: number, baseY: number, curl: number, out: number): Digit {
  // `out` (how far the thumb tip sits from the knuckles) sets how far the thumb
  // swings away from the palm, but a folded thumb also comes *across* the palm
  // rather than just bending at its own joint - so curl pulls the whole digit
  // inward. This is what separates a tucked B/S/M/N thumb from an extended L/Y
  // one; the pose features are distances, not angles, so it is an approximation.
  const dir1 = lerp(30, 88, out) - curl * 30
  const l1 = 46 * (1 - 0.3 * curl)
  const rad1 = (dir1 * Math.PI) / 180
  const bendX = baseX + l1 * Math.sin(rad1)
  const bendY = baseY - l1 * Math.cos(rad1)

  const dir2 = dir1 + curl * 55
  const l2 = 30 * (1 - 0.25 * curl)
  const rad2 = (dir2 * Math.PI) / 180
  const tipX = bendX + l2 * Math.sin(rad2)
  const tipY = bendY - l2 * Math.cos(rad2)

  return {
    d: `M ${baseX.toFixed(1)},${baseY.toFixed(1)} Q ${bendX.toFixed(1)},${bendY.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)}`,
    base: { x: baseX, y: baseY },
    tip: { x: tipX, y: tipY },
  }
}

/**
 * Palm + forearm silhouette.
 *
 * Shaped like an actual hand rather than a rounded box: the top edge arcs over
 * the knuckles (so the finger bases at y 86-95 sit embedded in it), the pinky
 * side falls away to the heel of the palm, the thumb side bulges at the thenar
 * pad where `thumbPath` is anchored (160, 140), and the forearm narrows below
 * before the wrist mask fades it out.
 */
const PALM_PATH =
  'M78,118 C80,104 98,90 118,89 C136,90 148,100 152,114 ' +
  'C158,132 160,146 157,158 C155,180 149,194 145,208 L145,256 ' +
  'L87,256 L87,208 C83,194 77,180 75,158 C73,146 74,130 78,118 Z'

/** The SVG paths of one hand, all in the same local (unrotated) coordinates. */
export interface HandPaths {
  palm: string
  /** Finger centre-lines in paint order, back to front - see {@link FINGER_PATH_ORDER}. */
  fingers: Digit[]
  thumb: Digit
}

/**
 * Which finger each entry of {@link HandPaths.fingers} draws. Pinky first so the
 * index finger paints on top, matching how a hand overlaps itself.
 */
export const FINGER_PATH_ORDER = ['pinky', 'ring', 'middle', 'index'] as const

/**
 * Turns an 11-value pose vector into the SVG paths for one hand's *shape*.
 *
 * This reads the ten rotation-invariant features (curls, spreads, thumb
 * position). The eleventh, `handOrientation`, is deliberately not a shape
 * property: it says how the whole hand is turned in space, so it is applied by
 * {@link buildGhostArtwork} as a rotation of the finished paths - which is what
 * separates the orientation twins G/Q, K/P and H/U.
 */
export function buildHandPaths(pose: number[]): HandPaths {
  const indexCurl = pose[FEATURE_INDEX.indexCurl]
  const middleCurl = pose[FEATURE_INDEX.middleCurl]
  const ringCurl = pose[FEATURE_INDEX.ringCurl]
  const pinkyCurl = pose[FEATURE_INDEX.pinkyCurl]
  const thumbCurl = pose[FEATURE_INDEX.thumbCurl]
  const indexMiddleSpread = clamp(pose[FEATURE_INDEX.indexMiddleSpread], 0, 1)
  const middleRingSpread = clamp(pose[FEATURE_INDEX.middleRingSpread], 0, 1)
  const ringPinkySpread = clamp(pose[FEATURE_INDEX.ringPinkySpread], 0, 1)
  const thumbOut = clamp((pose[FEATURE_INDEX.thumbToIndexMcp] + pose[FEATURE_INDEX.thumbToPinkyMcp]) / 2, 0, 1)

  return {
    palm: PALM_PATH,
    // Finger lengths are ~1.15x the palm's knuckle-to-heel span, matching real
    // proportions - a shorter finger set reads as a mitten rather than a hand.
    fingers: [
      fingerPath({ baseX: 84, baseY: 103, curl: pinkyCurl, splayDeg: -18 - ringPinkySpread * 14, len1: 40, len2: 28 }),
      fingerPath({ baseX: 101, baseY: 96, curl: ringCurl, splayDeg: -6 - middleRingSpread * 8, len1: 50, len2: 33 }),
      fingerPath({ baseX: 118, baseY: 94, curl: middleCurl, splayDeg: 2, len1: 56, len2: 36 }),
      fingerPath({ baseX: 135, baseY: 98, curl: indexCurl, splayDeg: 14 + indexMiddleSpread * 14, len1: 52, len2: 35 }),
    ],
    // Anchored inside the palm silhouette, not on its edge: the thumb is drawn
    // behind the palm so this root tucks under it and reads as attached.
    thumb: thumbPath(142, 156, thumbCurl, thumbOut),
  }
}

// ---------------------------------------------------------------------------
// Orientation
// ---------------------------------------------------------------------------

/**
 * The `handOrientation` value the artwork above is drawn at.
 *
 * `handOrientation` (see `getFeatureVector`) is the angle of the wrist ->
 * middle-MCP vector away from "up", normalized to [0, 1]: 0 = straight up,
 * 0.5 = sideways, 1 = straight down. A naturally-held upright hand measures
 * ~0.08 rather than 0, and that is the value every upright letter in the
 * curriculum carries, so 0.08 - not 0 - is the artwork's zero point. Anchoring
 * here means upright poses rotate by exactly 0deg and render identically to
 * before rotation existed, while G/H (0.5) tip ~76deg and Q/P (0.94) ~155deg.
 */
const ARTWORK_ORIENTATION = 0.08

/** Rotations smaller than this are treated as upright and drawn unrotated. */
const UPRIGHT_EPSILON_DEG = 0.5

/**
 * Degrees to rotate a hand drawn upright so it matches `handOrientation`.
 * Positive is clockwise in SVG coordinates, which points the fingers toward the
 * thumb side of the illustration (right) as the hand tips over - so G/H point
 * sideways with the thumb below the index finger, and Q/P point downward.
 */
export function orientationToRotationDeg(orientation: number): number {
  return (clamp(orientation, 0, 1) - ARTWORK_ORIENTATION) * 180
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** An axis-aligned rectangle in SVG viewBox units. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * How far past a hand's path centre-lines the illustration actually paints:
 * half of the widest stroke (the glow layer's `stroke-width: 22`) plus the
 * spread of its `blur(8px)` filter (~3 sigma). Bounds reported by
 * {@link buildGhostArtwork} include this, so "inside the stage" means the glow
 * fits too, not just the lines.
 */
export const PAINT_PADDING = 11 + 24

/** Absorbs the rounding of the numbers written into a transform attribute. */
const FIT_EPSILON = 0.02

const ONE_HAND_VIEWBOX = '0 0 200 270'

/**
 * The rectangle the one-hand illustration paints into, at every orientation.
 *
 * These numbers are measured, not guessed: across every pose in the curriculum
 * the widest upright hand (L/Y's extended thumb, B/F's fingertips) spans
 * x 59.3-231.5, y 5.3-258.0, which plus {@link PAINT_PADDING} is the rect
 * below. It is deliberately larger than {@link ONE_HAND_VIEWBOX} - the glow has
 * always been allowed to bleed past the box edges, which is why
 * `.ghost-hand__svg` sets `overflow: visible` - and rotated poses are scaled to
 * fit *this* rect, so tipping a hand sideways or downward can never paint
 * anywhere the upright artwork didn't already. `ghostHandPoses.test.ts` checks
 * both halves of that claim against the real pose values.
 */
const ONE_HAND_STAGE: Rect = { x: 24, y: -30, width: 243, height: 323 }

/**
 * Two-handed layout: a wider stage with the dominant hand on the right and a
 * smaller, mirrored supporting hand behind it on the left. Each hand is fitted
 * into its own slot, so unlike the one-hand case both hands - glow included -
 * stay strictly inside the viewBox. The slots are chosen to overlap by at most
 * 10 units in x, so the hands read as two hands rather than one blob, and the
 * supporting hand is capped at {@link SECONDARY_SCALE_RATIO} of whatever scale
 * the dominant hand got, so the dominant hand is always the larger of the two
 * no matter which poses are involved.
 */
const TWO_HAND_VIEWBOX = '0 0 340 300'
const TWO_HAND_STAGE: Rect = { x: 0, y: 0, width: 340, height: 300 }
const TWO_HAND_PRIMARY_SLOT: Rect = { x: 150, y: 0, width: 190, height: 300 }
const TWO_HAND_SECONDARY_SLOT: Rect = { x: 0, y: 30, width: 160, height: 250 }
const SECONDARY_SCALE_RATIO = 0.78

/**
 * Pivot for the orientation rotation: the midpoint of the palm's wrist edge
 * (the `y=258` end of {@link PALM_PATH}). A real hand pivots at the wrist, so
 * rotating here keeps the wrist put and swings the fingers, rather than sliding
 * the whole hand around an arbitrary point.
 */
const WRIST_PIVOT: readonly [number, number] = [119.5, 258]

type Point = readonly [number, number]

/**
 * Every coordinate pair in a path string. All paths here are absolute M/L/Q/C
 * commands whose numbers are all x,y pairs, and a quadratic or cubic curve is
 * contained in the convex hull of its control points, so this is a conservative
 * superset of the drawn ink - good enough to bound it.
 */
function pathPoints(d: string): Point[] {
  const numbers = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  const points: Point[] = []
  for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]])
  return points
}

function handPoints(paths: HandPaths): Point[] {
  return [paths.palm, ...paths.fingers.map((f) => f.d), paths.thumb.d].flatMap(pathPoints)
}

function boundsOf(points: Point[], padding: number): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of points) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + 2 * padding,
    height: maxY - minY + 2 * padding,
  }
}

function rotateAbout([x, y]: Point, [px, py]: readonly [number, number], deg: number): Point {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = x - px
  const dy = y - py
  return [px + dx * cos - dy * sin, py + dx * sin + dy * cos]
}

/** Trims a number for a transform attribute so the emitted string stays stable. */
function fmt(value: number): string {
  return Number(value.toFixed(3)).toString()
}

interface HandSlot {
  slot: Rect
  /** Upper bound on the uniform scale, before the slot's own fit is applied. */
  maxScale: number
  /** Mirror in x, so a supporting hand reads as the signer's *other* hand. */
  mirror: boolean
}

interface PlacedHand {
  transform: string
  bounds: Rect
  scale: number
}

/**
 * Rotates a hand to its orientation and drops it into `slot`, shrinking it
 * uniformly if - and only if - the rotated artwork plus its glow padding would
 * otherwise overflow. The returned `bounds` describe exactly what the returned
 * `transform` paints, and are inside `slot` by construction.
 */
function placeHand(paths: HandPaths, rotationDeg: number, { slot, maxScale, mirror }: HandSlot): PlacedHand {
  const rotated = handPoints(paths).map((point) => rotateAbout(point, WRIST_PIVOT, rotationDeg))
  const inkBounds = boundsOf(rotated, 0)
  const paintedWidth = inkBounds.width + 2 * PAINT_PADDING
  const paintedHeight = inkBounds.height + 2 * PAINT_PADDING

  const fitScale = Math.min(
    maxScale,
    (slot.width - FIT_EPSILON) / paintedWidth,
    (slot.height - FIT_EPSILON) / paintedHeight,
  )
  // Floor rather than round so the emitted (trimmed) scale can never be larger
  // than the one these bounds were computed from.
  const scale = Math.floor(fitScale * 1000) / 1000
  const scaleX = mirror ? -scale : scale

  const slotCenterX = slot.x + slot.width / 2
  const slotCenterY = slot.y + slot.height / 2
  const inkCenterX = inkBounds.x + inkBounds.width / 2
  const inkCenterY = inkBounds.y + inkBounds.height / 2
  const translateX = Number((slotCenterX - scaleX * inkCenterX).toFixed(3))
  const translateY = Number((slotCenterY - scale * inkCenterY).toFixed(3))

  const width = scale * paintedWidth
  const height = scale * paintedHeight
  return {
    transform: `translate(${fmt(translateX)}, ${fmt(translateY)}) scale(${fmt(scaleX)}, ${fmt(scale)}) rotate(${fmt(rotationDeg)}, ${fmt(WRIST_PIVOT[0])}, ${fmt(WRIST_PIVOT[1])})`,
    bounds: {
      x: translateX + scaleX * inkCenterX - width / 2,
      y: translateY + scale * inkCenterY - height / 2,
      width,
      height,
    },
    scale,
  }
}

/** One hand of a reference illustration, ready to render. */
export interface GhostHandArt {
  /** Decides the colour: 'primary' is violet, 'secondary' green (see index.css). */
  role: HandRole
  paths: HandPaths
  /** SVG transform placing the hand at its orientation; absent means "as drawn". */
  transform?: string
  /** What this hand actually paints, glow included, in viewBox units. */
  bounds: Rect
}

/** Everything {@link GhostHand} needs to draw a sign's reference illustration. */
export interface GhostArtwork {
  viewBox: string
  /** Rect every hand's {@link GhostHandArt.bounds} is guaranteed to stay inside. */
  stage: Rect
  /** Paint order: the supporting hand first, so the dominant hand layers in front. */
  hands: GhostHandArt[]
}

function orientationOf(pose: number[]): number {
  return pose[FEATURE_INDEX.handOrientation]
}

/**
 * Builds the drawable artwork for a sign: one hand's paths for a one-handed
 * sign, two for a sign with a secondary pose, each rotated to its own
 * `handOrientation` and framed so nothing is clipped.
 *
 * A one-handed upright pose - which is every sign in the curriculum except
 * G, H, Q and P - gets no transform at all, so it renders exactly as it did
 * before orientation was honoured.
 */
export function buildGhostArtwork(sign: GhostSign): GhostArtwork {
  const primaryPaths = buildHandPaths(sign.primary)
  const primaryRotation = orientationToRotationDeg(orientationOf(sign.primary))

  if (!sign.secondary) {
    if (Math.abs(primaryRotation) < UPRIGHT_EPSILON_DEG) {
      return {
        viewBox: ONE_HAND_VIEWBOX,
        stage: ONE_HAND_STAGE,
        hands: [
          {
            role: 'primary',
            paths: primaryPaths,
            bounds: boundsOf(handPoints(primaryPaths), PAINT_PADDING),
          },
        ],
      }
    }
    const placed = placeHand(primaryPaths, primaryRotation, {
      slot: ONE_HAND_STAGE,
      maxScale: 1,
      mirror: false,
    })
    return {
      viewBox: ONE_HAND_VIEWBOX,
      stage: ONE_HAND_STAGE,
      hands: [
        { role: 'primary', paths: primaryPaths, transform: placed.transform, bounds: placed.bounds },
      ],
    }
  }

  const secondaryPaths = buildHandPaths(sign.secondary)
  const primary = placeHand(primaryPaths, primaryRotation, {
    slot: TWO_HAND_PRIMARY_SLOT,
    maxScale: 1,
    mirror: false,
  })
  const secondary = placeHand(secondaryPaths, orientationToRotationDeg(orientationOf(sign.secondary)), {
    slot: TWO_HAND_SECONDARY_SLOT,
    maxScale: primary.scale * SECONDARY_SCALE_RATIO,
    mirror: true,
  })

  return {
    viewBox: TWO_HAND_VIEWBOX,
    stage: TWO_HAND_STAGE,
    hands: [
      { role: 'secondary', paths: secondaryPaths, transform: secondary.transform, bounds: secondary.bounds },
      { role: 'primary', paths: primaryPaths, transform: primary.transform, bounds: primary.bounds },
    ],
  }
}
