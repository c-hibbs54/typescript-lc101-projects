import type {
  ClassificationCandidate,
  ClassificationResult,
  HandLandmarks,
  Point3D,
} from '../types/asl'

/**
 * Geometric (non-ML) classifier for the static American Manual Alphabet.
 *
 * Strategy: turn the 21 raw MediaPipe landmarks into a small, rotation- and
 * scale-invariant feature vector (finger curl angles + a few normalized
 * distances), then nearest-prototype match that vector against a hand-built
 * table of reference vectors, one per recognizable static letter.
 *
 * Everything here is pure math - no DOM, no React, no network - so it can be
 * unit tested with plain synthetic landmark fixtures.
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Euclidean distance between two landmark points. */
function distance(a: Point3D, b: Point3D): number {
  return magnitude(subtract(a, b))
}

/** Points "up" in normalized image coordinates (y increases downward). */
const UP: Vec3 = { x: 0, y: -1, z: 0 }

/**
 * Angle, in degrees [0, 180], between two vectors. When both vectors are
 * derived purely from the hand's own joints (as in {@link computeCurl}) this
 * is rotation-invariant, since it only depends on the vectors' relative
 * directions, never the hand's absolute orientation to the camera. Comparing
 * against a fixed external reference (like {@link UP} below) deliberately
 * breaks that invariance to measure absolute orientation instead - see
 * `handOrientation` in {@link getFeatureVector}.
 */
function angleBetweenDeg(v1: Vec3, v2: Vec3): number {
  const denom = magnitude(v1) * magnitude(v2)
  if (denom === 0) return 180 // degenerate (coincident joints) - treat as "straight"
  const cos = clamp(dot(v1, v2) / denom, -1, 1)
  return (Math.acos(cos) * 180) / Math.PI
}

/**
 * Curl of a three-joint chain (base -> vertex -> tip), in [0, 1].
 *
 * We measure the interior angle at `vertex` between the rays vertex->base
 * and vertex->tip. When the chain is straight, base/vertex/tip are
 * (roughly) colinear with vertex in the middle, so that angle is ~180deg and
 * curl ~= 0. As the joint folds, the tip swings back toward the base side
 * and the angle shrinks toward 0deg, so curl ~= 1.
 *
 * For the index/middle/ring/pinky fingers this is applied at the PIP joint
 * using (MCP, PIP, TIP). For the thumb it's applied at the IP joint using
 * (MCP, IP, TIP). Exported so it can be exercised directly in tests.
 */
export function computeCurl(base: Point3D, vertex: Point3D, tip: Point3D): number {
  const toBase = subtract(base, vertex)
  const toTip = subtract(tip, vertex)
  const angle = angleBetweenDeg(toBase, toTip)
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
  'thumbToIndexMcp',
  'thumbToPinkyMcp',
  'indexMiddleSpread',
  'middleRingSpread',
  'ringPinkySpread',
  'handOrientation',
] as const

const FEATURE_COUNT = FEATURE_NAMES.length

/**
 * Builds the feature vector used for classification: mostly rotation/scale
 * invariant (finger curls + palm-normalized distances), plus one deliberately
 * NOT rotation-invariant feature, `handOrientation`.
 *
 * That last feature exists because a handful of letter pairs in the American
 * Manual Alphabet share the exact same relative finger configuration and
 * differ only by how the whole hand is rotated in space - G/Q (sideways vs.
 * pointing down), H/U (sideways vs. pointing up), and K/P (pointing up vs.
 * down). A purely rotation-invariant feature set can never tell these apart
 * (that's the whole point of rotation invariance), so `handOrientation`
 * captures the absolute angle of the wrist -> middle-MCP vector relative to
 * "up" in the camera image, normalized to [0, 1] (0 = pointing up, 0.5 =
 * sideways, 1 = pointing down).
 *
 * Distances are normalized by `palmSize` (wrist -> middle-MCP), so the
 * result is stable regardless of how close the hand is to the camera.
 * Returns a zero vector for malformed input rather than throwing.
 */
