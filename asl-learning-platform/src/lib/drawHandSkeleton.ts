import type { HandDetectionResult, HandLandmarks } from '../types/asl'

const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

/**
 * The live overlay's own look: violet bones, green joints, the same for every
 * hand in frame.
 *
 * Deliberately NOT the violet-primary / green-secondary role convention used by
 * the ghost-hand reference illustrations (see GhostHand.css) - here violet and
 * green distinguish bones from joints within a single hand, so reusing them to
 * mean "main vs supporting hand" would overload the same two colours with two
 * different meanings on the same screen. Which hand is the dominant one still
 * matters for grading; it just isn't expressed through colour here.
 */
const BONE_COLOR = 'rgba(91, 79, 233, 0.85)'
const JOINT_COLOR = '#22c55e'
const BONE_WIDTH = 3
const JOINT_RADIUS = 4
const WRIST_JOINT_RADIUS = 5

/**
 * Draws every hand of one video frame onto a canvas already sized to match the
 * mirrored video it overlays. Clears the canvas once for the whole frame.
 *
 * Landmarks are normalized (0-1); x is flipped because the video is displayed
 * mirrored (selfie view) via CSS.
 */
export function drawHands(
  ctx: CanvasRenderingContext2D,
  hands: readonly HandDetectionResult[],
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height)
  for (const hand of hands) {
    drawHandSkeleton(ctx, hand.landmarks, width, height)
  }
}

/** Draws a single 21-point skeleton: violet bones, green joints. */
function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: HandLandmarks,
  width: number,
  height: number,
): void {
  if (landmarks.length !== 21) return

  const toCanvas = (i: number) => ({
    x: (1 - landmarks[i].x) * width,
    y: landmarks[i].y * height,
  })

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.lineWidth = BONE_WIDTH
  ctx.strokeStyle = BONE_COLOR
  ctx.beginPath()
  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = toCanvas(a)
    const pb = toCanvas(b)
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
  }
  ctx.stroke()

  ctx.fillStyle = JOINT_COLOR
  for (let i = 0; i < 21; i++) {
    const p = toCanvas(i)
    ctx.beginPath()
    ctx.arc(p.x, p.y, i === 0 ? WRIST_JOINT_RADIUS : JOINT_RADIUS, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}
