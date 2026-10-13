import { describe, expect, it } from 'vitest'
import type { HandLandmarks, Point3D } from '../types/asl'
import { classifyHandShape, computeCurl, FEATURE_NAMES, getFeatureVector, LETTER_PROTOTYPES } from './classifier'

// ---------------------------------------------------------------------------
// Synthetic landmark fixture builders.
//
// We don't have real MediaPipe output to test against, so we construct
// plausible hand geometry by hand: a fixed palm (wrist + 5 MCP joints) and,
// per finger, either a "straight" chain (three joints continuing in the same
// direction away from the MCP -> curl ~= 0) or a "curled" chain (the distal
// joints fold back toward the MCP -> curl ~= 1). This keeps the fixtures
// readable while still producing internally-consistent 21-point hands.
// ---------------------------------------------------------------------------

function unit(dx: number, dy: number): { dx: number; dy: number } {
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  return { dx: dx / len, dy: dy / len }
}

function point(x: number, y: number): Point3D {
  return { x, y, z: 0 }
}

/** Straight finger: pip/dip/tip continue in `dir` away from mcp -> curl ~= 0. */
function straightFinger(mcp: Point3D, dir: { dx: number; dy: number }, segLen = 0.1): Point3D[] {
  const pip = point(mcp.x + dir.dx * segLen, mcp.y + dir.dy * segLen)
  const dip = point(pip.x + dir.dx * segLen, pip.y + dir.dy * segLen)
  const tip = point(dip.x + dir.dx * segLen, dip.y + dir.dy * segLen)
  return [pip, dip, tip]
}

/** Curled finger: after pip, dip/tip fold back toward the mcp -> curl ~= 1. */
function curledFinger(mcp: Point3D, dir: { dx: number; dy: number }, segLen = 0.1): Point3D[] {
  const pip = point(mcp.x + dir.dx * segLen, mcp.y + dir.dy * segLen)
  const dip = point(pip.x - dir.dx * segLen * 0.6, pip.y - dir.dy * segLen * 0.6)
  const tip = point(dip.x - dir.dx * segLen * 0.3, dip.y - dir.dy * segLen * 0.3)
  return [pip, dip, tip]
}

/** Straight thumb: ip/tip continue in `dir` away from mcp -> curl ~= 0. */
function straightThumb(mcp: Point3D, dir: { dx: number; dy: number }, segLen = 0.08): Point3D[] {
  const ip = point(mcp.x + dir.dx * segLen, mcp.y + dir.dy * segLen)
  const tip = point(ip.x + dir.dx * segLen, ip.y + dir.dy * segLen)
  return [ip, tip]
}

/** Curled thumb: tip folds back toward the mcp side of ip -> curl ~= 1. */
function curledThumb(mcp: Point3D, dir: { dx: number; dy: number }, segLen = 0.08): Point3D[] {
  const ip = point(mcp.x + dir.dx * segLen, mcp.y + dir.dy * segLen)
  const tip = point(ip.x - dir.dx * segLen * 0.8, ip.y - dir.dy * segLen * 0.8)
  return [ip, tip]
}

const WRIST = point(0.5, 0.9)
const THUMB_CMC = point(0.38, 0.68)
const THUMB_MCP = point(0.34, 0.62)
const INDEX_MCP = point(0.4, 0.6)
const MIDDLE_MCP = point(0.47, 0.58)
const RING_MCP = point(0.54, 0.6)
const PINKY_MCP = point(0.61, 0.63)

const UP = unit(0, -1)

interface FingerChains {
  thumb: Point3D[] // [ip, tip]
  index: Point3D[] // [pip, dip, tip]
  middle: Point3D[]
  ring: Point3D[]
  pinky: Point3D[]
}

function buildHand(fingers: FingerChains): HandLandmarks {
  return [
    WRIST,
    THUMB_CMC,
    THUMB_MCP,
    fingers.thumb[0],
    fingers.thumb[1],
    INDEX_MCP,
    fingers.index[0],
    fingers.index[1],
    fingers.index[2],
    MIDDLE_MCP,
    fingers.middle[0],
    fingers.middle[1],
    fingers.middle[2],
    RING_MCP,
    fingers.ring[0],
    fingers.ring[1],
    fingers.ring[2],
    PINKY_MCP,
    fingers.pinky[0],
    fingers.pinky[1],
    fingers.pinky[2],
  ]
}

// --- Shape fixtures ---------------------------------------------------------

/** B: flat open hand, four fingers straight & together, thumb folded across. */
const handB = buildHand({
  thumb: curledThumb(THUMB_MCP, unit(1, 0.3)),
  index: straightFinger(INDEX_MCP, UP),
  middle: straightFinger(MIDDLE_MCP, UP),
  ring: straightFinger(RING_MCP, UP),
  pinky: straightFinger(PINKY_MCP, UP),
})

