import { useEffect, useRef, useState } from 'react'
import type { ClassificationCandidate } from '../types/asl'

interface UseSustainedMatchOptions {
  target: string | null
  candidate: ClassificationCandidate | null
  holdMs?: number
  minConfidence?: number
  onConfirmed: () => void
}

/**
 * Requires the classifier's top guess to match `target` continuously (above
 * `minConfidence`) for `holdMs` before firing `onConfirmed`, so a single lucky
 * frame doesn't count as "correct". Resets the instant the match breaks or the
 * target changes. `candidate` arrives from an external system (the webcam +
 * classifier, ticking at its own frame rate via the parent's onDetection
 * callback), so tracking elapsed hold time and notifying the caller here is a
 * legitimate effect responsibility rather than derivable render-time state.
 *
 * `confirmedForTargetRef` (rather than a plain boolean) tracks *which* target
 * has already fired `onConfirmed`, and is only cleared when `target` actually
 * changes - not on every momentary match break. Callers commonly keep
 * `target` unchanged for a short "nice, moving on..." window after
 * confirming; a single dropped/misclassified frame during that window would
 * otherwise let the hold meter fill a second time and double-fire
 * `onConfirmed` for the same letter.
 */
export function useSustainedMatch({
  target,
  candidate,
  holdMs = 700,
  minConfidence = 0.45,
  onConfirmed,
}: UseSustainedMatchOptions): { holdProgress: number; isMatching: boolean } {
  const matchStartRef = useRef<number | null>(null)
  const confirmedForTargetRef = useRef<string | null>(null)
  const [holdProgress, setHoldProgress] = useState(0)

  const isMatching = Boolean(target && candidate && candidate.letter === target && candidate.confidence >= minConfidence)

  useEffect(() => {
    matchStartRef.current = null
    confirmedForTargetRef.current = null
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting the meter when the target sign changes
    setHoldProgress(0)
  }, [target])

  useEffect(() => {
    if (!isMatching) {
      matchStartRef.current = null
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reflects the just-broken match immediately
      setHoldProgress(0)
      return
    }
    const now = performance.now()
    if (matchStartRef.current === null) matchStartRef.current = now
    const elapsed = now - matchStartRef.current
    const progress = Math.min(1, elapsed / holdMs)
    setHoldProgress(progress)
    if (progress >= 1 && confirmedForTargetRef.current !== target) {
      confirmedForTargetRef.current = target
      onConfirmed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate, target, isMatching])

  return { holdProgress, isMatching }
}
