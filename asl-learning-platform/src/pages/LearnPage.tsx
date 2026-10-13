import { useState } from 'react'
import { CURRICULUM_UNITS, getSignById, PRACTICE_WORDS } from '../data/curriculum'
import { LetterCard } from '../components/LetterCard'
import { SignImage } from '../components/SignImage'
import { PageHeading } from '../components/PageHeading'
import { useProgress } from '../context/ProgressContext'
import type { AslSignLesson } from '../types/asl'
import './LearnPage.css'

export function LearnPage() {
  const { progress } = useProgress()
  const [selected, setSelected] = useState<AslSignLesson | null>(null)

  return (
    <div className="learn">
      <PageHeading eyebrow="Learn" ja="学ぶ" title="The ASL manual alphabet">
        <p>Work through each unit at your own pace, then head to Practice to try it with your webcam.</p>
      </PageHeading>

      {CURRICULUM_UNITS.map((unit, i) => (
        <section key={unit.id} className="learn__unit">
          <div className="learn__unit-head">
            <span className="learn__unit-index" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <h2>{unit.title}</h2>
              <p className="learn__unit-description">{unit.description}</p>
            </div>
          </div>
          <div className="grid grid--letters">
            {unit.signIds
              .map((id) => getSignById(id))
              .filter((sign): sign is AslSignLesson => Boolean(sign))
              .map((sign) => (
                <LetterCard
                  key={sign.id}
                  sign={sign}
                  mastered={progress.letters[sign.id]?.mastered}
                  selected={selected?.id === sign.id}
                  onSelect={setSelected}
                />
              ))}
          </div>
        </section>
      ))}

      <section className="learn__unit">
        <div className="learn__unit-head">
          <span className="learn__unit-index" aria-hidden="true">
            ＋
          </span>
          <div>
            <h2>Bonus: words to spell</h2>
            <p className="learn__unit-description">
              Once the alphabet feels comfortable, practice fingerspelling these words letter by letter — read
              the hint, then spell out the word (on your own, or letter-by-letter in Practice mode).
            </p>
          </div>
        </div>
        <ul className="learn__word-list">
          {PRACTICE_WORDS.map((w) => (
            <li key={w.word} className="learn__word-item card">
              <span className="learn__word">{w.word}</span>
              <span className="learn__word-hint">{w.hint}</span>
            </li>
          ))}
        </ul>
      </section>

      {selected && (
        <div className="learn__detail card">
          <SignImage signId={selected.id} size={150} />
          <div className="learn__detail-text">
            <h3>
              {selected.displayName} — {selected.handshapeDescription}
            </h3>
            <p>{selected.tip}</p>
          </div>
        </div>
      )}
    </div>
  )
}
