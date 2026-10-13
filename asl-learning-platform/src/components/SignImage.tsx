import { useRef } from 'react'
import { GhostHand } from './GhostHand'
import './SignImage.css'

/** Letters supplied as illustrations in `public/hands`. */
const ILLUSTRATED = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))

interface SignImageProps {
  signId: string
  size?: number
}

/**
 * The reference illustration for a sign.
 *
 * Uses the hand-drawn alphabet artwork where it exists, and falls back to the
 * procedural {@link GhostHand} for anything not on that sheet (currently the
 * word sign "ILY"), so every sign still shows *something* rather than a gap.
 *
 * The artwork sits on a light plate: the source images have white backgrounds,
 * and a deliberate plate reads as intentional in both themes, where trying to
 * knock the white out with a blend mode falls apart on a dark page.
 */
export function SignImage({ signId, size = 180 }: SignImageProps) {
  const ref = useRef<HTMLDivElement>(null)

  if (!ILLUSTRATED.has(signId)) return <GhostHand signId={signId} size={size} />

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--tilt-x', `${(-py * 16).toFixed(1)}deg`)
    el.style.setProperty('--tilt-y', `${(px * 16).toFixed(1)}deg`)
  }

  const handlePointerLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.removeProperty('--tilt-x')
    el.style.removeProperty('--tilt-y')
  }

  return (
    <div
      ref={ref}
      className="sign-image"
      style={{ width: size, height: size }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="sign-image__stage">
        {/* BASE_URL keeps this correct under the GitHub Pages subpath deploy. */}
        <img
          className="sign-image__img"
          src={`${import.meta.env.BASE_URL}hands/${signId}.png`}
          alt={`Reference handshape for the letter ${signId}`}
          /* Not lazy: this appears in hint/detail panels the learner has just
             asked for, so it must be on screen immediately, not deferred. */
          decoding="async"
        />
      </div>
    </div>
  )
}
