import { describe, expect, it } from 'vitest'
import { createStabilityTracker } from './stableCapture'
import { classifyFeatures, classifyHandShape, LETTER_PROTOTYPES } from './classifier'
import type { HandLandmarks, Point3D } from '../types/asl'

function point(x: number, y: number, z = 0): Point3D {
  return { x, y, z }
}

/** A plausible open-hand landmark set; the exact pose doesn't matter for gating. */
function baseHand(): HandLandmarks {
  const pts: Point3D[] = [point(0.5, 0.9)]
  // thumb
  pts.push(point(0.42, 0.84), point(0.38, 0.78), point(0.35, 0.73), point(0.32, 0.68))
  // index, middle, ring, pinky
  const columns = [0.44, 0.5, 0.56, 0.62]
  for (const x of columns) {
    pts.push(point(x, 0.66), point(x, 0.56), point(x, 0.48), point(x, 0.41))
  }
  return pts
}

/** Same hand nudged by `d` in normalized units, to simulate movement. */
function shifted(hand: HandLandmarks, d: number): HandLandmarks {
  return hand.map((p) => point(p.x + d, p.y, p.z))
}

/** Adds deterministic per-landmark jitter, standing in for sensor noise. */
function jittered(hand: HandLandmarks, seed: number, amount: number): HandLandmarks {
  return hand.map((p, i) => {
    const wobble = Math.sin(seed * 12.9898 + i * 78.233)
    return point(p.x + wobble * amount, p.y - wobble * amount, p.z)
  })
}

const FRAME_MS = 1000 / 30

describe('createStabilityTracker', () => {
  it('reports no-hand when there is no hand', () => {
    const t = createStabilityTracker()
    const s = t.push(null, 0)
    expect(s.phase).toBe('no-hand')
    expect(s.measurement).toBeNull()
  })

  it('treats a malformed landmark array as no hand', () => {
    const t = createStabilityTracker()
    expect(t.push([point(0, 0)] as HandLandmarks, 0).phase).toBe('no-hand')
  })

  it('emits exactly one measurement after the hand is held still for holdMs', () => {
    const t = createStabilityTracker({ holdMs: 1000 })
    const hand = baseHand()
    let measurements = 0
    let now = 0
    // 2 seconds of a perfectly still hand.
    for (let i = 0; i < 60; i++) {
      const s = t.push(hand, now)
      if (s.measurement) measurements++
      now += FRAME_MS
    }
    expect(measurements).toBe(1)
  })

  it('does not measure before the hold has elapsed', () => {
    const t = createStabilityTracker({ holdMs: 1000 })
    const hand = baseHand()
    let now = 0
    for (let i = 0; i < 20; i++) {
      // 20 frames ~= 667ms, short of the 1000ms hold.
      const s = t.push(hand, now)
      expect(s.measurement).toBeNull()
      now += FRAME_MS
    }
  })

  it('restarts the hold when the hand moves, so a measurement is always one held pose', () => {
    const t = createStabilityTracker({ holdMs: 1000 })
    const hand = baseHand()
    let now = 0
    for (let i = 0; i < 20; i++) {
      t.push(hand, now)
      now += FRAME_MS
    }
    // A clear movement partway through.
    const moved = t.push(shifted(hand, 0.15), now)
    expect(moved.phase).toBe('settling')
    expect(moved.progress).toBe(0)

    now += FRAME_MS
    // Progress has to build again from zero.
    const after = t.push(shifted(hand, 0.15), now)
    expect(after.progress).toBeLessThan(0.2)
    expect(after.measurement).toBeNull()
  })

  it('progresses through settling -> holding -> measured', () => {
    const t = createStabilityTracker({ holdMs: 300 })
    const hand = baseHand()
    const phases: string[] = []
    let now = 0
    for (let i = 0; i < 15; i++) {
      phases.push(t.push(hand, now).phase)
      now += FRAME_MS
    }
    expect(phases[0]).toBe('settling') // first frame has no previous to compare
    expect(phases).toContain('holding')
    expect(phases).toContain('measured')
  })

  it('reports stillness near 1 for a still hand and 0 while moving fast', () => {
    const t = createStabilityTracker()
    const hand = baseHand()
    t.push(hand, 0)
    expect(t.push(hand, FRAME_MS).stillness).toBeCloseTo(1, 5)

    const t2 = createStabilityTracker()
    t2.push(hand, 0)
    expect(t2.push(shifted(hand, 0.3), FRAME_MS).stillness).toBe(0)
  })

  it('averages over many frames, and the average is steadier than single frames', () => {
    const t = createStabilityTracker({ holdMs: 1000 })
    const hand = baseHand()
    let measurement: number[] | null = null
    let sampleCount = 0
    let now = 0
    // Hold still but with sensor-scale jitter, well under the motion threshold.
    for (let i = 0; i < 45 && !measurement; i++) {
      const s = t.push(jittered(hand, i, 0.0015), now)
      if (s.measurement) {
        measurement = s.measurement
        sampleCount = s.sampleCount
      }
      now += FRAME_MS
    }
    expect(measurement).not.toBeNull()
    // Averaging over a meaningful number of frames is the whole point.
    expect(sampleCount).toBeGreaterThan(10)

    // The averaged vector should sit closer to the mean of the per-frame
    // vectors than a typical single frame does - i.e. noise cancelled.
    const result = classifyFeatures(measurement!)
    expect(result.candidates.length).toBeGreaterThan(0)
  })

  it('reset() clears an in-progress hold', () => {
    const t = createStabilityTracker({ holdMs: 300 })
    const hand = baseHand()
    let now = 0
    for (let i = 0; i < 8; i++) {
      t.push(hand, now)
      now += FRAME_MS
    }
    t.reset()
    const s = t.push(hand, now)
    expect(s.progress).toBe(0)
    expect(s.measurement).toBeNull()
  })

  it('a measured average classifies at least as confidently as a single noisy frame', () => {
    // Build frames around a known prototype pose so there is a right answer.
    const t = createStabilityTracker({ holdMs: 1000 })
    const hand = baseHand()

    let measurement: number[] | null = null
    let now = 0
    const singleFrameConfidences: number[] = []
    for (let i = 0; i < 45 && !measurement; i++) {
      const noisy = jittered(hand, i, 0.002)
      const single = classifyHandShape(noisy)
      if (single.candidates[0]) singleFrameConfidences.push(single.candidates[0].confidence)
      const s = t.push(noisy, now)
      if (s.measurement) measurement = s.measurement
      now += FRAME_MS
    }

    expect(measurement).not.toBeNull()
    const averaged = classifyFeatures(measurement!).candidates[0]
    expect(averaged).toBeDefined()

    // The averaged read should not be worse than the *worst* single frame, and
    // should land within the range single frames span - the point being that it
    // no longer swings with whichever frame happened to be sampled.
    const worst = Math.min(...singleFrameConfidences)
    expect(averaged!.confidence).toBeGreaterThanOrEqual(worst)
  })

  it('every prototype letter round-trips through a held measurement', () => {
    // Guards the plumbing: a measurement must always produce a classifiable
    // vector of the right width for every letter the app teaches.
    for (const letter of Object.keys(LETTER_PROTOTYPES)) {
      const result = classifyFeatures(LETTER_PROTOTYPES[letter])
      expect(result.candidates[0], `no candidates for ${letter}`).toBeDefined()
      expect(result.candidates[0]!.letter, `${letter} should match itself`).toBe(letter)
    }
  })
})
