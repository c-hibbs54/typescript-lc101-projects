import { describe, expect, it } from 'vitest'
import type { HandLandmarks, Point3D } from '../types/asl'
import {
  classifyFeatures,
  classifyHandShape,
  computeCurl,
  FEATURE_INDEX,
  FEATURE_NAMES,
  getFeatureVector,
  LETTER_PROTOTYPES,
} from './classifier'
import { buildHand, buildLetterHand, LETTER_POSES, type HandPose } from './handFixtures'

// ---------------------------------------------------------------------------
// Helpers. Synthetic hands come from handFixtures.ts, which turns joint angles
// into landmarks, so a test can ask for any letter, tip it, or wobble it.
// ---------------------------------------------------------------------------

function point(x: number, y: number, z = 0): Point3D {
  return { x, y, z }
}

function best(landmarks: HandLandmarks): string | undefined {
  return classifyHandShape(landmarks).candidates[0]?.letter
}

function feature(landmarks: HandLandmarks, name: keyof typeof FEATURE_INDEX): number {
  return getFeatureVector(landmarks)[FEATURE_INDEX[name]]
}

function tilted(letter: string, rotate: number): HandPose {
  return { ...LETTER_POSES[letter], rotate }
}

/** Deterministic, so a failure is always reproducible. */
function makeNoise(seed: number) {
  let state = seed >>> 0
  return (scale: number) => {
    let sum = -2
    for (let i = 0; i < 4; i++) {
      state = (state * 1664525 + 1013904223) >>> 0
      sum += state / 4294967296
    }
    return sum * scale
  }
}

const LETTERS = Object.keys(LETTER_POSES)

describe('computeCurl', () => {
  it('is ~0 for a straight (colinear) joint chain', () => {
    expect(computeCurl(point(0, 0), point(0, 1), point(0, 2))).toBeCloseTo(0, 5)
  })

  it('is ~1 when the tip folds straight back toward the base', () => {
    expect(computeCurl(point(0, 0), point(0, 1), point(0, 0.4))).toBeCloseTo(1, 5)
  })

  it('is ~0.5 for a right-angle bend', () => {
    expect(computeCurl(point(-1, 0), point(0, 0), point(0, 1))).toBeCloseTo(0.5, 5)
  })

  it('increases monotonically as the joint bends further', () => {
    const base = point(-1, 0)
    const vertex = point(0, 0)
    expect(computeCurl(base, vertex, point(1, 0))).toBeLessThan(
      computeCurl(base, vertex, point(0, 1)),
    )
    expect(computeCurl(base, vertex, point(0, 1))).toBeLessThan(
      computeCurl(base, vertex, point(-1, 0.01)),
    )
  })
})

describe('LETTER_PROTOTYPES', () => {
  it('has one entry per recognizable static letter (A-Y, no J/Z)', () => {
    const letters = Object.keys(LETTER_PROTOTYPES).sort()
    expect(letters).toHaveLength(24)
    expect(letters).not.toContain('J')
    expect(letters).not.toContain('Z')
  })

  it('every prototype vector matches the feature vector length', () => {
    for (const [letter, prototype] of Object.entries(LETTER_PROTOTYPES)) {
      expect(prototype, `prototype for ${letter}`).toHaveLength(FEATURE_NAMES.length)
    }
  })

  // The prototypes are measurements, not opinions. If one is hand-edited, or a
  // letter loses the pose it was read off, this fails rather than letting the
  // table drift away from what the extractor actually produces.
  it('matches what the extractor measures on that letter’s pose', () => {
    expect(Object.keys(LETTER_PROTOTYPES).sort()).toEqual([...LETTERS].sort())
    for (const letter of LETTERS) {
      const measured = getFeatureVector(buildLetterHand(letter))
      LETTER_PROTOTYPES[letter].forEach((value, i) => {
        // All but handOrientation, which stores the letter's shared group
        // reference angle rather than the fixture's own.
        if (FEATURE_NAMES[i] === 'handOrientation') return
        expect(value, `${letter}.${FEATURE_NAMES[i]}`).toBeCloseTo(measured[i], 2)
      })
    }
  })
})

describe('FEATURE_NAMES', () => {
  it('stays in sync with getFeatureVector output', () => {
    expect(FEATURE_NAMES).toHaveLength(getFeatureVector(buildLetterHand('A')).length)
  })

  it('indexes every feature exactly once', () => {
    expect(Object.keys(FEATURE_INDEX)).toHaveLength(FEATURE_NAMES.length)
    FEATURE_NAMES.forEach((name, i) => expect(FEATURE_INDEX[name]).toBe(i))
  })
})