/** A: fist, thumb resting alongside the curled index finger. */
const handA = buildHand({
  thumb: straightThumb(THUMB_MCP, unit(-0.2, -1)),
  index: curledFinger(INDEX_MCP, UP),
  middle: curledFinger(MIDDLE_MCP, UP),
  ring: curledFinger(RING_MCP, UP),
  pinky: curledFinger(PINKY_MCP, UP),
})

/** L: thumb and index extended (right angle), other three curled. */
const handL = buildHand({
  thumb: straightThumb(THUMB_MCP, unit(-1, 0.15)),
  index: straightFinger(INDEX_MCP, UP),
  middle: curledFinger(MIDDLE_MCP, UP),
  ring: curledFinger(RING_MCP, UP),
  pinky: curledFinger(PINKY_MCP, UP),
})

/** Y: thumb and pinky extended ("hang loose"), other three curled. */
const handY = buildHand({
  thumb: straightThumb(THUMB_MCP, unit(-1, -0.3)),
  index: curledFinger(INDEX_MCP, UP),
  middle: curledFinger(MIDDLE_MCP, UP),
  ring: curledFinger(RING_MCP, UP),
  pinky: straightFinger(PINKY_MCP, UP),
})

/** V: index and middle extended & spread apart ("peace"), other three curled. */
const handV = buildHand({
  thumb: curledThumb(THUMB_MCP, unit(0.3, 0.9)),
  index: straightFinger(INDEX_MCP, unit(-0.5, -1)),
  middle: straightFinger(MIDDLE_MCP, unit(0.25, -1)),
  ring: curledFinger(RING_MCP, UP),
  pinky: curledFinger(PINKY_MCP, UP),
})

/** I: pinky only extended, other three curled, thumb tucked. */
const handI = buildHand({
  thumb: curledThumb(THUMB_MCP, unit(0.6, 0.4)),
  index: curledFinger(INDEX_MCP, UP),
  middle: curledFinger(MIDDLE_MCP, UP),
  ring: curledFinger(RING_MCP, UP),
  pinky: straightFinger(PINKY_MCP, UP),
})

describe('LETTER_PROTOTYPES', () => {
  it('has one entry per recognizable static letter (A-Y, no J/Z)', () => {
    const letters = Object.keys(LETTER_PROTOTYPES).sort()
    expect(letters).toHaveLength(24)
    expect(letters).not.toContain('J')
    expect(letters).not.toContain('Z')
  })

  it('every prototype vector matches the feature vector length', () => {
    const featureLength = getFeatureVector(handA).length
    for (const [letter, prototype] of Object.entries(LETTER_PROTOTYPES)) {
      expect(prototype, `prototype for ${letter}`).toHaveLength(featureLength)
    }
  })

  function protoDistance(a: string, b: string): number {
    const pa = LETTER_PROTOTYPES[a]
    const pb = LETTER_PROTOTYPES[b]
    let sum = 0
    for (let i = 0; i < pa.length; i++) sum += (pa[i] - pb[i]) ** 2
    return Math.sqrt(sum)
  }

  // Regression guard: these letter pairs look identical to a purely
  // rotation-invariant feature set (G/Q, H/U, K/P are the same handshape
  // rotated; M/N/S/T are all near-fist shapes differing only in thumb
  // position) and have previously been hand-tuned prototypes that were
  // accidentally almost numerically identical, making them unrecognizable as
  // distinct letters in practice. This doesn't assert they're easy to tell
  // apart (some, like N/S, are genuinely subtle) - just that they're not
  // copy-paste duplicates in disguise.
  it.each([
    ['G', 'Q'],
    ['H', 'U'],
    ['K', 'P'],
    ['M', 'N'],
    ['M', 'S'],
    ['M', 'T'],
    ['N', 'S'],
    ['N', 'T'],
    ['S', 'T'],
  ])('%s and %s prototypes are meaningfully separated', (a, b) => {
    expect(protoDistance(a, b)).toBeGreaterThan(0.09)
  })
})

describe('FEATURE_NAMES', () => {
  it('stays in sync with the actual length of getFeatureVector output', () => {
    // Guards against FEATURE_NAMES silently drifting out of alignment if
    // getFeatureVector's dimensions are ever added to/reordered/removed.
    expect(FEATURE_NAMES).toHaveLength(getFeatureVector(handA).length)
  })
})

