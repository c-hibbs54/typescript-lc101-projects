import { Link } from 'react-router-dom'
import { PLATFORM_DISCLAIMER, RECOGNIZABLE_SIGNS } from '../data/curriculum'
import { useProgress } from '../context/ProgressContext'
import './HomePage.css'

export function HomePage() {
  const { progress } = useProgress()
  const masteredCount = RECOGNIZABLE_SIGNS.filter((sign) => progress.letters[sign.id]?.mastered).length

  return (
    <div className="home">
      <section className="home__hero">
        <h1>Learn ASL fingerspelling with your webcam</h1>
        <p>
          SignLoop watches your hand shape through your webcam and tells you, in real time, how close you are
          to the correct handshape — all running privately in your browser. Nothing is ever uploaded.
        </p>
        <div className="home__cta">
          <Link className="btn btn--primary" to="/practice">
            Start practicing
          </Link>
          <Link className="btn btn--secondary" to="/learn">
            Browse the alphabet
          </Link>
        </div>
      </section>

      <section className="grid stat-grid">
        <div className="card stat-card">
          <span className="stat-card__value">
            {masteredCount}/{RECOGNIZABLE_SIGNS.length}
          </span>
          <span className="stat-card__label">letters mastered</span>
        </div>
        <div className="card stat-card">
          <span className="stat-card__value">{progress.streakDays}</span>
          <span className="stat-card__label">day streak</span>
        </div>
        <div className="card stat-card">
          <span className="stat-card__value">{progress.quizHighScore}</span>
          <span className="stat-card__label">quiz high score</span>
        </div>
      </section>

      <section className="grid home__features">
        <div className="card">
          <h3>🎥 Real-time feedback</h3>
          <p>
            A hand-tracking model finds 21 points on your hand every frame and compares your shape to the
            target letter, live.
          </p>
        </div>
        <div className="card">
          <h3>🔒 Runs entirely on your device</h3>
          <p>
            Your camera feed is processed locally in the browser — no video is ever sent to a server.
          </p>
        </div>
        <div className="card">
          <h3>📈 Track your progress</h3>
          <p>Practice mode and quiz mode both save your progress locally so you can see yourself improve.</p>
        </div>
      </section>

      <section className="disclaimer">{PLATFORM_DISCLAIMER}</section>
    </div>
  )
}
