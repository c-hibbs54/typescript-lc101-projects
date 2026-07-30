import { ProgressBar } from './ProgressBar'
import type { ClassificationCandidate } from '../types/asl'

interface CandidateListProps {
  candidates: ClassificationCandidate[]
}

/** The live top-3 classifier guesses shown in both Practice and Quiz mode. */
export function CandidateList({ candidates }: CandidateListProps) {
  return (
    <div className="practice__candidates">
      <h4>Live guesses</h4>
      {candidates.length === 0 && <p className="practice__no-hand">Show your hand to the camera.</p>}
      {candidates.map((c) => (
        <div key={c.letter} className="practice__candidate-row">
          <span>{c.letter}</span>
          <ProgressBar value={c.confidence} max={1} />
          <span className="practice__candidate-pct">{Math.round(c.confidence * 100)}%</span>
        </div>
      ))}
    </div>
  )
}
