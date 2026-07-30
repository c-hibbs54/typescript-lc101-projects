import { useState } from 'react'
import { CURRICULUM_UNITS, getSignById } from '../data/curriculum'
import { LetterCard } from '../components/LetterCard'
import { useProgress } from '../context/ProgressContext'
import type { AslSignLesson } from '../types/asl'
import './LearnPage.css'

export function LearnPage() {
  const { progress } = useProgress()
  const [selected, setSelected] = useState<AslSignLesson | null>(null)

  return (
    <div className="learn">
      <div className="section-heading">
        <div>
          <h1>The ASL manual alphabet</h1>
          <p>Work through each unit at your own pace, then head to Practice to try it with your webcam.</p>
        </div>
      </div>

      {CURRICULUM_UNITS.map((unit) => (
        <section key={unit.id} className="learn__unit">
          <h2>{unit.title}</h2>
          <p className="learn__unit-description">{unit.description}</p>
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

      {selected && (
        <div className="learn__detail card">
          <h3>
            {selected.displayName} — {selected.handshapeDescription}
          </h3>
          <p>{selected.tip}</p>
        </div>
      )}
    </div>
  )
}
