import { useState } from 'react'
import { RECOGNIZABLE_SIGNS } from '../data/curriculum'
import { ProgressBar } from '../components/ProgressBar'
import { useProgress } from '../context/ProgressContext'
import './ProgressPage.css'

export function ProgressPage() {
  const { progress, resetProgress } = useProgress()
  const [confirmingReset, setConfirmingReset] = useState(false)

  const masteredCount = RECOGNIZABLE_SIGNS.filter((sign) => progress.letters[sign.id]?.mastered).length
  const practicedRows = RECOGNIZABLE_SIGNS
    .map((sign) => ({ sign, stats: progress.letters[sign.id] }))
    .filter((row) => row.stats)
    .sort((a, b) => (b.stats?.lastPracticedAt ?? 0) - (a.stats?.lastPracticedAt ?? 0))

  return (
    <div className="progress-page">
      <div className="section-heading">
        <div>
          <h1>Your progress</h1>
          <p>Everything here is saved only in this browser.</p>
        </div>
      </div>

      <section className="grid stat-grid">
        <div className="card channel stat-card">
          <span className="stat-card__value">
            {masteredCount}/{RECOGNIZABLE_SIGNS.length}
          </span>
          <span className="stat-card__label">letters mastered</span>
        </div>
        <div className="card channel stat-card">
          <span className="stat-card__value">{progress.streakDays}</span>
          <span className="stat-card__label">day streak</span>
        </div>
        <div className="card channel stat-card">
          <span className="stat-card__value">{progress.quizHighScore}</span>
          <span className="stat-card__label">quiz high score</span>
        </div>
        <div className="card channel stat-card">
          <span className="stat-card__value">{progress.quizAttempts}</span>
          <span className="stat-card__label">quizzes taken</span>
        </div>
      </section>

      <section>
        <h2>Overall mastery</h2>
        <ProgressBar value={masteredCount} max={RECOGNIZABLE_SIGNS.length} />
      </section>

      <section>
        <h2>Letters you've practiced</h2>
        {practicedRows.length === 0 && <p>You haven't practiced any letters yet — head to Practice mode!</p>}
        <div className="progress-page__rows">
          {practicedRows.map(({ sign, stats }) => (
            <div key={sign.id} className="progress-page__row card">
              <span className="progress-page__letter">{sign.displayName}</span>
              <div className="progress-page__row-body">
                <span>
                  {stats!.correct}/{stats!.attempts} correct
                </span>
                <ProgressBar value={stats!.correct} max={stats!.attempts} />
              </div>
              {stats!.mastered && <span className="badge badge--easy">Mastered</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="progress-page__danger card">
        <div>
          <h3>Reset progress</h3>
          <p>This clears all local practice history, mastery, and quiz scores. It can't be undone.</p>
        </div>
        {confirmingReset ? (
          <div className="progress-page__confirm">
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                resetProgress()
                setConfirmingReset(false)
              }}
            >
              Yes, reset everything
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setConfirmingReset(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--danger" onClick={() => setConfirmingReset(true)}>
            Reset progress
          </button>
        )}
      </section>
    </div>
  )
}
