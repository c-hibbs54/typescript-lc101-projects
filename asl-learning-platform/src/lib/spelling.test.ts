import { describe, expect, it } from 'vitest'
import { editDistance, evaluateSpelling } from './spelling'

const DICT = ['CAT', 'CAR', 'CARD', 'DOG', 'HOME', 'MOM', 'SUN', 'STAR']

describe('evaluateSpelling', () => {
  it('is empty for an empty buffer', () => {
    const s = evaluateSpelling([], DICT)
    expect(s.text).toBe('')
    expect(s.candidates).toEqual([])
    expect(s.exactMatch).toBeNull()
  })

  it('narrows candidates as letters arrive', () => {
    expect(evaluateSpelling(['C'], DICT).candidates).toEqual(['CAT', 'CAR', 'CARD'])
    expect(evaluateSpelling(['C', 'A', 'R'], DICT).candidates).toEqual(['CAR', 'CARD'])
  })

  it('reports an exact match when the buffer spells a word', () => {
    const s = evaluateSpelling(['M', 'O', 'M'], DICT)
    expect(s.exactMatch).toBe('MOM')
    expect(s.text).toBe('MOM')
  })

  it('still lists longer words while an exact match exists', () => {
    // "CAR" is a word, but the user may be spelling "CARD".
    const s = evaluateSpelling(['C', 'A', 'R'], DICT)
    expect(s.exactMatch).toBe('CAR')
    expect(s.candidates).toContain('CARD')
  })

  it('uppercases lowercase input', () => {
    expect(evaluateSpelling(['c', 'a', 't'], DICT).exactMatch).toBe('CAT')
  })

  it('suggests no corrections while the buffer is still a valid prefix', () => {
    // Mid-word, so nothing has gone wrong yet.
    expect(evaluateSpelling(['C', 'A'], DICT).corrections).toEqual([])
  })

  it('suggests a correction when one letter was misrecognised', () => {
    // N/M is a classic confusion; "NOM" should point at "MOM".
    const s = evaluateSpelling(['N', 'O', 'M'], DICT)
    expect(s.exactMatch).toBeNull()
    expect(s.candidates).toEqual([])
    expect(s.corrections.map((c) => c.word)).toContain('MOM')
  })

  it('suggests corrections for a substituted middle letter', () => {
    // S/T confusion turning STAR into "SCAR"-like input.
    const s = evaluateSpelling(['S', 'T', 'A', 'T'], DICT)
    expect(s.corrections.map((c) => c.word)).toContain('STAR')
  })

  it('offers nothing for input too far from any word', () => {
    const s = evaluateSpelling(['X', 'Q', 'Z', 'W'], DICT)
    expect(s.exactMatch).toBeNull()
    expect(s.candidates).toEqual([])
    expect(s.corrections).toEqual([])
  })

  it('never suggests the buffer itself as a correction', () => {
    const s = evaluateSpelling(['M', 'O', 'M'], DICT)
    expect(s.corrections.every((c) => c.word !== 'MOM')).toBe(true)
  })

  it('does not mutate the caller\'s letter array', () => {
    const letters = ['C', 'A']
    const s = evaluateSpelling(letters, DICT)
    s.letters.push('T')
    expect(letters).toEqual(['C', 'A'])
  })
})

describe('editDistance', () => {
  it('is 0 for identical strings', () => {
    expect(editDistance('CAT', 'CAT')).toBe(0)
  })

  it('counts a single substitution', () => {
    expect(editDistance('CAT', 'CAR')).toBe(1)
  })

  it('counts a single insertion', () => {
    expect(editDistance('CAR', 'CARD')).toBe(1)
  })

  it('bails out early for very different lengths', () => {
    expect(editDistance('A', 'ABCDEF')).toBe(Infinity)
  })
})
