import { getFeatureVector } from './classifier'
import type { HandLandmarks } from '../types/asl'

/**
 * Turns a live landmark stream into deliberate, once-a-second *measurements*.
 *
 * Why not classify every frame: a single frame's landmarks carry real jitter, so
 * per-frame guesses wobble between neighbouring letters and never look
 * confident. Waiting until the hand is genuinely still and then averaging the
 * feature vectors over that hold cancels most of that noise, which both reads as
 * confident and *is* more accurate. It also means the (not free) classification
 * runs about once per hold instead of 30-60 times a second.
 *
 * The cycle: no-hand -> settling (hand moving) -> holding (still, collecting)
 * -> measured (a result is ready). Any real movement drops it back to settling,
 * so a measurement always reflects one intentional, held pose.
 */

export type CapturePhase = 'no-hand' | 'settling' | 'holding' | 'measured'

export interface CaptureState {
  phase: CapturePhase
  /** 0-1 progress through the required hold; drives the on-screen ring. */
  progress: number
  /** 0-1, how still the hand is right now (1 = perfectly still). */
  stillness: number
  /**
   * Set on the frame a measurement completes: the mean feature vector across
   * the hold, ready for `classifyFeatures`. Null on every other frame.
   */
  measurement: number[] | null
  /** How many frames the completed measurement averaged over. */
  sampleCount: number
}

export interface StabilityTrackerOptions {
  /** Total still time required before a measurement is emitted. */
  holdMs?: number
  /**
   * Max mean per-landmark movement between frames (as a fraction of palm size)
   * still counted as "held". Above this the hold restarts.
   */
  motionThreshold?: number
  /** Ignore this much of the hold before sampling, so the settle isn't averaged in. */
  warmupFraction?: number
}

const DEFAULTS = {
  holdMs: 1000,
  motionThreshold: 0.035,
  warmupFraction: 0.3,
}

export interface StabilityTracker {
  push: (landmarks: HandLandmarks | null, nowMs: number) => CaptureState
  reset: () => void
}

const IDLE: CaptureState = {
  phase: 'no-hand',
  progress: 0,
  stillness: 0,
  measurement: null,
  sampleCount: 0,
}

export function createStabilityTracker(options: StabilityTrackerOptions = {}): StabilityTracker {
  const holdMs = options.holdMs ?? DEFAULTS.holdMs
  const motionThreshold = options.motionThreshold ?? DEFAULTS.motionThreshold
  const warmupFraction = options.warmupFraction ?? DEFAULTS.warmupFraction

  let previous: HandLandmarks | null = null
  let holdStart: number | null = null
  let samples: number[][] = []
  /** Latched after a measurement so one hold yields exactly one result. */
  let emitted = false

  const reset = () => {
    previous = null
    holdStart = null
    samples = []
    emitted = false
  }

  const push = (landmarks: HandLandmarks | null, nowMs: number): CaptureState => {
    if (!landmarks || landmarks.length !== 21) {
      reset()
      return IDLE
    }

    const motion = previous ? meanMotion(previous, landmarks) : Infinity
    previous = landmarks

    // Infinity on the first frame maps to 0 stillness rather than NaN.
    const stillness = Number.isFinite(motion) ? clamp01(1 - motion / motionThreshold) : 0
    const still = Number.isFinite(motion) && motion <= motionThreshold

    if (!still) {
      holdStart = null
      samples = []
      emitted = false
      return { phase: 'settling', progress: 0, stillness, measurement: null, sampleCount: 0 }
    }

    if (holdStart === null) holdStart = nowMs
    const heldMs = nowMs - holdStart
    const progress = clamp01(heldMs / holdMs)

    // Skip the first slice of the hold: the hand is often still drifting to a
    // stop, and averaging that in blurs the pose.
    if (progress >= warmupFraction) samples.push(getFeatureVector(landmarks))

    if (progress >= 1 && !emitted && samples.length > 0) {
      emitted = true
      const measurement = averageVectors(samples)
      const sampleCount = samples.length
      return { phase: 'measured', progress: 1, stillness, measurement, sampleCount }
    }

    return {
      phase: emitted ? 'measured' : 'holding',
      progress,
      stillness,
      measurement: null,
      sampleCount: samples.length,
    }
  }

  return { push, reset }
}

/**
 * Mean per-landmark movement between two frames, scaled by palm size so the
 * threshold means the same thing whether the hand is near or far from the camera.
 */
function meanMotion(a: HandLandmarks, b: HandLandmarks): number {
  const palm = Math.max(distance(b[0], b[9]), 1e-6)
  let total = 0
  for (let i = 0; i < 21; i++) {
    total += distance(a[i], b[i])
  }
  return total / 21 / palm
}

function distance(p: { x: number; y: number; z: number }, q: { x: number; y: number; z: number }): number {
  return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)
}

function averageVectors(vectors: number[][]): number[] {
  const length = vectors[0].length
  const out = new Array<number>(length).fill(0)
  for (const vector of vectors) {
    for (let i = 0; i < length; i++) out[i] += vector[i]
  }
  for (let i = 0; i < length; i++) out[i] /= vectors.length
  return out
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}