// ---------------------------------------------------------------------------
// The three confusions reported from live webcam use, each with the feature
// that resolves it. These are the regression tests that matter most: all three
// were indistinguishable before, and each failed for its own structural reason.
// ---------------------------------------------------------------------------

describe('O versus C', () => {
  // C and O are the same curved hand. The only difference is whether the
  // fingertips close on the thumb — and the old vector measured the thumb
  // against the *knuckles*, which barely move between them.
  it('separates them by the thumb-to-fingertip gap, which is the whole letter', () => {
    const o = feature(buildLetterHand('O'), 'thumbToIndexTip')
    const c = feature(buildLetterHand('C'), 'thumbToIndexTip')
    expect(o).toBeLessThan(c - 0.3)
  })

  it('cannot tell them apart by thumb-to-knuckle distance alone', () => {
    // Documents *why* the new feature was needed: the old discriminator is
    // nearly identical across the pair.
    const o = feature(buildLetterHand('O'), 'thumbToIndexMcp')
    const c = feature(buildLetterHand('C'), 'thumbToIndexMcp')
    expect(Math.abs(o - c)).toBeLessThan(0.15)
  })

  it('reads each confidently, with the other far behind', () => {
    // Separation is the claim, not absence from the list: a rival sitting third
    // at 2% is not a confusion, and asserting it never appears would be testing
    // the shape of the output rather than the quality of the match.
    for (const [letter, rival] of [
      ['O', 'C'],
      ['C', 'O'],
    ]) {
      const result = classifyHandShape(buildLetterHand(letter))
      expect(result.best?.letter).toBe(letter)
      expect(result.best!.confidence).toBeGreaterThan(0.6)
      const rivalScore = result.candidates.find((c) => c.letter === rival)?.confidence ?? 0
      expect(rivalScore, `${rival} against ${letter}`).toBeLessThan(0.15)
    }
  })
})

describe('U versus V', () => {
  // Both are index + middle extended. V spreads them; U holds them together.
  it('separates them by the angle between the fingers, not tip distance', () => {
    const u = feature(buildLetterHand('U'), 'indexMiddleAngle')
    const v = feature(buildLetterHand('V'), 'indexMiddleAngle')
    expect(u).toBeLessThan(0.1)
    expect(v).toBeGreaterThan(0.3)
  })

  it('still reads a V whose fingers are only lazily spread', () => {
    // The failure mode being guarded: a tired V, spread far less than the
    // reference, used to collapse into U.
    const lazy: HandPose = {
      ...LETTER_POSES.V,
      index: { shape: 'straight', splay: -9 },
      middle: { shape: 'straight', splay: 7 },
    }
    expect(best(buildHand(lazy))).toBe('V')
  })

  it('reads each with the other far behind', () => {
    for (const [letter, rival] of [
      ['U', 'V'],
      ['V', 'U'],
    ]) {
      const result = classifyHandShape(buildLetterHand(letter))
      expect(result.best?.letter).toBe(letter)
      const rivalScore = result.candidates.find((c) => c.letter === rival)?.confidence ?? 0
      expect(rivalScore, `${rival} against ${letter}`).toBeLessThan(0.1)
    }
  })
})

describe('H versus U', () => {
  // Identical handshapes differing only in where the hand points. Scored as one
  // more term in the distance, a hand at 45 degrees sat equidistant from both
  // while every other feature voted "tie".
  it('has genuinely identical shape prototypes, so only orientation can decide', () => {
    LETTER_PROTOTYPES.H.forEach((value, i) => {
      if (FEATURE_NAMES[i] === 'handOrientation') return
      // Within the rounding the stored table carries: H's pose is U's rotated,
      // and an in-plane rotation preserves every distance here exactly, so any
      // gap is the two-decimal rounding and nothing else.
      expect(Math.abs(value - LETTER_PROTOTYPES.U[i]), FEATURE_NAMES[i]).toBeLessThanOrEqual(0.011)
    })
  })

  it.each([
    [0, 'U'],
    [25, 'U'],
    [60, 'H'],
    [81, 'H'],
  ])('a U-shaped hand rotated %i degrees reads as %s', (rotate, expected) => {
    expect(best(buildHand(tilted('U', rotate)))).toBe(expected)
  })

  it('drops the losing twin entirely rather than splitting confidence with it', () => {
    const result = classifyHandShape(buildHand(tilted('U', 81)))
    expect(result.best?.letter).toBe('H')
    expect(result.best!.confidence).toBeGreaterThan(0.6)
    expect(result.candidates.map((c) => c.letter)).not.toContain('U')
  })
})

