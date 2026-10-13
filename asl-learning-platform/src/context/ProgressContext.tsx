import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { MASTERY_ACCURACY, MASTERY_THRESHOLD } from '../types/asl'
import type { DominantHand, LetterProgress, ProgressState } from '../types/asl'

const STORAGE_KEY = 'signjutsu:progress:v1'
/** Pre-rename key; read once so existing learners keep their progress. */
const LEGACY_STORAGE_KEY = 'signloop:progress:v1'

function emptyState(): ProgressState {
  return {
    letters: {},
    quizHighScore: 0,
    quizAttempts: 0,
    streakDays: 0,
    lastActiveDate: null,
    dominantHand: 'Right',
  }
}

function loadState(): ProgressState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<ProgressState>
    return { ...emptyState(), ...parsed, letters: parsed.letters ?? {} }
  } catch {
    return emptyState()
  }
}

/** Formats a date as the user's local calendar day (not UTC), e.g. "2026-07-30". */
function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayKey(): string {
  return localDateKey(new Date())
}

function bumpStreak(state: ProgressState): ProgressState {
  const today = todayKey()
  if (state.lastActiveDate === today) return state
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const streakDays = state.lastActiveDate === localDateKey(yesterday) ? state.streakDays + 1 : 1
  return { ...state, lastActiveDate: today, streakDays }
}

interface ProgressContextValue {
  progress: ProgressState
  recordAttempt: (letterId: string, correct: boolean) => void
  recordQuizResult: (score: number) => void
  resetProgress: () => void
  isMastered: (letterId: string) => boolean
  setDominantHand: (hand: DominantHand) => void
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ProgressState>(() => loadState())

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }, [progress])

  const recordAttempt = useCallback((letterId: string, correct: boolean) => {
    setProgress((prev) => {
      const withStreak = bumpStreak(prev)
      const existing: LetterProgress = withStreak.letters[letterId] ?? {
        attempts: 0,
        correct: 0,
        lastPracticedAt: null,
        mastered: false,
      }
      const attempts = existing.attempts + 1
      const correctCount = existing.correct + (correct ? 1 : 0)
      const mastered =
        existing.mastered || (attempts >= MASTERY_THRESHOLD && correctCount / attempts >= MASTERY_ACCURACY)
      return {
        ...withStreak,
        letters: {
          ...withStreak.letters,
          [letterId]: { attempts, correct: correctCount, lastPracticedAt: Date.now(), mastered },
        },
      }
    })
  }, [])

  const recordQuizResult = useCallback((score: number) => {
    setProgress((prev) => {
      const withStreak = bumpStreak(prev)
      return {
        ...withStreak,
        quizAttempts: withStreak.quizAttempts + 1,
        quizHighScore: Math.max(withStreak.quizHighScore, score),
      }
    })
  }, [])

  const resetProgress = useCallback(() => setProgress(emptyState()), [])

  const isMastered = useCallback((letterId: string) => Boolean(progress.letters[letterId]?.mastered), [progress])

  const setDominantHand = useCallback((dominantHand: DominantHand) => {
    setProgress((prev) => ({ ...prev, dominantHand }))
  }, [])

  const value = useMemo(
    () => ({ progress, recordAttempt, recordQuizResult, resetProgress, isMastered, setDominantHand }),
    [progress, recordAttempt, recordQuizResult, resetProgress, isMastered, setDominantHand],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- co-locating the hook with its provider is clearer than a near-empty extra file
export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress must be used within a ProgressProvider')
  return ctx
}
