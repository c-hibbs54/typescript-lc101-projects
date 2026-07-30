import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSignById, RECOGNIZABLE_SIGNS } from '../data/curriculum'
import { classifyHandShape } from '../lib/classifier'
import { WebcamPanel } from '../components/WebcamPanel'
import { ProgressBar } from '../components/ProgressBar'
import { CandidateList } from '../components/CandidateList'
import { useProgress } from '../context/ProgressContext'
import { useSustainedMatch } from '../hooks/useSustainedMatch'
import type { ClassificationResult, HandDetectionResult } from '../types/asl'
import '../styles/shared-practice.css'
import './QuizPage.css'

const QUESTION_COUNT = 10
const QUESTION_DURATION_MS = 8000

function pickQuestions(): string[] {
  const pool = [...RECOGNIZABLE_SIGNS]
  const chosen: string[] = []
  for (let i = 0; i < QUESTION_COUNT && pool.length > 0; i++) {
    const index = Math.floor(Math.random() * pool.length)
    chosen.push(pool.splice(index, 1)[0].id)
  }
  return chosen
}

type QuizPhase = 'playing' | 'finished'

export function QuizPage() {
  const { recordAttempt, recordQuizResult } = useProgress()
  const [questions, setQuestions] = useState<string[]>(() => pickQuestions())
  const [questionIndex, setQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState<QuizPhase>('playing')
  const [timeLeftMs, setTimeLeftMs] = useState(QUESTION_DURATION_MS)
  const [classification, setClassification] = useState<ClassificationResult | null>(null)
  const [lastResult, setLastResult] = useState<'correct' | 'timeout' | null>(null)
  const resultSavedRef = useRef(false)

  const targetId = phase === 'playing' ? (questions[questionIndex] ?? null) : null
  const targetSign = targetId ? getSignById(targetId) : undefined

  const goToNext = useCallback(
    (result: 'correct' | 'timeout') => {
      setLastResult(result)
      setQuestionIndex((prev) => {
        const next = prev + 1
        if (next >= questions.length) {
          setPhase('finished')
        }
        return next
      })
    },
    [questions.length],
  )

  const handleConfirmed = useCallback(() => {
    if (!targetId) return
    recordAttempt(targetId, true)
    setScore((s) => s + 1)
    goToNext('correct')
  }, [targetId, recordAttempt, goToNext])

  const { holdProgress } = useSustainedMatch({
    target: targetId,
    candidate: classification?.best ?? null,
    holdMs: 500,
    onConfirmed: handleConfirmed,
  })

  useEffect(() => {
    if (phase !== 'playing' || !targetId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the on-screen countdown for the new question before its interval starts ticking
    setTimeLeftMs(QUESTION_DURATION_MS)
    const started = performance.now()
    const interval = window.setInterval(() => {
      const remaining = QUESTION_DURATION_MS - (performance.now() - started)
      if (remaining <= 0) {
        window.clearInterval(interval)
        recordAttempt(targetId, false)
        goToNext('timeout')
        return
      }
      setTimeLeftMs(remaining)
    }, 100)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, phase, targetId])

  useEffect(() => {
    if (phase === 'finished' && !resultSavedRef.current) {
      resultSavedRef.current = true
      recordQuizResult(score)
    }
  }, [phase, score, recordQuizResult])

  const handleDetection = useCallback((detection: HandDetectionResult | null) => {
    setClassification(detection ? classifyHandShape(detection.landmarks) : null)
  }, [])

  const restart = useCallback(() => {
    resultSavedRef.current = false
    setQuestions(pickQuestions())
    setQuestionIndex(0)
    setScore(0)
    setPhase('playing')
    setLastResult(null)
  }, [])

  const topCandidates = useMemo(() => classification?.candidates ?? [], [classification])

  if (phase === 'finished') {
    return (
      <div className="quiz quiz--finished">
        <div className="card quiz__summary">
          <h1>Quiz complete!</h1>
          <p className="quiz__score">
            {score} / {questions.length}
          </p>
          <button type="button" className="btn btn--primary" onClick={restart}>
            Play again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="quiz">
      <div className="section-heading">
        <div>
          <h1>Quiz mode</h1>
          <p>
            Question {questionIndex + 1} of {questions.length} · Score: {score}
          </p>
        </div>
      </div>

      <div className="practice__layout">
        <WebcamPanel enabled onDetection={handleDetection} />

        <div className="practice__target card">
          {targetSign && (
            <>
              <span className="practice__target-glyph">{targetSign.displayName}</span>
              <ProgressBar value={timeLeftMs} max={QUESTION_DURATION_MS} />
              <p className="practice__target-status">Time left: {Math.ceil(timeLeftMs / 1000)}s</p>
              <ProgressBar value={holdProgress} max={1} />
              {lastResult === 'timeout' && questionIndex > 0 && (
                <p className="quiz__feedback quiz__feedback--miss">Time's up — next one!</p>
              )}
            </>
          )}

          <CandidateList candidates={topCandidates} />
        </div>
      </div>
    </div>
  )
}
