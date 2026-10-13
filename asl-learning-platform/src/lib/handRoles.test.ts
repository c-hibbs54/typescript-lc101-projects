import { describe, expect, it } from 'vitest'
import { assignHandRoles, createHandRoleTracker, type UnroledHand } from './handRoles'
import type { Handedness } from '../types/asl'

function hand(handedness: Handedness, handednessScore = 0.9): UnroledHand {
  return {
    landmarks: Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 })),
    handedness,
    handednessScore,
    timestampMs: 0,
  }
}

/** A hand at a specific wrist position, so cross-frame tracking can be exercised. */
function handAt(handedness: Handedness, x: number, y: number, handednessScore = 0.9): UnroledHand {
  const h = hand(handedness, handednessScore)
  return { ...h, landmarks: h.landmarks.map((_, i) => (i === 0 ? { x, y, z: 0 } : { x, y, z: 0 })) }
}

describe('assignHandRoles', () => {
  it('returns nothing for no hands', () => {
    expect(assignHandRoles([], 'Right')).toEqual([])
  })

  it('makes a lone hand primary regardless of which hand it is', () => {
    expect(assignHandRoles([hand('Right')], 'Right')[0].role).toBe('primary')
    expect(assignHandRoles([hand('Left')], 'Right')[0].role).toBe('primary')
    expect(assignHandRoles([hand('Right')], 'Left')[0].role).toBe('primary')
  })

  it('gives primary to the hand matching the dominant preference', () => {
    const roled = assignHandRoles([hand('Left'), hand('Right')], 'Right')
    expect(roled.find((h) => h.handedness === 'Right')?.role).toBe('primary')
    expect(roled.find((h) => h.handedness === 'Left')?.role).toBe('secondary')
  })

  it('respects a left-dominant preference', () => {
    const roled = assignHandRoles([hand('Left'), hand('Right')], 'Left')
    expect(roled.find((h) => h.handedness === 'Left')?.role).toBe('primary')
    expect(roled.find((h) => h.handedness === 'Right')?.role).toBe('secondary')
  })

  it('is independent of the order MediaPipe returned the hands in', () => {
    const a = assignHandRoles([hand('Left'), hand('Right')], 'Right')
    const b = assignHandRoles([hand('Right'), hand('Left')], 'Right')
    expect(a[0].handedness).toBe('Right')
    expect(b[0].handedness).toBe('Right')
    expect(a[0].role).toBe('primary')
    expect(b[0].role).toBe('primary')
  })

  it('always puts the primary hand first', () => {
    const roled = assignHandRoles([hand('Left'), hand('Right')], 'Right')
    expect(roled[0].role).toBe('primary')
    expect(roled.slice(1).every((h) => h.role === 'secondary')).toBe(true)
  })

  it('assigns exactly one primary even when both hands report the same handedness', () => {
    const roled = assignHandRoles([hand('Right', 0.7), hand('Right', 0.95)], 'Right')
    expect(roled.filter((h) => h.role === 'primary')).toHaveLength(1)
    expect(roled.filter((h) => h.role === 'secondary')).toHaveLength(1)
    // The more confident of the two ambiguous hands should win primary.
    expect(roled[0].handednessScore).toBe(0.95)
  })

  it('falls back to the most confident hand when neither matches the preference', () => {
    const roled = assignHandRoles([hand('Left', 0.6), hand('Left', 0.99)], 'Right')
    expect(roled[0].role).toBe('primary')
    expect(roled[0].handednessScore).toBe(0.99)
    expect(roled).toHaveLength(2)
  })

  it('marks every extra hand beyond the primary as secondary', () => {
    const roled = assignHandRoles([hand('Right'), hand('Left'), hand('Left')], 'Right')
    expect(roled).toHaveLength(3)
    expect(roled.filter((h) => h.role === 'primary')).toHaveLength(1)
    expect(roled.filter((h) => h.role === 'secondary')).toHaveLength(2)
  })

  it('preserves each hand\'s landmarks and metadata', () => {
    const input = [hand('Right', 0.88)]
    const [out] = assignHandRoles(input, 'Right')
    expect(out.landmarks).toHaveLength(21)
    expect(out.handedness).toBe('Right')
    expect(out.handednessScore).toBe(0.88)
  })
})