describe('computeCurl', () => {
  it('is ~0 for a straight (colinear) joint chain', () => {
    const base = point(0, 0)
    const vertex = point(0, 1)
    const tip = point(0, 2)
    expect(computeCurl(base, vertex, tip)).toBeCloseTo(0, 5)
  })

  it('is ~1 when the tip folds straight back toward the base', () => {
    const base = point(0, 0)
    const vertex = point(0, 1)
    const tip = point(0, 0.4) // back toward base, past nothing - same side as base
    expect(computeCurl(base, vertex, tip)).toBeCloseTo(1, 5)
  })

  it('is ~0.5 for a right-angle bend', () => {
    const base = point(-1, 0)
    const vertex = point(0, 0)
    const tip = point(0, 1)
    expect(computeCurl(base, vertex, tip)).toBeCloseTo(0.5, 5)
  })

  it('increases monotonically as the joint bends further', () => {
    const base = point(-1, 0)
    const vertex = point(0, 0)
    const straightish = computeCurl(base, vertex, point(1, 0)) // 180deg -> curl 0
    const rightAngle = computeCurl(base, vertex, point(0, 1)) // 90deg -> curl 0.5
    const foldedBack = computeCurl(base, vertex, point(-1, 0.01)) // ~0deg -> curl ~1
    expect(straightish).toBeLessThan(rightAngle)
    expect(rightAngle).toBeLessThan(foldedBack)
  })
})

describe('classifyHandShape', () => {
  it('recognizes an open flat hand as B', () => {
    const result = classifyHandShape(handB)
    expect(result.best).not.toBeNull()
    expect(result.candidates[0]?.letter).toBe('B')
  })

  it('recognizes a closed fist with thumb alongside as A', () => {
    const result = classifyHandShape(handA)
    expect(result.best).not.toBeNull()
    expect(result.candidates[0]?.letter).toBe('A')
  })

  it('recognizes an L shape (thumb + index out)', () => {
    const result = classifyHandShape(handL)
    const topLetters = result.candidates.map((c) => c.letter)
    expect(topLetters).toContain('L')
    expect(result.candidates[0]?.letter).toBe('L')
  })

  it('recognizes a Y shape (thumb + pinky out)', () => {
    const result = classifyHandShape(handY)
    expect(result.candidates[0]?.letter).toBe('Y')
  })

  it('recognizes a V/peace shape (index + middle out and spread)', () => {
    const result = classifyHandShape(handV)
    expect(result.candidates[0]?.letter).toBe('V')
  })

  it('recognizes an I shape (pinky only out)', () => {
    const result = classifyHandShape(handI)
    expect(result.candidates[0]?.letter).toBe('I')
  })

  it('returns candidates sorted descending by confidence', () => {
    const result = classifyHandShape(handB)
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].confidence).toBeGreaterThanOrEqual(
        result.candidates[i].confidence,
      )
    }
    expect(result.candidates.length).toBeLessThanOrEqual(3)
  })

  it('sets best to the top candidate when confidence clears the threshold', () => {
    const result = classifyHandShape(handB)
    expect(result.best).toEqual(result.candidates[0])
  })

  it('returns an empty/null result for malformed input instead of throwing', () => {
    const tooFew = Array.from({ length: 5 }, () => point(0, 0)) as HandLandmarks
    expect(() => classifyHandShape(tooFew)).not.toThrow()
    const result = classifyHandShape(tooFew)
    expect(result).toEqual({ best: null, candidates: [] })
  })

  it('returns an empty/null result for an empty landmarks array', () => {
    const result = classifyHandShape([])
    expect(result).toEqual({ best: null, candidates: [] })
  })
})

describe('getFeatureVector', () => {
  it('returns a zero vector for malformed input instead of throwing', () => {
    const tooMany = Array.from({ length: 25 }, () => point(0, 0)) as HandLandmarks
    expect(() => getFeatureVector(tooMany)).not.toThrow()
    const features = getFeatureVector(tooMany)
    expect(features.every((v) => v === 0)).toBe(true)
  })

  it('produces low curls for all-straight fingers and high curls for all-curled fingers', () => {
    const openFeatures = getFeatureVector(handB)
    const fistFeatures = getFeatureVector(handA)
    // indexCurl, middleCurl, ringCurl, pinkyCurl are indices 1-4.
    for (const i of [1, 2, 3, 4]) {
      expect(openFeatures[i]).toBeLessThan(fistFeatures[i])
    }
  })

  it('produces a larger index-middle fingertip spread for V than for a fist', () => {
    const vFeatures = getFeatureVector(handV)
    const fistFeatures = getFeatureVector(handA)
    // indexMiddleSpread is index 7.
    expect(vFeatures[7]).toBeGreaterThan(fistFeatures[7])
  })
})
