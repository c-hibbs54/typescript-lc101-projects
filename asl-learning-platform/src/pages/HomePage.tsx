import { Link } from 'react-router-dom'
import { PLATFORM_DISCLAIMER, RECOGNIZABLE_SIGNS } from '../data/curriculum'
import { Mascot, type MascotMood } from '../components/Mascot'
import { PageHeading } from '../components/PageHeading'
import { useProgress } from '../context/ProgressContext'
import './HomePage.css'

const FEATURES = [
  {
    index: '01',
    title: 'Real-time feedback',
    body: 'A hand-tracking model finds 21 points on your hand every frame and compares your shape to the target letter, live.',
  },
  {
    index: '02',
    title: 'Runs entirely on your device',
    body: 'Your camera feed is processed locally in the browser — no video is ever sent to a server.',
  },
  {
    index: '03',
    title: 'Track your progress',
    body: 'Practice mode and quiz mode both save your progress locally so you can see yourself improve.',
  },
]

export function HomePage() {
  const { progress } = useProgress()
  const masteredCount = RECOGNIZABLE_SIGNS.filter((sign) => progress.letters[sign.id]?.mastered).length

  // Tomo reflects how you're doing: celebrating once you've mastered a letter,
  // pleased while a streak is alive, otherwise just waving hello.
  const welcomeMood: MascotMood = masteredCount > 0 ? 'cheer' : progress.streakDays > 0 ? 'happy' : 'idle'

  return (
    <div className="home">
      <section className="home__hero">
        <div className="home__hero-copy">
          <PageHeading eyebrow="Home" ja="ホーム" title="Learn ASL fingerspelling with your webcam">
            <p>
              SignJutsu watches your hand shape through your webcam and tells you, in real time, how close you
              are to the correct handshape — all running privately in your browser. Nothing is ever uploaded.
            </p>
          </PageHeading>
          <div className="home__cta">
            <Link className="btn btn--primary" to="/practice">
              Start practicing
            </Link>
            <Link className="btn btn--secondary" to="/learn">
              Browse the alphabet
            </Link>
          </div>
        </div>
        <div className="home__mascot-stage">
          <Mascot mood={welcomeMood} size={200} label={`Tomo, your practice companion, looking ${welcomeMood}`} />
        </div>
      </section>

      <section className="home__band">
        <h2>At a glance</h2>
        <div className="grid stat-grid">
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
        </div>
      </section>

      <section className="home__band">
        <h2>How it works</h2>
        <div className="grid home__features">
          {FEATURES.map((feature) => (
            <div key={feature.index} className="card channel home__feature">
              <span className="home__feature-index" aria-hidden="true">
                {feature.index}
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="disclaimer">{PLATFORM_DISCLAIMER}</section>
    </div>
  )
}