describe('createHandRoleTracker (hysteresis)', () => {
  // The signing hand sits right, the resting hand left, and they stay put.
  const SIGNING = { x: 0.7, y: 0.5 }
  const RESTING = { x: 0.25, y: 0.5 }

  /** Which position the tracker currently calls primary. */
  function primaryX(tracker: ReturnType<typeof createHandRoleTracker>, hands: UnroledHand[]): number {
    const roled = tracker.assign(hands)
    return roled[0].landmarks[0].x
  }

  it('does not swap the main hand for a single flipped-handedness frame', () => {
    const tracker = createHandRoleTracker('Right')
    const good = [handAt('Left', RESTING.x, RESTING.y, 0.9), handAt('Right', SIGNING.x, SIGNING.y, 0.95)]
    expect(primaryX(tracker, good)).toBeCloseTo(SIGNING.x)

    // MediaPipe mislabels both hands 'Left' for one frame; the resting hand
    // would win the stateless preference, but the role must hold.
    const glitch = [handAt('Left', RESTING.x, RESTING.y, 0.99), handAt('Left', SIGNING.x, SIGNING.y, 0.6)]
    expect(primaryX(tracker, glitch)).toBeCloseTo(SIGNING.x)

    // And it recovers cleanly.
    expect(primaryX(tracker, good)).toBeCloseTo(SIGNING.x)
  })

  it('holds the main hand through a sustained burst of jitter shorter than the switch delay', () => {
    const tracker = createHandRoleTracker('Right')
    const good = [handAt('Left', RESTING.x, RESTING.y, 0.9), handAt('Right', SIGNING.x, SIGNING.y, 0.95)]
    primaryX(tracker, good)

    const glitch = [handAt('Left', RESTING.x, RESTING.y, 0.99), handAt('Left', SIGNING.x, SIGNING.y, 0.6)]
    for (let frame = 0; frame < 7; frame++) {
      expect(primaryX(tracker, glitch), `frame ${frame}`).toBeCloseTo(SIGNING.x)
    }
  })

  it('eventually does switch when the disagreement is sustained (a real hand swap)', () => {
    const tracker = createHandRoleTracker('Right')
    primaryX(tracker, [handAt('Left', RESTING.x, RESTING.y, 0.9), handAt('Right', SIGNING.x, SIGNING.y, 0.95)])

    // The learner genuinely switches hands: the left hand is now the Right-labelled one.
    const swapped = [handAt('Right', RESTING.x, RESTING.y, 0.97), handAt('Left', SIGNING.x, SIGNING.y, 0.9)]
    let switched = false
    for (let frame = 0; frame < 20 && !switched; frame++) {
      switched = Math.abs(primaryX(tracker, swapped) - RESTING.x) < 0.01
    }
    expect(switched).toBe(true)
  })

  it('re-colours immediately when the learner flips their dominant-hand preference', () => {
    const tracker = createHandRoleTracker('Right')
    const hands = [handAt('Left', RESTING.x, RESTING.y, 0.9), handAt('Right', SIGNING.x, SIGNING.y, 0.95)]
    expect(primaryX(tracker, hands)).toBeCloseTo(SIGNING.x)

    tracker.setDominantHand('Left')
    // No waiting out the switch delay - the very next frame respects the new preference.
    expect(primaryX(tracker, hands)).toBeCloseTo(RESTING.x)
  })

  it('keeps exactly one primary every frame', () => {
    const tracker = createHandRoleTracker('Right')
    const hands = [handAt('Left', RESTING.x, RESTING.y), handAt('Right', SIGNING.x, SIGNING.y)]
    for (let frame = 0; frame < 5; frame++) {
      const roled = tracker.assign(hands)
      expect(roled.filter((h) => h.role === 'primary')).toHaveLength(1)
      expect(roled[0].role).toBe('primary')
    }
  })

  it('handles a hand briefly dropping out without forfeiting its role', () => {
    const tracker = createHandRoleTracker('Right')
    const hands = [handAt('Left', RESTING.x, RESTING.y, 0.9), handAt('Right', SIGNING.x, SIGNING.y, 0.95)]
    expect(primaryX(tracker, hands)).toBeCloseTo(SIGNING.x)

    expect(tracker.assign([])).toEqual([])

    // Only the resting hand is visible: it becomes primary (it's the only hand).
    expect(primaryX(tracker, [handAt('Left', RESTING.x, RESTING.y, 0.9)])).toBeCloseTo(RESTING.x)
  })

  it('reset() forgets stickiness so the next frame is decided fresh', () => {
    const tracker = createHandRoleTracker('Right')
    const good = [handAt('Left', RESTING.x, RESTING.y, 0.9), handAt('Right', SIGNING.x, SIGNING.y, 0.95)]
    primaryX(tracker, good)

    tracker.reset()
    const glitch = [handAt('Left', RESTING.x, RESTING.y, 0.99), handAt('Left', SIGNING.x, SIGNING.y, 0.6)]
    // With no history, the stateless preference decides immediately.
    expect(primaryX(tracker, glitch)).toBeCloseTo(RESTING.x)
  })
})
