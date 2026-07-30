import { useCallback, useMemo, useState } from 'react'
import { ALL_SIGNS, getSignById } from '../data/curriculum'
import { classifyHandShape } from '../lib/classifier'
import { WebcamPanel } from '../components/WebcamPanel'
import { ProgressBar } from '../components/ProgressBar'
import { useProgress } from '../context/ProgressContext'
import { useSustainedMatch } from '../hooks/useSustainedMatch'
import type { ClassificationResult, HandDetectionResult, ProgressState } from '../types/asl'
import '../styles/shared-practice.css'
import './PracticePage.css'

const RECOGNIZABLE_SIGNS = ALL_SIGNS.filter((sign) => sign.recognizable)

function buildQueue(progress: ProgressState): string[] {
  const weighted = RECOGNIZABLE_SIGNS.map((sign) => {
    const p = progress.letters[sign.id]
    const weight = (p?.mastered ? 100 : 0) + (p?.attempts ?? 0)
    return { id: sign.id, weight: weight + Math.random() * 5 }
  })
  return weighted.sort((a, b) => a.weight - b.weight).map((w) => w.id)
}

export function PracticePage() {
  const { progress, recordAttempt } = useProgress()
  const [queue, setQueue] = useState<string[]>(() => buildQueue(progress))
  const [queueIndex, setQueueIndex] = useState(0)
  const [classification, setClassification] = useState<ClassificationResult | null>(null)
  const [justConfirmed, setJustConfirmed] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const targetId = queue[queueIndex] ?? null
  const targetSign = targetId ? getSignById(targetId) : undefined

  const handleDetection = useCallback((detection: HandDetectionResult | null) => {
    setClassification(detection ? classifyHandShape(detection.landmarks) : null)
  }, [])

  const advance = useCallback(() => {
    setShowHint(false)
    setQueueIndex((prev) => {
      const next = prev + 1
      if (next >= queue.length) {
        setQueue(buildQueue(progress))
        return 0
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length])

  const handleConfirmed = useCallback(() => {
    if (!targetId) return
    recordAttempt(targetId, true)
    setJustConfirmed(true)
    window.setTimeout(() => {
      setJustConfirmed(false)
      advance()
    }, 900)
  }, [targetId, recordAttempt, advance])

  const { holdProgress } = useSustainedMatch({
    target: targetId,
    candidate: classification?.best ?? null,
    onConfirmed: handleConfirmed,
  })

  const topCandidates = useMemo(() => classification?.candidates ?? [], [classification])

  return (
    <div className="practice">
      <div className="section-heading">
        <div>
          <h1>Practice mode</h1>
          <p>Form the handshape shown below and hold it steady until the ring fills up.</p>
        </div>
        <button type="button" className="btn btn--secondary" onClick={advance}>
          Skip this letter
        </button>
      </div>

      <div className="practice__layout">
        <WebcamPanel enabled onDetection={handleDetection} />

        <div className="practice__target card">
          {targetSign ? (
            <>
              <span className="practice__target-glyph">{targetSign.displayName}</span>
              <ProgressBar value={holdProgress} max={1} />
              <p className="practice__target-status">
                {justConfirmed ? '✅ Nice! Moving on…' : 'Hold the shape steady to confirm.'}
              </p>
              <button type="button" className="btn btn--secondary" onClick={() => setShowHint((v) => !v)}>
                {showHint ? 'Hide hint' : 'Need a hint?'}
              </button>
              {showHint && (
                <div className="practice__hint">
                  <p>{targetSign.handshapeDescription}</p>
                  <p>💡 {targetSign.tip}</p>
                </div>
              )}
            </>
          ) : (
            <p>Loading a letter to practice…</p>
          )}

          <div className="practice__candidates">
            <h4>Live guesses</h4>
            {topCandidates.length === 0 && <p className="practice__no-hand">Show your hand to the camera.</p>}
            {topCandidates.map((c) => (
              <div key={c.letter} className="practice__candidate-row">
                <span>{c.letter}</span>
                <ProgressBar value={c.confidence} max={1} />
                <span className="practice__candidate-pct">{Math.round(c.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