export function getFeatureVector(landmarks: HandLandmarks): number[] {
  if (!Array.isArray(landmarks) || landmarks.length !== 21) {
    return new Array<number>(FEATURE_COUNT).fill(0)
  }

  const wrist = landmarks[WRIST]
  const middleMcp = landmarks[MIDDLE_MCP]
  const palmSize = Math.max(distance(wrist, middleMcp), 1e-6)

  const thumbCurl = computeCurl(landmarks[THUMB_MCP], landmarks[THUMB_IP], landmarks[THUMB_TIP])
  const indexCurl = computeCurl(landmarks[INDEX_MCP], landmarks[INDEX_PIP], landmarks[INDEX_TIP])
  const middleCurl = computeCurl(landmarks[MIDDLE_MCP], landmarks[MIDDLE_PIP], landmarks[MIDDLE_TIP])
  const ringCurl = computeCurl(landmarks[RING_MCP], landmarks[RING_PIP], landmarks[RING_TIP])
  const pinkyCurl = computeCurl(landmarks[PINKY_MCP], landmarks[PINKY_PIP], landmarks[PINKY_TIP])

  // Thumb-across-palm (S/T/M/N) vs thumb-out-to-the-side (A/L/Y): captured
  // by how close the thumb tip sits to the index-side vs the pinky-side of
  // the hand.
  const thumbToIndexMcp = distance(landmarks[THUMB_TIP], landmarks[INDEX_MCP]) / palmSize
  const thumbToPinkyMcp = distance(landmarks[THUMB_TIP], landmarks[PINKY_MCP]) / palmSize

  // Inter-fingertip spread: large when fingers are splayed apart (B/V/W/Y),
  // small when fingers are together or curled into the palm (U/H/fist).
  const indexMiddleSpread = distance(landmarks[INDEX_TIP], landmarks[MIDDLE_TIP]) / palmSize
  const middleRingSpread = distance(landmarks[MIDDLE_TIP], landmarks[RING_TIP]) / palmSize
  const ringPinkySpread = distance(landmarks[RING_TIP], landmarks[PINKY_TIP]) / palmSize

  // Absolute hand orientation (NOT rotation-invariant, intentionally - see
  // the doc comment above). angleBetweenDeg returns [0, 180]; normalize to
  // [0, 1] so it's on a comparable scale to the other features.
  const handOrientation = angleBetweenDeg(subtract(middleMcp, wrist), UP) / 180

  return [
    thumbCurl,
    indexCurl,
    middleCurl,
    ringCurl,
    pinkyCurl,
    thumbToIndexMcp,
    thumbToPinkyMcp,
    indexMiddleSpread,
    middleRingSpread,
    ringPinkySpread,
    handOrientation,
  ]
}

// ---------------------------------------------------------------------------
// Hand-crafted prototypes, one per recognizable static letter (A-Y, no J/Z -
// both require in-air motion a single static frame can't capture).
//
// Values are relative/illustrative (see FEATURE_NAMES for the units: curls
// in [0, 1], distances normalized by palm size) - the goal is correct
// relative ordering per the standard American Manual Alphabet, not a fit to
// real sensor data.
// ---------------------------------------------------------------------------

// handOrientation reference values (11th feature, see getFeatureVector):
// ~0.08 for a naturally-held upright hand (the default below), ~0.5 for the
// sideways-tipped pair (G, H), ~0.94 for the pointing-down pair (Q, P). K and
// U keep the upright default since they're the "pointing up" half of their
// respective orientation-twin pairs.
const ORIENTATION_UPRIGHT = 0.08
const ORIENTATION_SIDEWAYS = 0.5
const ORIENTATION_DOWN = 0.94

