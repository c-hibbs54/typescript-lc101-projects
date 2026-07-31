import type { DominantHand, HandDetectionResult, Handedness, HandRole } from '../types/asl'

/** A detected hand before its role has been decided. */
export type UnroledHand = Omit<HandDetectionResult, 'role'>

/**
 * Decides which detected hand is the 'primary' (main/dominant) signing hand
 * and which is the 'secondary' (supporting) one, so the rest of the app can
 * colour them consistently - primary violet, secondary green - without ever
 * depending on the order MediaPipe happened to return them in.
 *
 * Rules, in order:
 *  1. A hand whose handedness matches `dominantHand` wins primary. If both
 *     hands report the same handedness (it happens - handedness is a
 *     confidence score, not ground truth), the more confident one wins.
 *  2. If neither hand matches `dominantHand`, the more confident hand is
 *     primary, so the roles stay stable instead of flickering frame to frame.
 *  3. Only ever one primary; every remaining hand is secondary.
 *
 * Note on mirroring: MediaPipe reports handedness from the camera's point of
 * view on a mirrored (selfie) image, so what it labels 'Right' is the hand
 * that visually appears on the right of the un-mirrored frame. Rather than
 * trying to second-guess that per device, the learner's `dominantHand`
 * preference drives the choice - if the labels come out inverted on some
 * device, flipping that one preference corrects it.
 */
export function assignHandRoles(hands: UnroledHand[], dominantHand: DominantHand): HandDetectionResult[] {
  if (hands.length === 0) return []
  return rolesFromPrimaryIndex(hands, pickPrimaryIndex(hands, dominantHand))
}

function rolesFromPrimaryIndex(hands: UnroledHand[], primaryIndex: number): HandDetectionResult[] {
  const roled = hands.map((hand, i) => ({
    ...hand,
    role: (i === primaryIndex ? 'primary' : 'secondary') satisfies HandRole as HandRole,
  }))

  // Primary first, so consumers can rely on `hands[0]` being the main hand.
  const [primary] = roled.splice(primaryIndex, 1)
  return [primary, ...roled]
}

function pickPrimaryIndex(hands: UnroledHand[], dominantHand: DominantHand): number {
  const matching = indicesWithHandedness(hands, dominantHand)
  const pool = matching.length > 0 ? matching : hands.map((_, i) => i)

  let best = pool[0]
  for (const i of pool) {
    if (hands[i].handednessScore > hands[best].handednessScore) best = i
  }
  return best
}

function indicesWithHandedness(hands: UnroledHand[], handedness: Handedness): number[] {
  const found: number[] = []
  hands.forEach((hand, i) => {
    if (hand.handedness === handedness) found.push(i)
  })
  return found
}

/**
 * Max normalized wrist movement between frames still considered "the same
 * hand". Landmarks are 0-1 image coordinates, so 0.25 is a quarter of the
 * frame - far more than a hand travels in one frame, but far less than the
 * typical gap between two different hands.
 */
const SAME_HAND_DISTANCE = 0.25

/**
 * Consecutive frames the stateless preference must disagree with the current
 * primary before the role actually moves. ~8 frames is a quarter-second at
 * 30fps: long enough to swallow handedness jitter, short enough that a real
 * hand swap feels immediate.
 */
const SWITCH_FRAMES = 8

export interface HandRoleTracker {
  /** Roles this frame's hands, primary first. */
  assign: (hands: UnroledHand[]) => HandDetectionResult[]
  /** Change the learner's dominant hand; takes effect on the very next frame. */
  setDominantHand: (hand: DominantHand) => void
  /** Forget cross-frame state (e.g. the camera restarted). */
  reset: () => void
}

/**
 * Stateful wrapper around {@link assignHandRoles} that adds hysteresis, so the
 * violet "main hand" doesn't swap on a single bad frame.
 *
 * This matters because MediaPipe's handedness is a per-frame confidence, not
 * ground truth: for rotated or back-of-hand views it can flip label for a frame
 * or two, and both hands can even report the same label. Re-deciding from
 * scratch every frame would make the overlay colours flicker AND change which
 * hand gets graded - which in turn resets the hold-to-confirm meter, so a
 * learner with their other hand resting in frame could never complete a hold.
 *
 * The current primary hand is tracked by wrist proximity across frames and
 * keeps its role until the stateless preference disagrees for
 * {@link SWITCH_FRAMES} consecutive frames.
 */
export function createHandRoleTracker(initialDominantHand: DominantHand): HandRoleTracker {
  let dominantHand = initialDominantHand
  let previousPrimaryWrist: { x: number; y: number } | null = null
  let disagreementFrames = 0

  const reset = () => {
    previousPrimaryWrist = null
    disagreementFrames = 0
  }

  const assign = (hands: UnroledHand[]): HandDetectionResult[] => {
    if (hands.length === 0) {
      // Keep the remembered wrist: a hand dropping out for a frame or two
      // shouldn't forfeit its role once it comes back.
      return []
    }

    const preferred = pickPrimaryIndex(hands, dominantHand)
    const sticky = previousPrimaryWrist === null ? -1 : findNearestHand(hands, previousPrimaryWrist)

    let primaryIndex: number
    if (sticky < 0) {
      primaryIndex = preferred
      disagreementFrames = 0
    } else if (sticky === preferred) {
      primaryIndex = preferred
      disagreementFrames = 0
    } else {
      disagreementFrames += 1
      if (disagreementFrames >= SWITCH_FRAMES) {
        primaryIndex = preferred
        disagreementFrames = 0
      } else {
        primaryIndex = sticky
      }
    }

    const wrist = hands[primaryIndex].landmarks[0]
    previousPrimaryWrist = wrist ? { x: wrist.x, y: wrist.y } : null

    return rolesFromPrimaryIndex(hands, primaryIndex)
  }

  return {
    assign,
    setDominantHand: (hand: DominantHand) => {
      if (hand === dominantHand) return
      dominantHand = hand
      // Drop stickiness so flipping the preference re-colours immediately
      // instead of waiting out the switch delay.
      reset()
    },
    reset,
  }
}

/** Index of the hand whose wrist is closest to `target`, or -1 if none is close enough. */
function findNearestHand(hands: UnroledHand[], target: { x: number; y: number }): number {
  let bestIndex = -1
  let bestDistance = SAME_HAND_DISTANCE
  hands.forEach((hand, i) => {
    const wrist = hand.landmarks[0]
    if (!wrist) return
    const distance = Math.hypot(wrist.x - target.x, wrist.y - target.y)
    if (distance <= bestDistance) {
      bestDistance = distance
      bestIndex = i
    }
  })
  return bestIndex
}
