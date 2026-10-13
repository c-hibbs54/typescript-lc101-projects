import { describe, expect, it } from 'vitest'
import { FEATURE_NAMES, LETTER_PROTOTYPES } from './classifier'
import { getGhostPose, getGhostSign } from './ghostHandPoses'
import { ALL_SIGNS } from '../data/curriculum'

describe('getGhostSign', () => {
  it('has a drawable pose for every sign in the curriculum', () => {
    for (const sign of ALL_SIGNS) {
      expect(getGhostSign(sign.id), `no ghost pose for ${sign.id}`).not.toBeNull()
    }
  })

  it('returns pose vectors the illustration can index by feature name', () => {
    for (const sign of ALL_SIGNS) {
      const ghost = getGhostSign(sign.id)
      expect(ghost?.primary).toHaveLength(FEATURE_NAMES.length)
      if (ghost?.secondary) expect(ghost.secondary).toHaveLength(FEATURE_NAMES.length)
    }
  })

  it('treats every current curriculum sign as one-handed', () => {
    // The whole manual alphabet plus the one-handed "I Love You" really are
    // one-handed; SECONDARY_POSES is the single switch that would change this,
    // and the two-hand rendering path is covered separately with a synthetic
    // fixture rather than by mislabelling a real sign.
    for (const sign of ALL_SIGNS) {
      expect(getGhostSign(sign.id)?.secondary, `${sign.id} should have no supporting hand`).toBeNull()
    }
  })

  it('reuses the classifier prototype as the primary pose when there is one', () => {
    expect(getGhostSign('A')?.primary).toBe(LETTER_PROTOTYPES.A)
  })

  it('falls back to an illustration-only pose for the motion and word signs', () => {
    for (const id of ['J', 'Z', 'ILY']) {
      expect(LETTER_PROTOTYPES[id]).toBeUndefined()
      expect(getGhostSign(id)?.primary).toHaveLength(FEATURE_NAMES.length)
    }
  })

  it('returns null for an unknown sign id', () => {
    expect(getGhostSign('nope')).toBeNull()
    expect(getGhostSign('')).toBeNull()
  })

  it('agrees with getGhostPose about the primary hand', () => {
    for (const sign of ALL_SIGNS) {
      expect(getGhostSign(sign.id)?.primary).toEqual(getGhostPose(sign.id))
    }
  })
})