export const LETTER_PROTOTYPES: Record<string, number[]> = {
  // Fist, thumb resting alongside the curled index finger (not across).
  A: [0.2, 0.9, 0.9, 0.9, 0.9, 0.3, 0.9, 0.15, 0.15, 0.15, ORIENTATION_UPRIGHT],
  // Flat hand, four fingers extended and together, thumb folded across palm.
  B: [0.75, 0.05, 0.05, 0.05, 0.05, 0.5, 0.55, 0.12, 0.12, 0.12, ORIENTATION_UPRIGHT],
  // Curved "C" - fingers and thumb both partially curled.
  C: [0.4, 0.45, 0.45, 0.45, 0.45, 0.5, 0.6, 0.2, 0.2, 0.2, ORIENTATION_UPRIGHT],
  // Index straight up, other three curled with tips near thumb.
  D: [0.5, 0.05, 0.85, 0.85, 0.85, 0.35, 0.6, 0.4, 0.12, 0.12, ORIENTATION_UPRIGHT],
  // Fingers curled down close together, thumb tucked under the fingertips.
  E: [0.7, 0.8, 0.8, 0.8, 0.8, 0.4, 0.5, 0.1, 0.1, 0.1, ORIENTATION_UPRIGHT],
  // Index and thumb touching (circle), middle/ring/pinky straight & together.
  F: [0.55, 0.55, 0.05, 0.05, 0.05, 0.2, 0.55, 0.35, 0.15, 0.15, ORIENTATION_UPRIGHT],
  // Index and thumb extended sideways, other three curled. Orientation-twin of Q.
  G: [0.2, 0.1, 0.85, 0.85, 0.85, 0.3, 0.8, 0.4, 0.12, 0.12, ORIENTATION_SIDEWAYS],
  // Index and middle extended together (sideways), ring/pinky curled. Orientation-twin of U.
  H: [0.4, 0.1, 0.1, 0.85, 0.85, 0.45, 0.65, 0.12, 0.4, 0.12, ORIENTATION_SIDEWAYS],
  // Pinky only extended, thumb tucked across, rest curled.
  I: [0.6, 0.85, 0.85, 0.85, 0.05, 0.4, 0.55, 0.1, 0.1, 0.6, ORIENTATION_UPRIGHT],
  // Index and middle extended & spread, thumb extended up between them. Orientation-twin of P.
  K: [0.25, 0.1, 0.1, 0.85, 0.85, 0.3, 0.6, 0.4, 0.35, 0.15, ORIENTATION_UPRIGHT],
  // Thumb and index extended at a right angle, other three curled.
  L: [0.1, 0.05, 0.85, 0.85, 0.85, 0.6, 0.9, 0.45, 0.1, 0.1, ORIENTATION_UPRIGHT],
  // Fist, thumb tucked deepest - under index/middle/ring, tip toward the pinky side.
  M: [0.78, 0.9, 0.9, 0.9, 0.9, 0.55, 0.48, 0.1, 0.1, 0.1, ORIENTATION_UPRIGHT],
  // Fist, thumb tucked under index/middle only - shallower than M, tip more central.
  N: [0.68, 0.9, 0.9, 0.9, 0.9, 0.42, 0.6, 0.1, 0.1, 0.1, ORIENTATION_UPRIGHT],
  // Rounded "O" - all fingertips curl in to meet the thumb.
  O: [0.55, 0.6, 0.6, 0.6, 0.6, 0.25, 0.55, 0.15, 0.15, 0.15, ORIENTATION_UPRIGHT],
  // Like K but pointing down (index/middle spread, thumb between them). Orientation-twin of K.
  P: [0.25, 0.12, 0.12, 0.85, 0.85, 0.32, 0.58, 0.38, 0.32, 0.15, ORIENTATION_DOWN],
  // Like G but pointing down. Orientation-twin of G.
  Q: [0.22, 0.12, 0.85, 0.85, 0.85, 0.32, 0.78, 0.42, 0.12, 0.12, ORIENTATION_DOWN],
  // Index and middle crossed, ring/pinky curled, thumb across.
  R: [0.45, 0.15, 0.15, 0.85, 0.85, 0.45, 0.55, 0.05, 0.35, 0.12, ORIENTATION_UPRIGHT],
  // Fist, thumb wrapped across the FRONT of the curled fingers (not tucked underneath like M/N).
  S: [0.58, 0.9, 0.9, 0.9, 0.9, 0.46, 0.55, 0.1, 0.1, 0.1, ORIENTATION_UPRIGHT],
  // Fist, thumb tip poking OUT between index and middle - least curled/most visible of the four.
  T: [0.45, 0.88, 0.88, 0.88, 0.88, 0.3, 0.7, 0.1, 0.1, 0.1, ORIENTATION_UPRIGHT],
  // Index and middle extended together (upright), ring/pinky curled. Orientation-twin of H.
  U: [0.4, 0.1, 0.1, 0.85, 0.85, 0.45, 0.6, 0.12, 0.4, 0.12, ORIENTATION_UPRIGHT],
  // Index and middle extended & spread ("peace"), ring/pinky curled.
  V: [0.5, 0.1, 0.1, 0.85, 0.85, 0.45, 0.55, 0.6, 0.55, 0.15, ORIENTATION_UPRIGHT],
  // Index, middle, ring extended & spread, pinky curled, thumb near pinky.
  W: [0.55, 0.08, 0.08, 0.1, 0.85, 0.7, 0.25, 0.45, 0.45, 0.35, ORIENTATION_UPRIGHT],
  // Index hooked (partial curl), rest curled into fist, thumb alongside.
  X: [0.25, 0.5, 0.9, 0.9, 0.9, 0.3, 0.85, 0.12, 0.12, 0.12, ORIENTATION_UPRIGHT],
  // Thumb and pinky extended ("hang loose"), other three curled.
  Y: [0.1, 0.85, 0.85, 0.85, 0.05, 0.6, 0.85, 0.1, 0.1, 0.6, ORIENTATION_UPRIGHT],
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Minimum confidence a top match must clear to be reported as `best`. */
const MIN_CONFIDENCE = 0.4

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

/** Converts a feature-space distance to a confidence in (0, 1]; 0 distance -> 1. */
function distanceToConfidence(dist: number): number {
  return 1 / (1 + dist)
}

/**
 * Classifies a single detected hand's static shape against the American
 * Manual Alphabet (letters A-Y, excluding J and Z, which require motion).
 *
 * Malformed input (wrong landmark count) yields `{ best: null, candidates: [] }`
 * rather than throwing.
 */
export function classifyHandShape(landmarks: HandLandmarks): ClassificationResult {
  if (!Array.isArray(landmarks) || landmarks.length !== 21) {
    return { best: null, candidates: [] }
  }

  const featureVector = getFeatureVector(landmarks)

  const scored: ClassificationCandidate[] = Object.entries(LETTER_PROTOTYPES).map(
    ([letter, prototype]) => ({
      letter,
      confidence: distanceToConfidence(euclideanDistance(featureVector, prototype)),
    }),
  )
  scored.sort((a, b) => b.confidence - a.confidence)

  const candidates = scored.slice(0, 3)
  const top = candidates[0]
  const best = top && top.confidence >= MIN_CONFIDENCE ? top : null

  return { best, candidates }
}
