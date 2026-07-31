import { useCallback, useEffect, useRef, useState } from 'react'
import { classifyFeatures } from '../lib/classifier'
import { createStabilityTracker, type CaptureState } from '../lib/stableCapture'
import type { ClassificationResult, FrameDetection } from '../types/asl'

export interface StableSignResult {
  /** Live gate state: whether the hand is settling, being held, or measured. */
  capture: CaptureState
  /** Classification of the most recent completed measurement, if any. */
  reading: ClassificationResult | null
  /** Increments once per completed measurement, so callers can react exactly once. */
  readingId: number
  reset: () => void
}

const IDLE_CAPTURE: CaptureState = {
  phase: 'no-hand',
  progress: 0,
  stillness: 0,
  measurement: null,
  sampleCount: 0,
}

/**
 * Reads deliberate, held handshapes instead of classifying every frame.
 *
 * The heavy lifting is in `createStabilityTracker`; this only adapts it to
 * React and classifies the averaged feature vector when a hold completes. That
 * means one classification per held pose rather than 30-60 a second, and a far
 * steadier answer, since averaging cancels most landmark jitter.
 */
export function useStableSign(detection: FrameDetection | null, holdMs?: number): StableSignResult {
  const trackerRef = useRef(createStabilityTracker(holdMs ? { holdMs } : undefined))
  const [capture, setCapture] = useState<CaptureState>(IDLE_CAPTURE)
  const [reading, setReading] = useState<ClassificationResult | null>(null)
  const [readingId, setReadingId] = useState(0)

  useEffect(() => {
    const landmarks = detection?.primary?.landmarks ?? null
    const now = detection?.timestampMs ?? performance.now()
    const next = trackerRef.current.push(landmarks, now)

    // The camera/classifier is an external stream ticking at its own rate, so
    // mirroring its state here is a legitimate effect rather than derivable
    // render-time state.
    setCapture(next)
    if (next.measurement) {
      const result = classifyFeatures(next.measurement)
      setReading(result)
      setReadingId((n) => n + 1)
    }
  }, [detection])

  const reset = useCallback(() => {
    trackerRef.current.reset()
    setCapture(IDLE_CAPTURE)
    setReading(null)
  }, [])

  return { capture, reading, readingId, reset }
}
