import { useMemo, useRef } from 'react'
import { buildGhostArtwork, getGhostSign, type GhostHandArt } from '../lib/ghostHandPoses'
import './GhostHand.css'

/**
 * One hand of the illustration: a blurred glow layer under the solid palm,
 * fingers, and thumb. All four take their colour from the role modifier class,
 * never from a hardcoded hex.
 */
function GhostHandLayer({ role, paths, transform }: GhostHandArt) {
  return (
    <g className={`ghost-hand__hand ghost-hand__hand--${role}`} transform={transform}>
      {/* The glow's first child must stay the palm - CSS fills only that one. */}
      <g className="ghost-hand__glow">
        <path d={paths.palm} />
        {paths.fingers.map((d, i) => (
          <path key={i} d={d} />
        ))}
        <path d={paths.thumb} />
      </g>
      <path className="ghost-hand__palm" d={paths.palm} />
      {paths.fingers.map((d, i) => (
        <path key={i} className="ghost-hand__finger" d={d} />
      ))}
      <path className="ghost-hand__finger ghost-hand__thumb" d={paths.thumb} />
    </g>
  )
}

interface GhostHandProps {
  signId: string
  size?: number
}

/**
 * A translucent "ghost" illustration of a static handshape, built procedurally
 * from the same pose data the classifier uses (so it's always consistent with
 * what Practice/Quiz actually check for) rather than a traced/photographed
 * reference. Wrapped in a gentle 3D tilt for a pseudo-holographic look - not a
 * live rotating model, just a flat illustration that rocks in perspective.
 *
 * All geometry - including rotating the hand to its pose's `handOrientation`,
 * which is what makes G/Q, K/P and H/U look different from each other - comes
 * from `buildGhostArtwork`, so the framing is unit tested against real
 * curriculum values rather than eyeballed here.
 *
 * Two-handed signs draw a second, smaller supporting hand alongside. Per the
 * illustration convention the main signing hand is always violet and the
 * supporting hand always green; one-handed signs (all of them today) render the
 * single violet hand they always have.
 */
export function GhostHand({ signId, size = 180 }: GhostHandProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const artwork = useMemo(() => {
    const sign = getGhostSign(signId)
    return sign ? buildGhostArtwork(sign) : null
  }, [signId])

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--tilt-x', `${(-py * 22).toFixed(1)}deg`)
    el.style.setProperty('--tilt-y', `${(px * 22).toFixed(1)}deg`)
  }

  const handlePointerLeave = () => {
    const el = containerRef.current
    if (!el) return
    el.style.removeProperty('--tilt-x')
    el.style.removeProperty('--tilt-y')
  }

  if (!artwork) return null

  const twoHanded = artwork.hands.length > 1
  const label = twoHanded
    ? `Reference handshape for ${signId}, two hands: the main signing hand plus a supporting hand`
    : `Reference handshape for ${signId}, one hand`

  return (
    <div
      ref={containerRef}
      className="ghost-hand"
      style={{ width: size, height: size }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="ghost-hand__stage">
        <svg className="ghost-hand__svg" viewBox={artwork.viewBox} role="img" aria-label={label}>
          {/* Already ordered supporting-hand-first, so the dominant hand layers in front. */}
          {artwork.hands.map((hand) => (
            <GhostHandLayer key={hand.role} {...hand} />
          ))}
        </svg>
      </div>
    </div>
  )
}
