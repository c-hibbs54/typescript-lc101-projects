/**
 * Turns a stream of recognised letters into words.
 *
 * Fingerspelling is letter-by-letter, so reading back *words* means buffering
 * letters and reconciling them against a dictionary. That reconciliation matters
 * more than it sounds: the classifier's weakest distinctions (M/N/S/T, R/U) are
 * exactly the ones a dictionary can rescue, because "HO_E" with a wobbly third
 * letter is almost certainly "HOME".
 */

export interface SpellingSuggestion {
  word: string
  /** Letters that differ from what was signed; 0 means an exact match. */
  distance: number
}

export interface SpellingState {
  letters: string[]
  /** What has been signed so far, e.g. "CA". */
  text: string
  /** Dictionary words this could still become, best first. */
  candidates: string[]
  /** Exact dictionary hit for the current buffer, if any. */
  exactMatch: string | null
  /**
   * Near-misses for a *finished* buffer, for when recognition slipped a letter.
   * Only populated when nothing matches exactly.
   */
  corrections: SpellingSuggestion[]
}

/** Letters the classifier can actually produce (no motion signs). */
const MAX_CORRECTION_DISTANCE = 1
const MAX_CANDIDATES = 6

export const EMPTY_SPELLING: SpellingState = {
  letters: [],
  text: '',
  candidates: [],
  exactMatch: null,
  corrections: [],
}

/**
 * Derives everything displayable from a letter buffer. Pure, so the UI can call
 * it on every change and it stays trivially testable.
 */
export function evaluateSpelling(letters: string[], dictionary: readonly string[]): SpellingState {
  const text = letters.join('')
  if (text.length === 0) return EMPTY_SPELLING

  const upper = text.toUpperCase()
  const candidates = dictionary
    .filter((word) => word.startsWith(upper))
    .sort((a, b) => a.length - b.length)
    .slice(0, MAX_CANDIDATES)

  const exactMatch = dictionary.find((word) => word === upper) ?? null

  // Only bother suggesting corrections once nothing can match going forward -
  // while prefixes still match, the user is simply mid-word.
  const corrections =
    exactMatch || candidates.length > 0
      ? []
      : dictionary
          .map((word) => ({ word, distance: editDistance(upper, word) }))
          .filter((s) => s.distance > 0 && s.distance <= MAX_CORRECTION_DISTANCE)
          .sort((a, b) => a.distance - b.distance || a.word.localeCompare(b.word))
          .slice(0, MAX_CANDIDATES)

  return { letters: [...letters], text: upper, candidates, exactMatch, corrections }
}

/**
 * Levenshtein distance, bounded early for speed: the dictionary is small, but
 * this runs on every recognised letter.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > MAX_CORRECTION_DISTANCE) return Infinity

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      current[j] = Math.min(substitution, previous[j] + 1, current[j - 1] + 1)
    }
    previous = current
  }
  return previous[b.length]
}