describe('the other orientation twins', () => {
  it.each([
    ['G', 81, 'G'],
    ['G', 130, 'Q'],
    ['K', 0, 'K'],
    ['K', 140, 'P'],
  ])('a %s-shaped hand rotated %i degrees reads as %s', (shape, rotate, expected) => {
    expect(best(buildHand(tilted(shape, rotate)))).toBe(expected)
  })

  it('never leaves more than one member of a group in the running', () => {
    for (const rotate of [0, 30, 60, 90, 120, 150, 180]) {
      const letters = classifyFeatures(
        getFeatureVector(buildHand(tilted('K', rotate))),
      ).candidates.map((c) => c.letter)
      for (const group of [
        ['G', 'Q'],
        ['H', 'U'],
        ['K', 'P'],
      ]) {
        expect(group.filter((l) => letters.includes(l)).length).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('getFeatureVector', () => {
  it('returns a zero vector for malformed input instead of throwing', () => {
    const tooMany = Array.from({ length: 25 }, () => point(0, 0)) as HandLandmarks
    expect(() => getFeatureVector(tooMany)).not.toThrow()
    expect(getFeatureVector(tooMany).every((v) => v === 0)).toBe(true)
  })

  it('produces low curls for straight fingers and high curls for curled ones', () => {
    const open = getFeatureVector(buildLetterHand('B'))
    const fist = getFeatureVector(buildLetterHand('A'))
    for (const name of ['indexCurl', 'middleCurl', 'ringCurl', 'pinkyCurl'] as const) {
      expect(open[FEATURE_INDEX[name]]).toBeLessThan(fist[FEATURE_INDEX[name]])
    }
  })

  // Why X used to be unrecognizable, stated as a test: the joint angle barely
  // separates a hook from a fist; the fingertip's reach separates them cleanly.
  it('separates X’s hook from a fist by reach, which its PIP angle barely does', () => {
    const hook = buildLetterHand('X')
    const fist = buildLetterHand('A')
    expect(feature(fist, 'indexCurl') - feature(hook, 'indexCurl')).toBeLessThan(0.2)
    expect(feature(hook, 'indexExtension') - feature(fist, 'indexExtension')).toBeGreaterThan(0.15)
  })

  it('orders fingertip reach straight > hooked > fisted', () => {
    expect(feature(buildLetterHand('D'), 'indexExtension')).toBeGreaterThan(
      feature(buildLetterHand('X'), 'indexExtension'),
    )
    expect(feature(buildLetterHand('X'), 'indexExtension')).toBeGreaterThan(
      feature(buildLetterHand('A'), 'indexExtension'),
    )
  })

  // M, N, S and T are one fist with the thumb in four places.
  it('orders the fist letters by how far the thumb crosses the palm', () => {
    const across = (letter: string) => feature(buildLetterHand(letter), 'thumbAcross')
    expect(across('T')).toBeLessThan(across('S'))
    expect(across('S')).toBeLessThan(across('N'))
    expect(across('N')).toBeLessThan(across('M'))
  })

  it('gives M/N/S/T identical finger curls, so only the thumb can tell them apart', () => {
    const curls = (letter: string) =>
      (['indexCurl', 'middleCurl', 'ringCurl', 'pinkyCurl'] as const).map((n) =>
        feature(buildLetterHand(letter), n),
      )
    for (const letter of ['N', 'S', 'T']) {
      curls(letter).forEach((value, i) => expect(value).toBeCloseTo(curls('M')[i], 5))
    }
  })

  it('flips indexMiddleCross only for R, where the fingers are wound over each other', () => {
    expect(feature(buildLetterHand('R'), 'indexMiddleCross')).toBeLessThan(0)
    for (const letter of ['U', 'V', 'K', 'B']) {
      expect(feature(buildLetterHand(letter), 'indexMiddleCross')).toBeGreaterThan(0)
    }
  })

  // Reading the angle of a 3D vector against a 2D "up" let a hand tipped toward
  // the camera read as "pointing down" from foreshortening alone.
  it('measures orientation in the image plane, ignoring depth', () => {
    const flat = buildLetterHand('B')
    const towardCamera = flat.map((p) => ({ ...p, z: p.z - 0.25 }))
    expect(feature(towardCamera, 'handOrientation')).toBeCloseTo(
      feature(flat, 'handOrientation'),
      6,
    )
  })

  it('tracks image-plane rotation from up through sideways to down', () => {
    expect(feature(buildHand(tilted('B', 0)), 'handOrientation')).toBeCloseTo(0, 2)
    expect(feature(buildHand(tilted('B', 90)), 'handOrientation')).toBeCloseTo(0.5, 2)
    expect(feature(buildHand(tilted('B', 180)), 'handOrientation')).toBeCloseTo(1, 2)
  })
})

describe('classifyHandShape', () => {
  it.each(LETTERS)('recognizes its own reference pose for %s', (letter) => {
    const result = classifyHandShape(buildLetterHand(letter))
    expect(result.candidates[0]?.letter).toBe(letter)
    expect(result.best?.letter, `${letter} was rejected as too uncertain`).toBe(letter)
  })

  it('returns candidates sorted descending by confidence, at most three', () => {
    const result = classifyHandShape(buildLetterHand('B'))
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].confidence).toBeGreaterThanOrEqual(
        result.candidates[i].confidence,
      )
    }
    expect(result.candidates.length).toBeLessThanOrEqual(3)
  })

  it('returns an empty/null result for malformed input instead of throwing', () => {
    const tooFew = Array.from({ length: 5 }, () => point(0, 0)) as HandLandmarks
    expect(() => classifyHandShape(tooFew)).not.toThrow()
    expect(classifyHandShape(tooFew)).toEqual({ best: null, candidates: [] })
  })

  it('returns an empty/null result for an empty landmarks array', () => {
    expect(classifyHandShape([])).toEqual({ best: null, candidates: [] })
  })

  it('rejects a shape that is nothing like any letter', () => {
    const collapsed = Array.from({ length: 21 }, (_, i) =>
      point(0.5 + i * 1e-4, 0.9 + i * 1e-4),
    ) as HandLandmarks
    expect(classifyHandShape(collapsed).best).toBeNull()
  })
})

describe('rotation tolerance outside the twin groups', () => {
  // Orientation is no longer part of the distance, so tipping your wrist while
  // signing a letter with no orientation twin costs nothing.
  it.each(['B', 'A', 'W', 'Y', 'F', 'C', 'O'])('still reads %s when tipped', (letter) => {
    for (const rotate of [-25, -10, 10, 25]) {
      expect(best(buildHand(tilted(letter, rotate))), `${letter} at ${rotate} degrees`).toBe(letter)
    }
  })
})

describe('robustness', () => {
  it('survives landmark jitter on every letter', () => {
    const noise = makeNoise(0x5eed)
    let correct = 0
    let total = 0
    for (const letter of LETTERS) {
      for (let trial = 0; trial < 20; trial++) {
        const jittered = buildLetterHand(letter).map((p) => ({
          x: p.x + noise(0.006),
          y: p.y + noise(0.006),
          z: p.z + noise(0.006),
        }))
        total++
        if (best(jittered) === letter) correct++
      }
    }
    expect(correct / total).toBeGreaterThan(0.98)
  })

  it('survives a hand held a few degrees off the reference pose', () => {
    const noise = makeNoise(0xc0ffee)
    let correct = 0
    let total = 0
    for (const letter of LETTERS) {
      const pose = LETTER_POSES[letter]
      for (let trial = 0; trial < 20; trial++) {
        const wobbled: HandPose = {
          ...pose,
          thumb: {
            heading: pose.thumb.heading + noise(9),
            lift: pose.thumb.lift + noise(9),
            flex: pose.thumb.flex + noise(9),
          },
          index: { ...pose.index, splay: (pose.index.splay ?? 0) + noise(7) },
          middle: { ...pose.middle, splay: (pose.middle.splay ?? 0) + noise(7) },
          ring: { ...pose.ring, splay: (pose.ring.splay ?? 0) + noise(7) },
          pinky: { ...pose.pinky, splay: (pose.pinky.splay ?? 0) + noise(7) },
          rotate: (pose.rotate ?? 0) + noise(8),
        }
        total++
        if (best(buildHand(wobbled)) === letter) correct++
      }
    }
    expect(correct / total).toBeGreaterThan(0.95)
  })
})

describe('confidence', () => {
  it('is much higher for an unmistakable letter than for a crowded one', () => {
    const clear = classifyHandShape(buildLetterHand('Y')).candidates[0].confidence
    const crowded = classifyHandShape(buildLetterHand('S')).candidates[0].confidence
    expect(clear).toBeGreaterThan(0.9)
    expect(crowded).toBeLessThan(clear - 0.1)
  })

  it('splits roughly evenly between two letters that really are equidistant', () => {
    const midpoint = LETTER_PROTOTYPES.M.map((v, i) => (v + LETTER_PROTOTYPES.N[i]) / 2)
    const [top, second] = classifyFeatures(midpoint).candidates
    expect([top.letter, second.letter].sort()).toEqual(['M', 'N'])
    expect(Math.abs(top.confidence - second.confidence)).toBeLessThan(0.05)
  })

  it('rejects a vector of the wrong length rather than throwing', () => {
    expect(classifyFeatures([0, 1, 2])).toEqual({ best: null, candidates: [] })
  })
})
