import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SPELLING_DICTIONARY } from '../data/curriculum'
import { evaluateSpelling } from '../lib/spelling'
import { WebcamPanel } from '../components/WebcamPanel'
import { ProgressBar } from '../components/ProgressBar'
import { SignImage } from '../components/SignImage'
import { useStableSign } from '../hooks/useStableSign'
import type { FrameDetection } from '../types/asl'
import '../styles/shared-practice.css'
import './SpellPage.css'

/** Confidence a held reading must clear before it's accepted as a letter. */
const ACCEPT_CONFIDENCE = 0.45
/** How much the top reading must beat the runner-up by to count as decided. */
const ACCEPT_MARGIN = 0.015

const PHASE_COPY: Record<string, string> = {
  'no-hand': 'Show your hand to the camera.',
  settling: 'Hold your hand still…',
  holding: 'Holding — keep steady.',
  measured: 'Got it.',
}

export function SpellPage() {
  const [detection, setDetection] = useState<FrameDetection | null>(null)
  const [letters, setLetters] = useState<string[]>([])
  const [rejected, setRejected] = useState<string | null>(null)
  const { capture, reading, readingId, reset } = useStableSign(detection)
  const lastAcceptedId = useRef(0)

  const handleDetection = useCallback((frame: FrameDetection | null) => setDetection(frame), [])

  // One held pose contributes at most one letter, keyed off readingId.
  useEffect(() => {
    if (readingId === 0 || readingId === lastAcceptedId.current) return
    lastAcceptedId.current = readingId
    if (!reading) return

    const [top, runnerUp] = reading.candidates
    const decided =
      top && top.confidence >= ACCEPT_CONFIDENCE && (!runnerUp || top.confidence - runnerUp.confidence >= ACCEPT_MARGIN)

    if (decided) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a completed measurement from the camera stream
      setLetters((prev) => [...prev, top.letter])
      setRejected(null)
    } else if (top) {
      // Say so rather than silently guessing: two shapes were too close apart.
      setRejected(`Not sure — that looked like ${reading.candidates.slice(0, 2).map((c) => c.letter).join(' or ')}. Try again.`)
    }
  }, [readingId, reading])

  const spelling = useMemo(() => evaluateSpelling(letters, SPELLING_DICTIONARY), [letters])

  const undo = useCallback(() => {
    setLetters((prev) => prev.slice(0, -1))
    setRejected(null)
    reset()
  }, [reset])

  const clear = useCallback(() => {
    setLetters([])
    setRejected(null)
    reset()
  }, [reset])

  return (
    <div className="spell">
      <div className="section-heading">
        <div>
          <h1>Spell a word</h1>
          <p>
            Sign one letter at a time and <strong>hold each shape still for about a second</strong> — SignJutsu
            measures while you hold, then reads the word back to you.
          </p>
        </div>
        <div className="spell__controls">
          <button type="button" className="btn btn--secondary" onClick={undo} disabled={letters.length === 0}>
            Undo letter
          </button>
          <button type="button" className="btn btn--secondary" onClick={clear} disabled={letters.length === 0}>
            Clear
          </button>
        </div>
      </div>

      <div className="practice__layout">
        <WebcamPanel enabled onDetection={handleDetection} statusMessage={PHASE_COPY[capture.phase]} />

        <div className="practice__target card spell__readout">
          <div className="spell__hold">
            <span className="spell__hold-label">{PHASE_COPY[capture.phase]}</span>
            <ProgressBar value={capture.progress} max={1} />
            {capture.phase === 'holding' && (
              <span className="spell__samples">measuring · {capture.sampleCount} frames averaged</span>
            )}
          </div>

          <div className="spell__word" aria-live="polite">
            {spelling.text ? (
              <span className="spell__word-text">{spelling.text}</span>
            ) : (
              <span className="spell__word-empty">…</span>
            )}
          </div>

          {spelling.exactMatch && <p className="spell__match">✓ that spells “{spelling.exactMatch}”</p>}

          {!spelling.exactMatch && spelling.candidates.length > 0 && (
            <p className="spell__hint">
              Could become: <strong>{spelling.candidates.join(', ')}</strong>
            </p>
          )}

          {spelling.corrections.length > 0 && (
            <p className="spell__hint spell__hint--correct">
              Did you mean <strong>{spelling.corrections.map((c) => c.word).join(', ')}</strong>? One letter is
              easy to misread.
            </p>
          )}

          {rejected && <p className="spell__rejected">{rejected}</p>}

          {reading?.best && (
            <div className="spell__last">
              <SignImage signId={reading.best.letter} size={104} />
              <span>
                last read: <strong>{reading.best.letter}</strong> ·{' '}
                {Math.round(reading.best.confidence * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
