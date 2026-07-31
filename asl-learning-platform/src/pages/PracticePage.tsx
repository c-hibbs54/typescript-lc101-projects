import { useCallback, useMemo, useState } from 'react'
import { getSignById, RECOGNIZABLE_SIGNS } from '../data/curriculum'
import { classifyHandShape } from '../lib/classifier'
import { WebcamPanel } from '../components/WebcamPanel'
import { ProgressBar } from '../components/ProgressBar'
import { CandidateList } from '../components/CandidateList'
import { GhostHand } from '../components/GhostHand'
import { Mascot, type MascotMood } from '../components/Mascot'
import { useProgress } from '../context/ProgressContext'
import { useSustainedMatch } from '../hooks/useSustainedMatch'
import type { ClassificationResult, FrameDetection, ProgressState } from '../types/asl'
import '../styles/shared-practice.css'
import './PracticePage.css'

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

  // Only the primary (dominant) hand is graded, so a second hand wandering into
  // frame can never hijack the classification.
  const handleDetection = useCallback((detection: FrameDetection | null) => {
    const landmarks = detection?.primary?.landmarks
    setClassification(landmarks ? classifyHandShape(landmarks) : null)
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
  }, [queue.length, progress])

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

  // Tomo cheers a confirmed letter, leans in while you're closing on it, and
  // otherwise just keeps you company.
  const mascotMood: MascotMood = justConfirmed ? 'cheer' : holdProgress > 0.05 ? 'happy' : 'thinking'

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
              <div className="practice__target-head">
                <span className="practice__target-glyph">{targetSign.displayName}</span>
                {/* gaze off: the camera page already has the model on the main thread. */}
                <Mascot mood={mascotMood} size={92} gaze={false} />
              </div>
              <ProgressBar value={holdProgress} max={1} />
              <p className="practice__target-status">
                {justConfirmed ? '✅ Nice! Moving on…' : 'Hold the shape steady to confirm.'}
              </p>
              <button type="button" className="btn btn--secondary" onClick={() => setShowHint((v) => !v)}>
                {showHint ? 'Hide hint' : 'Need a hint?'}
              </button>
              {showHint && (
                <div className="practice__hint">
                  <GhostHand signId={targetSign.id} size={120} />
                  <p>{targetSign.handshapeDescription}</p>
                  <p>💡 {targetSign.tip}</p>
                </div>
              )}
            </>
          ) : (
            <p>Loading a letter to practice…</p>
          )}

          <CandidateList candidates={topCandidates} />
        </div>
      </div>
    </div>
  )
}
