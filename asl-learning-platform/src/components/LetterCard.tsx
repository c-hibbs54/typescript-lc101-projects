import type { AslSignLesson } from '../types/asl'
import './LetterCard.css'

interface LetterCardProps {
  sign: AslSignLesson
  mastered?: boolean
  selected?: boolean
  onSelect?: (sign: AslSignLesson) => void
}

export function LetterCard({ sign, mastered, selected, onSelect }: LetterCardProps) {
  return (
    <button
      type="button"
      className={`letter-card card${selected ? ' letter-card--selected' : ''}`}
      onClick={() => onSelect?.(sign)}
    >
      <div className="letter-card__top">
        <span className="letter-card__glyph">{sign.displayName}</span>
        <span className={`badge badge--${sign.difficulty}`}>{sign.difficulty}</span>
      </div>
      <p className="letter-card__description">{sign.handshapeDescription}</p>
      <p className="letter-card__tip">💡 {sign.tip}</p>
      <div className="letter-card__footer">
        {sign.motion === 'motion' && <span className="badge badge--muted">Motion sign</span>}
        {!sign.recognizable && <span className="badge badge--muted">Not live-recognized yet</span>}
        {mastered && <span className="badge badge--easy">Mastered ✓</span>}
      </div>
    </button>
  )
}
