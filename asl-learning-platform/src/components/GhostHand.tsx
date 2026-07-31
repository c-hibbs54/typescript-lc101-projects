import { useId, useMemo, useRef } from 'react'
import { buildGhostArtwork, getGhostSign, type Digit, type GhostHandArt } from '../lib/ghostHandPoses'
import './GhostHand.css'

/**
 * One digit, drawn the way the reference art is built up:
 *   1. a dark outline stroke underneath (the linework),
 *   2. the body stroke, filled with a gradient that runs from the violet base
 *      colour where the digit leaves the palm to the green accent at the tip,
 *   3. a thin inner highlight along the lit edge.
 * The gradient is per-digit and in the hand's own coordinate space, so a curled
 * finger still has a green tip and the whole thing rotates with the hand.
 */
function DigitPath({ digit, gradientId, wide }: { digit: Digit; gradientId: string; wide?: boolean }) {
  const cls = wide ? ' ghost-hand__digit--thumb' : ''
  return (
    <>
      <path className={`ghost-hand__digit-line${cls}`} d={digit.d} />
      <path className={`ghost-hand__digit${cls}`} d={digit.d} stroke={`url(#${gradientId})`} />
      <path className={`ghost-hand__digit-sheen${cls}`} d={digit.d} />
    </>
  )
}

/**
 * One hand of the illustration. Painted in the three-tone order the reference
 * uses: glow halo, dark linework, base fill, shadow tone, then the green-tipped
 * digits on top.
 */
function GhostHandLayer({ art, uid }: { art: GhostHandArt; uid: string }) {
  const { role, paths, transform } = art
  const digits = [...paths.fingers, paths.thumb]

  return (
    <g className={`ghost-hand__hand ghost-hand__hand--${role}`} transform={transform}>
      <defs>
        {digits.map((digit, i) => (
          <linearGradient
            key={i}
            id={`${uid}-${role}-d${i}`}
            gradientUnits="userSpaceOnUse"
            x1={digit.base.x}
            y1={digit.base.y}
            x2={digit.tip.x}
            y2={digit.tip.y}
          >
            {/* Violet for most of the digit, green only over the last third -
                the reference keeps its fingers mostly violet and tips them. */}
            <stop offset="0%" className="ghost-hand__stop-base" />
            <stop offset="42%" className="ghost-hand__stop-base" />
            <stop offset="68%" className="ghost-hand__stop-mid" />
            <stop offset="94%" className="ghost-hand__stop-accent" />
          </linearGradient>
        ))}
      </defs>

      {/* Glow halo */}
      <g className="ghost-hand__glow">
        <path d={paths.palm} />
        {digits.map((digit, i) => (
          <path key={i} d={digit.d} />
        ))}
      </g>

      {/* Thumb first, so the palm covers its root and it reads as attached. */}
      <DigitPath digit={paths.thumb} gradientId={`${uid}-${role}-d${digits.length - 1}`} wide />

      {/* Palm: linework, base fill, then the deep shadow tone in the hollow */}
      <path className="ghost-hand__palm-line" d={paths.palm} />
      <path className="ghost-hand__palm" d={paths.palm} />
      <g className="ghost-hand__palm-shade" clipPath={`url(#${uid}-${role}-palmclip)`}>
        {/* Hollow of the palm, the thenar pad by the thumb, and the shaded
            pinky-side edge - the three places the reference darkens. */}
        <ellipse cx="112" cy="156" rx="32" ry="36" />
        <ellipse cx="147" cy="150" rx="15" ry="26" />
        <ellipse cx="82" cy="158" rx="11" ry="32" />
      </g>
      <clipPath id={`${uid}-${role}-palmclip`}>
        <path d={paths.palm} />
      </clipPath>

      {paths.fingers.map((digit, i) => (
        <DigitPath key={i} digit={digit} gradientId={`${uid}-${role}-d${i}`} />
      ))}
    </g>
  )
}

interface GhostHandProps {
  signId: string
  size?: number
}

/**
 * A reference illustration of a static handshape, drawn procedurally from the
 * same pose vectors the classifier grades against - so the picture can never
 * drift from what Practice/Quiz actually check for.
 *
 * Rendered in the app's three-tone art style: deep purple shade, violet base,
 * green fingertips, dark linework, soft violet halo, and a wrist that fades out
 * at the bottom. `buildGhostArtwork` handles all geometry, including rotating
 * each hand to its pose's `handOrientation` (what makes G/Q, K/P and H/U look
 * different) and framing so nothing clips.
 *
 * Two-handed signs draw a second, smaller supporting hand: main hand always
 * violet, supporting hand always green.
 */
export function GhostHand({ signId, size = 180 }: GhostHandProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Gradient/clip ids must be unique per mounted instance, or several hands on
  // one page all resolve to whichever was defined last.
  const uid = useId().replace(/:/g, '')
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
          <defs>
            {/* Fades the forearm out at the bottom, like the reference sheet. */}
            <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="72%" stopColor="#fff" stopOpacity="1" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={`${uid}-wrist`} maskContentUnits="objectBoundingBox">
              <rect x="0" y="0" width="1" height="1" fill={`url(#${uid}-fade)`} />
            </mask>
          </defs>
          <g mask={`url(#${uid}-wrist)`}>
            {/* Already ordered supporting-hand-first, so the main hand is in front. */}
            {artwork.hands.map((hand) => (
              <GhostHandLayer key={hand.role} art={hand} uid={uid} />
            ))}
          </g>
        </svg>
      </div>
    </div>
  )
}
