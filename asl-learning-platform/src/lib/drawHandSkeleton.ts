import type { HandLandmarks } from '../types/asl'

const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

/**
 * Draws the 21-point hand skeleton onto a canvas already sized to match the
 * mirrored video it overlays. Landmarks are normalized (0-1); x is flipped
 * because the video is displayed mirrored (selfie view) via CSS.
 */
export function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: HandLandmarks,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height)
  if (landmarks.length !== 21) return

  const toCanvas = (i: number) => ({
    x: (1 - landmarks[i].x) * width,
    y: landmarks[i].y * height,
  })

  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(91, 79, 233, 0.85)'
  ctx.beginPath()
  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = toCanvas(a)
    const pb = toCanvas(b)
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
  }
  ctx.stroke()

  ctx.fillStyle = '#22c55e'
  for (let i = 0; i < 21; i++) {
    const p = toCanvas(i)
    ctx.beginPath()
    ctx.arc(p.x, p.y, i === 0 ? 5 : 4, 0, Math.PI * 2)
    ctx.fill()
  }
}
