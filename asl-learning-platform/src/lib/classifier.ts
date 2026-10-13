import type {
  ClassificationCandidate,
  ClassificationResult,
  HandLandmarks,
  Point3D,
} from '../types/asl'

/**
 * Geometric (non-ML) classifier for the static American Manual Alphabet.
 *
 * Strategy: turn the 21 raw MediaPipe landmarks into a feature vector, then
 * nearest-prototype match it against a table of reference vectors, one per
 * recognizable static letter.
 *
 * Everything here is pure math - no DOM, no React, no network - so it can be
 * unit tested with synthetic landmark fixtures.
 */

// ---------------------------------------------------------------------------
// Vector / geometry helpers
// ---------------------------------------------------------------------------

interface Vec3 {
  x: number
  y: number
  z: number
}

function subtract(a: Point3D, b: Point3D): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function magnitude(v: Vec3): number {
  return Math.sqrt(dot(v, v))
}

function normalize(v: Vec3): Vec3 {
  const len = magnitude(v)
  if (len === 0) return { x: 0, y: 0, z: 0 }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Euclidean distance between two landmark points. */
function distance(a: Point3D, b: Point3D): number {
  return magnitude(subtract(a, b))
}

/** Angle, in degrees [0, 180], between two vectors. */
function angleBetweenDeg(v1: Vec3, v2: Vec3): number {
  const denom = magnitude(v1) * magnitude(v2)
  if (denom === 0) return 180 // degenerate (coincident joints) - treat as "straight"
  const cos = clamp(dot(v1, v2) / denom, -1, 1)
  return (Math.acos(cos) * 180) / Math.PI
}

/**
 * Curl of a three-joint chain (base -> vertex -> tip), in [0, 1].
 *
 * The interior angle at `vertex` between the rays vertex->base and vertex->tip:
 * ~180deg when the chain is straight (curl ~= 0), shrinking toward 0deg as the
 * joint folds (curl ~= 1).
 *
 * Note what this deliberately cannot see: it reads *one* joint angle, so a
 * finger bent hard at the PIP and one bent gently at the PIP but folded at the
 * DIP measure the same. That is the whole difference between X and a fist,
 * which is why the extension features below exist alongside it.
 */
export function computeCurl(base: Point3D, vertex: Point3D, tip: Point3D): number {
  const angle = angleBetweenDeg(subtract(base, vertex), subtract(tip, vertex))
  return clamp(1 - angle / 180, 0, 1)
}

// ---------------------------------------------------------------------------
// Landmark indices (MediaPipe HandLandmarker standard order)
// ---------------------------------------------------------------------------

const WRIST = 0
const THUMB_MCP = 2
const THUMB_IP = 3
const THUMB_TIP = 4
const INDEX_MCP = 5
const INDEX_PIP = 6
const INDEX_TIP = 8
const MIDDLE_MCP = 9
const MIDDLE_PIP = 10
const MIDDLE_TIP = 12
const RING_MCP = 13
const RING_PIP = 14
const RING_TIP = 16
const PINKY_MCP = 17
const PINKY_PIP = 18
const PINKY_TIP = 20

/** Names of the entries produced by {@link getFeatureVector}, in order. */
export const FEATURE_NAMES = [
  'thumbCurl',
  'indexCurl',
  'middleCurl',
  'ringCurl',
  'pinkyCurl',
  'thumbExtension',
  'indexExtension',
  'middleExtension',
  'ringExtension',
  'pinkyExtension',
  'thumbToIndexTip',
  'thumbToIndexMcp',
  'thumbToPinkyMcp',
  'thumbAcross',
  'thumbAlong',
  'indexMiddleSpread',
  'middleRingSpread',
  'ringPinkySpread',
  'indexMiddleAngle',
  'indexMiddleCross',
  'handOrientation',
] as const

export type FeatureName = (typeof FEATURE_NAMES)[number]

const FEATURE_COUNT = FEATURE_NAMES.length

/** Position of each feature in the vector, by name. */
export const FEATURE_INDEX = Object.fromEntries(
  FEATURE_NAMES.map((name, i) => [name, i]),
) as Record<FeatureName, number>

/**
 * Builds the feature vector used for classification.
 *
 * Every entry but the last is expressed in the hand's own frame, so it says the
 * same thing however the hand is turned or however far it is from the camera.
 *
 * - **Curls** - one joint angle per digit. Cheap and stable, but blind to the
 *   difference between "bent at one joint" and "folded at two".
 * - **Extensions** - fingertip-to-knuckle reach over palm size. A length rather
 *   than an angle, which is what separates a hooked finger (X) from a fisted
 *   one, and a wide curve (C) from a closed one (O).
 * - **`thumbToIndexTip`** - the gap between the thumb tip and the index tip.
 *   This is the entire difference between C and O, and between an O and a fist:
 *   O and F close that gap, C holds it open. Measuring the thumb only against
 *   the *knuckles*, as this used to, cannot see it - the knuckle barely moves
 *   between the two.
 * - **Thumb placement** - `thumbAcross` and `thumbAlong` project the thumb tip
 *   onto the palm's own axes. Both come from the hand's own landmarks, so
 *   "across" means "toward the pinky" for either hand. This is where M/N/S/T
 *   differ.
 * - **`indexMiddleAngle`** - the angle between the index and middle finger
 *   *directions*, which is what separates U from V. The tip-to-tip spread this
 *   replaces conflated two different things: fingers held apart, and fingers
 *   simply extended further, so a lazily-spread V read as a U.
 * - **`indexMiddleCross`** - which side of the middle finger the index tip is
 *   on. Positive for every letter but R, where they are wound over each other.
 *   Distance alone cannot see that: crossed fingers and fingers merely held
 *   together read identically.
 *
 * The last entry, `handOrientation`, is the one feature deliberately NOT
 * invariant: the angle of wrist -> middle-knuckle against "up" in the camera
 * image, normalized to [0, 1]. It exists because G/Q, H/U and K/P are the same
 * handshape pointed different ways. It is measured in the image plane only -
 * including z would let a hand tipped toward the camera read as "pointing down"
 * from foreshortening alone. {@link classifyFeatures} keeps it out of the
 * distance entirely and uses it only to pick between those pairs.
 *
 * Returns a zero vector for malformed input rather than throwing.
 */
export function getFeatureVector(landmarks: HandLandmarks): number[] {
  if (!Array.isArray(landmarks) || landmarks.length !== 21) {
    return new Array<number>(FEATURE_COUNT).fill(0)
  }

  const wrist = landmarks[WRIST]
  const indexMcp = landmarks[INDEX_MCP]
  const middleMcp = landmarks[MIDDLE_MCP]
  const pinkyMcp = landmarks[PINKY_MCP]
  const indexTip = landmarks[INDEX_TIP]
  const middleTip = landmarks[MIDDLE_TIP]
  const thumbTip = landmarks[THUMB_TIP]
  const palmSize = Math.max(distance(wrist, middleMcp), 1e-6)

  const thumbCurl = computeCurl(landmarks[THUMB_MCP], landmarks[THUMB_IP], thumbTip)
  const indexCurl = computeCurl(indexMcp, landmarks[INDEX_PIP], indexTip)
  const middleCurl = computeCurl(middleMcp, landmarks[MIDDLE_PIP], middleTip)
  const ringCurl = computeCurl(landmarks[RING_MCP], landmarks[RING_PIP], landmarks[RING_TIP])
  const pinkyCurl = computeCurl(pinkyMcp, landmarks[PINKY_PIP], landmarks[PINKY_TIP])

  // How far each fingertip reaches from its own knuckle.
  const thumbExtension = distance(thumbTip, landmarks[THUMB_MCP]) / palmSize
  const indexExtension = distance(indexTip, indexMcp) / palmSize
  const middleExtension = distance(middleTip, middleMcp) / palmSize
  const ringExtension = distance(landmarks[RING_TIP], landmarks[RING_MCP]) / palmSize
  const pinkyExtension = distance(landmarks[PINKY_TIP], pinkyMcp) / palmSize

  // The open-or-closed gap. Near zero when the thumb and index tips touch.
  const thumbToIndexTip = distance(thumbTip, indexTip) / palmSize

  const thumbToIndexMcp = distance(thumbTip, indexMcp) / palmSize
  const thumbToPinkyMcp = distance(thumbTip, pinkyMcp) / palmSize

  // The palm's own axes, from the hand's own landmarks, so they mean the same
  // thing for a left and a right hand.
  const along = normalize(subtract(middleMcp, wrist))
  const across = normalize(subtract(pinkyMcp, indexMcp))

  const thumbOffset = subtract(thumbTip, wrist)
  const thumbAcross = dot(thumbOffset, across) / palmSize
  const thumbAlong = dot(thumbOffset, along) / palmSize

  const indexMiddleSpread = distance(indexTip, middleTip) / palmSize
  const middleRingSpread = distance(middleTip, landmarks[RING_TIP]) / palmSize
  const ringPinkySpread = distance(landmarks[RING_TIP], landmarks[PINKY_TIP]) / palmSize

  // How far apart the two fingers are *pointed*, independent of how far they
  // happen to be extended. Normalized by 90deg rather than 180: no pair of
  // fingers opens past a right angle, so halving the range doubles the
  // resolution where the letters actually live.
  const indexMiddleAngle =
    angleBetweenDeg(subtract(indexTip, indexMcp), subtract(middleTip, middleMcp)) / 90

  const indexMiddleCross = dot(subtract(middleTip, indexTip), across) / palmSize

  const pointing = subtract(middleMcp, wrist)
  const handOrientation =
    angleBetweenDeg({ x: pointing.x, y: pointing.y, z: 0 }, { x: 0, y: -1, z: 0 }) / 180

  return [
    thumbCurl,
    indexCurl,
    middleCurl,
    ringCurl,
    pinkyCurl,
    thumbExtension,
    indexExtension,
    middleExtension,
    ringExtension,
    pinkyExtension,
    thumbToIndexTip,
    thumbToIndexMcp,
    thumbToPinkyMcp,
    thumbAcross,
    thumbAlong,
    indexMiddleSpread,
    middleRingSpread,
    ringPinkySpread,
    indexMiddleAngle,
    indexMiddleCross,
    handOrientation,
  ]
}

// ---------------------------------------------------------------------------
// Prototypes, one per recognizable static letter (A-Y, no J/Z - both require
// in-air motion a single static frame can't capture).
//
// These are not free-hand illustrations of what each letter "should" look like.
// Every value was read off a synthetic hand built to the letter's real joint
// geometry and run through getFeatureVector (see handFixtures.ts, which the
// tests classify letter by letter), then rounded. That matters: a prototype
// invented on a 0-1 intuition is systematically off from what the extractor
// actually measures, and when every prototype is off by a different amount the
// one feature that should decide a close call gets outvoted by the rest.
// Change a value here only against a measurement.
// ---------------------------------------------------------------------------

// handOrientation references. The pointing-down letters are NOT 1.0: nobody
// signs Q or P straight at the floor, they tip the hand forward, and a
// reference of 0.94 put a real Q almost exactly halfway between "sideways" and
// "down". "Upright" is likewise a few degrees off vertical, because a hand held
// up in front of a camera always is.
const ORIENTATION_UPRIGHT = 0.08
const ORIENTATION_SIDEWAYS = 0.45
const ORIENTATION_DOWN = 0.78

export const LETTER_PROTOTYPES: Record<string, number[]> = {
  A: [0.06, 0.68, 0.68, 0.68, 0.69, 0.58, 0.46, 0.50, 0.46, 0.34, 0.56, 0.32, 1.01, -0.72, 1.04, 0.24, 0.20, 0.22, 0.05, 0.22, ORIENTATION_UPRIGHT],
  B: [0.14, 0.02, 0.02, 0.02, 0.02, 0.57, 1.02, 1.09, 1.01, 0.77, 1.34, 0.49, 0.57, -0.14, 0.66, 0.32, 0.29, 0.44, 0.01, 0.25, ORIENTATION_UPRIGHT],
  C: [0.08, 0.30, 0.30, 0.30, 0.30, 0.58, 0.90, 0.97, 0.90, 0.68, 0.80, 0.34, 0.60, -0.25, 0.84, 0.34, 0.32, 0.41, 0.04, 0.29, ORIENTATION_UPRIGHT],
  D: [0.25, 0.02, 0.58, 0.57, 0.58, 0.54, 1.02, 0.65, 0.60, 0.45, 1.17, 0.40, 0.84, -0.47, 0.82, 1.27, 0.23, 0.28, 1.11, 0.48, ORIENTATION_UPRIGHT],
  E: [0.22, 0.55, 0.55, 0.55, 0.55, 0.55, 0.66, 0.71, 0.65, 0.50, 0.33, 0.54, 0.70, -0.22, 0.60, 0.26, 0.22, 0.28, 0.02, 0.23, ORIENTATION_UPRIGHT],
  F: [0.22, 0.50, 0.02, 0.02, 0.02, 0.55, 0.70, 1.09, 1.01, 0.77, 0.32, 0.42, 0.85, -0.46, 0.81, 1.35, 0.29, 0.44, 0.97, 0.07, ORIENTATION_UPRIGHT],
  G: [0.04, 0.02, 0.68, 0.68, 0.69, 0.58, 1.02, 0.50, 0.46, 0.34, 0.92, 0.23, 0.87, -0.57, 1.04, 1.37, 0.20, 0.22, 1.46, 0.54, ORIENTATION_SIDEWAYS],
  H: [0.17, 0.02, 0.02, 0.68, 0.69, 0.56, 1.02, 1.09, 0.46, 0.34, 1.31, 0.46, 0.60, -0.18, 0.69, 0.30, 1.52, 0.22, 0.00, 0.23, ORIENTATION_SIDEWAYS],
  I: [0.17, 0.68, 0.68, 0.68, 0.02, 0.56, 0.46, 0.50, 0.46, 0.77, 0.21, 0.49, 0.59, -0.16, 0.65, 0.24, 0.20, 1.07, 0.05, 0.22, ORIENTATION_UPRIGHT],
  K: [0.10, 0.02, 0.02, 0.68, 0.69, 0.57, 1.02, 1.09, 0.46, 0.34, 1.00, 0.23, 0.72, -0.41, 0.97, 0.75, 1.49, 0.22, 0.29, 0.68, ORIENTATION_UPRIGHT],
  L: [0.03, 0.02, 0.68, 0.68, 0.69, 0.58, 1.02, 0.50, 0.46, 0.34, 1.55, 0.83, 1.46, -1.09, 0.56, 1.37, 0.20, 0.22, 1.46, 0.54, ORIENTATION_UPRIGHT],
  M: [0.07, 0.68, 0.68, 0.68, 0.69, 0.58, 0.46, 0.50, 0.46, 0.34, 0.66, 0.63, 0.51, 0.02, 0.48, 0.24, 0.20, 0.22, 0.05, 0.22, ORIENTATION_UPRIGHT],
  N: [0.22, 0.68, 0.68, 0.68, 0.69, 0.55, 0.46, 0.50, 0.46, 0.34, 0.51, 0.46, 0.38, -0.03, 0.65, 0.24, 0.20, 0.22, 0.05, 0.22, ORIENTATION_UPRIGHT],
  O: [0.24, 0.50, 0.50, 0.50, 0.50, 0.54, 0.70, 0.75, 0.70, 0.53, 0.34, 0.40, 0.80, -0.42, 0.80, 0.28, 0.25, 0.31, 0.01, 0.24, ORIENTATION_UPRIGHT],
  P: [0.10, 0.02, 0.02, 0.68, 0.69, 0.57, 1.02, 1.09, 0.46, 0.34, 1.00, 0.23, 0.72, -0.41, 0.97, 0.75, 1.49, 0.22, 0.29, 0.68, ORIENTATION_DOWN],
  Q: [0.04, 0.02, 0.68, 0.68, 0.69, 0.58, 1.02, 0.50, 0.46, 0.34, 0.92, 0.23, 0.87, -0.57, 1.04, 1.37, 0.20, 0.22, 1.46, 0.54, ORIENTATION_DOWN],
  R: [0.17, 0.02, 0.02, 0.68, 0.69, 0.56, 1.02, 1.09, 0.46, 0.34, 1.27, 0.46, 0.60, -0.18, 0.69, 0.15, 1.54, 0.22, 0.22, -0.12, ORIENTATION_UPRIGHT],
  S: [0.26, 0.68, 0.68, 0.68, 0.69, 0.53, 0.46, 0.50, 0.46, 0.34, 0.12, 0.51, 0.75, -0.30, 0.65, 0.24, 0.20, 0.22, 0.05, 0.22, ORIENTATION_UPRIGHT],
  T: [0.06, 0.68, 0.68, 0.68, 0.69, 0.58, 0.46, 0.50, 0.46, 0.34, 0.31, 0.33, 0.77, -0.42, 0.91, 0.24, 0.20, 0.22, 0.05, 0.22, ORIENTATION_UPRIGHT],
  U: [0.17, 0.02, 0.02, 0.68, 0.69, 0.56, 1.02, 1.09, 0.46, 0.34, 1.30, 0.46, 0.60, -0.18, 0.69, 0.30, 1.52, 0.22, 0.00, 0.23, ORIENTATION_UPRIGHT],
  V: [0.17, 0.02, 0.02, 0.68, 0.69, 0.56, 1.02, 1.09, 0.46, 0.34, 1.35, 0.46, 0.60, -0.18, 0.69, 0.96, 1.48, 0.22, 0.42, 0.88, ORIENTATION_UPRIGHT],
  W: [0.19, 0.02, 0.02, 0.02, 0.69, 0.55, 1.02, 1.09, 1.01, 0.34, 1.45, 0.54, 0.62, -0.15, 0.59, 0.61, 0.60, 1.35, 0.20, 0.53, ORIENTATION_UPRIGHT],
  X: [0.06, 0.54, 0.68, 0.68, 0.69, 0.58, 0.68, 0.50, 0.46, 0.34, 0.54, 0.28, 0.96, -0.66, 1.04, 0.61, 0.20, 0.22, 0.63, 0.38, ORIENTATION_UPRIGHT],
  Y: [0.03, 0.68, 0.68, 0.68, 0.02, 0.58, 0.46, 0.50, 0.46, 0.77, 0.81, 0.80, 1.45, -1.09, 0.60, 0.24, 0.20, 1.08, 0.05, 0.22, ORIENTATION_UPRIGHT],
}

/**
 * Letters that share a handshape and differ only in where the hand points.
 *
 * These used to be scored like any other pair, with `handOrientation` as one
 * more term in the distance. That fails in a specific, reproducible way: H and
 * U have otherwise *identical* prototypes, so a hand held at 45 degrees sat
 * equidistant from both while the other features all voted "tie". Same for G/Q
 * and K/P.
 *
 * So orientation is kept out of the distance and used here instead: the group
 * is scored once on shape, then the member whose reference orientation is
 * nearest what was measured wins and the rest are dropped. A two-way decision
 * on one number, rather than a tie-break buried under twenty others - and as a
 * bonus every letter outside these groups is now scored rotation-invariantly,
 * so tipping your wrist no longer costs you a B.
 */
const ORIENTATION_GROUPS: readonly (readonly string[])[] = [
  ['G', 'Q'],
  ['H', 'U'],
  ['K', 'P'],
]

/** Letter -> the other members of its orientation group. */
const ORIENTATION_RIVALS: Record<string, readonly string[]> = Object.fromEntries(
  ORIENTATION_GROUPS.flatMap((group) =>
    group.map((letter) => [letter, group.filter((other) => other !== letter)] as const),
  ),
)

// ---------------------------------------------------------------------------
// Feature weights
// ---------------------------------------------------------------------------

/**
 * How much each feature counts toward the distance.
 *
 * The heavy ones are the ones that carry a letter on their own:
 * `thumbToIndexTip` is the whole of C-versus-O, `indexMiddleAngle` the whole of
 * U-versus-V, `thumbAcross`/`thumbAlong` the whole of M/N/S/T. At even weight
 * each was outvoted by a dozen features that said "two curved fingers" or
 * "two straight fingers" and were identical across the pair.
 *
 * The two raw thumb-to-knuckle distances are held below 1: they say roughly
 * what `thumbAcross`/`thumbAlong` already say, and at full weight they
 * double-count it.
 *
 * `handOrientation` is 0 - not "unimportant", but *not a distance*. See
 * ORIENTATION_GROUPS.
 */
const FEATURE_WEIGHTS: Record<FeatureName, number> = {
  thumbCurl: 0.8,
  indexCurl: 1,
  middleCurl: 1,
  ringCurl: 1,
  pinkyCurl: 1,
  thumbExtension: 1.2,
  indexExtension: 1.6,
  middleExtension: 1.6,
  ringExtension: 1.4,
  pinkyExtension: 1.4,
  thumbToIndexTip: 2.2,
  thumbToIndexMcp: 0.7,
  thumbToPinkyMcp: 0.7,
  thumbAcross: 2,
  thumbAlong: 1.8,
  indexMiddleSpread: 0.8,
  middleRingSpread: 0.8,
  ringPinkySpread: 0.8,
  indexMiddleAngle: 2.2,
  indexMiddleCross: 1.2,
  handOrientation: 0,
}

const WEIGHTS = FEATURE_NAMES.map((name) => FEATURE_WEIGHTS[name])
const WEIGHT_TOTAL = WEIGHTS.reduce((sum, w) => sum + w, 0)

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Feature distance at which a rival becomes ~e times less likely than the winner. */
const CONFIDENCE_TEMPERATURE = 0.05

/** Past this, the reading matches nothing - however far ahead the winner is. */
const MAX_MATCH_DISTANCE = 0.45

/** Minimum confidence a top match must clear to be reported as `best`. */
const MIN_CONFIDENCE = 0.45

/**
 * Weighted RMS distance between a reading and a prototype. Dividing by the
 * total weight keeps the number on the same scale as the features themselves,
 * so the thresholds above stay meaningful if a feature is added or a weight
 * retuned.
 */
function weightedDistance(a: number[], b: number[]): number {
  let sum = 0
  const len = Math.min(a.length, b.length, WEIGHTS.length)
  for (let i = 0; i < len; i++) {
    const d = a[i] - b[i]
    sum += WEIGHTS[i] * d * d
  }
  return Math.sqrt(sum / WEIGHT_TOTAL)
}

/**
 * Turns per-letter distances into confidences that add up to 1.
 *
 * The old `1 / (1 + distance)` could not do that job: on a multi-dimensional
 * distance it never left the 0.4-0.6 band, so a perfect hold and a wild guess
 * reported almost the same number, and every threshold tuned against it was
 * tuned against a fiction. A softmax over the negated distances reports what
 * the caller actually needs - how far ahead the winner is.
 */
function toConfidences(distances: number[]): number[] {
  const best = Math.min(...distances)
  const weights = distances.map((d) => Math.exp(-(d - best) / CONFIDENCE_TEMPERATURE))
  const total = weights.reduce((sum, w) => sum + w, 0)
  return weights.map((w) => w / total)
}

/**
 * Classifies a single detected hand's static shape against the American Manual
 * Alphabet (letters A-Y, excluding J and Z, which require motion).
 */
export function classifyHandShape(landmarks: HandLandmarks): ClassificationResult {
  if (!Array.isArray(landmarks) || landmarks.length !== 21) {
    return { best: null, candidates: [] }
  }
  return classifyFeatures(getFeatureVector(landmarks))
}

/**
 * Classifies an already-computed feature vector.
 *
 * Exists so a caller can average features over several still frames and
 * classify the average - far steadier than classifying one noisy frame, since
 * landmark jitter largely cancels out. See `stableCapture.ts`.
 */
export function classifyFeatures(featureVector: number[]): ClassificationResult {
  if (!Array.isArray(featureVector) || featureVector.length !== FEATURE_COUNT) {
    return { best: null, candidates: [] }
  }

  const orientation = featureVector[FEATURE_INDEX.handOrientation]

  const letters: string[] = []
  const distances: number[] = []
  for (const [letter, prototype] of Object.entries(LETTER_PROTOTYPES)) {
    // Within an orientation group only the member the hand is actually pointed
    // like stays in the running. Scoring both and letting them split the
    // confidence is what made H and U interchangeable.
    if (losesOrientationTieBreak(letter, orientation)) continue
    letters.push(letter)
    distances.push(weightedDistance(featureVector, prototype))
  }
  if (!letters.length) return { best: null, candidates: [] }

  const confidences = toConfidences(distances)
  const scored = letters
    .map((letter, i) => ({ letter, confidence: confidences[i], distance: distances[i] }))
    .sort((a, b) => b.confidence - a.confidence)

  const candidates: ClassificationCandidate[] = scored
    .slice(0, 3)
    .map(({ letter, confidence }) => ({ letter, confidence }))
  const top = scored[0]
  const best =
    top.confidence >= MIN_CONFIDENCE && top.distance <= MAX_MATCH_DISTANCE
      ? { letter: top.letter, confidence: top.confidence }
      : null

  return { best, candidates }
}

/** True when a group-mate's reference orientation is a closer fit than this letter's. */
function losesOrientationTieBreak(letter: string, orientation: number): boolean {
  const rivals = ORIENTATION_RIVALS[letter]
  if (!rivals) return false
  const own = Math.abs(orientation - LETTER_PROTOTYPES[letter][FEATURE_INDEX.handOrientation])
  return rivals.some((rival) => {
    const gap = Math.abs(orientation - LETTER_PROTOTYPES[rival][FEATURE_INDEX.handOrientation])
    // Ties go to whichever letter sorts first, so exactly one member survives.
    return gap < own || (gap === own && rival < letter)
  })
}
