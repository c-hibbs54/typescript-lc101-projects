/**
 * Shared contracts used across the curriculum data, the hand-shape classifier,
 * the webcam/MediaPipe hook, and the UI. Keep this the single source of truth
 * for cross-module shapes so the pieces can be built independently.
 */

export interface Point3D {
  x: number
  y: number
  z: number
}

/** 21 MediaPipe hand landmarks (wrist + 4 joints per finger), normalized 0-1 image coordinates. */
export type HandLandmarks = Point3D[]

export type Handedness = 'Left' | 'Right'

export interface HandDetectionResult {
  landmarks: HandLandmarks
  handedness: Handedness
  handednessScore: number
  timestampMs: number
}

export interface ClassificationCandidate {
  letter: string
  confidence: number
}

export interface ClassificationResult {
  best: ClassificationCandidate | null
  /** Sorted descending by confidence, top 3. */
  candidates: ClassificationCandidate[]
}

export type LetterDifficulty = 'easy' | 'medium' | 'hard'

/** Whether the sign is a single static handshape or requires in-air movement/orientation change. */
export type SignMotion = 'static' | 'motion'

export interface AslSignLesson {
  /** Stable id: single letter for alphabet signs (e.g. 'A'), short code for words (e.g. 'ILY'). */
  id: string
  displayName: string
  category: 'letter' | 'word'
  motion: SignMotion
  difficulty: LetterDifficulty
  handshapeDescription: string
  tip: string
  /** False for motion signs (J, Z, ...) the static-frame classifier cannot attempt. */
  recognizable: boolean
}

export interface CurriculumUnit {
  id: string
  title: string
  description: string
  signIds: string[]
}

export interface PracticeWord {
  word: string
  hint: string
}

export interface LetterProgress {
  attempts: number
  correct: number
  lastPracticedAt: number | null
  mastered: boolean
}

export interface ProgressState {
  letters: Record<string, LetterProgress>
  quizHighScore: number
  quizAttempts: number
  streakDays: number
  lastActiveDate: string | null
}

export const MASTERY_THRESHOLD = 5
export const MASTERY_ACCURACY = 0.8
