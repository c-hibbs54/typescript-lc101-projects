import { useEffect, useRef } from 'react'
import {
  KAERU_BACKING,
  KAERU_BAND,
  KAERU_BASE,
  KAERU_BELLY,
  KAERU_EYES,
  KAERU_EYE_GEOM,
  KAERU_INK_DETAIL,
  KAERU_MOUTH,
  KAERU_MOUTH_BOX,
  KAERU_PUPILS,
  KAERU_SHADE,
  KAERU_TAIL,
} from './kaeruPaths'
import './Mascot.css'

export type MascotMood = 'idle' | 'happy' | 'thinking' | 'cheer'

interface MascotProps {
  mood?: MascotMood
  size?: number
  /** Turns off cursor-following (e.g. on camera pages, or to keep it calm). */
  gaze?: boolean
  label?: string
}

const [LEFT_EYE, RIGHT_EYE] = KAERU_EYE_GEOM
const [MOUTH_X0, , MOUTH_X1, MOUTH_Y1] = KAERU_MOUTH_BOX

/** Broad grin, drawn across the resting mouth's own footprint. */
const HAPPY_MOUTH = `M${MOUTH_X0} ${MOUTH_Y1 - 8} C${MOUTH_X0 + 14} ${MOUTH_Y1 + 12} ${MOUTH_X1 - 14} ${
  MOUTH_Y1 + 12
} ${MOUTH_X1} ${MOUTH_Y1 - 8}`

/** Content squint: an upward arc sitting where the slit pupil would be. */
const squint = (eye: (typeof KAERU_EYE_GEOM)[number]) =>
  `M${eye.cx - eye.r * 0.72} ${eye.cy + eye.r * 0.3} Q${eye.cx} ${eye.cy - eye.r * 0.65} ${
    eye.cx + eye.r * 0.72
  } ${eye.cy + eye.r * 0.3}`

/**
 * "Kaeru", the study companion: the ninja frog from the supplied character art,
 * traced into SVG (see kaeruPaths.ts) so his parts can move independently. He
 * breathes, blinks, his headband tails flutter, and his eyes follow the cursor.
 * A single flat image could only ever be moved as one rigid block.
 *
 * Deliberately NOT a sign-teaching authority: he encourages and reacts, while
 * the accurate handshape reference stays the alphabet artwork in SignImage. A
 * cartoon miming ASL would risk teaching subtly wrong handshapes.
 *
 * Motion is CSS-only (transform/opacity, so it composites off the main thread)
 * and fully disabled under `prefers-reduced-motion`.
 */
export function Mascot({ mood = 'idle', size = 160, gaze = true, label }: MascotProps) {
  const rootRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!gaze) return
    const el = rootRef.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const onMove = (e: PointerEvent) => {
      // Coalesce to one update per frame: pointermove fires far faster than the
      // screen refreshes, and this shares a thread with hand tracking.
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const rect = el.getBoundingClientRect()
        if (!rect.width) return
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width * 1.6)))
        const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height * 1.6)))
        el.style.setProperty('--gaze-x', dx.toFixed(3))
        el.style.setProperty('--gaze-y', dy.toFixed(3))
      })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [gaze])

  const pleased = mood === 'happy' || mood === 'cheer'

  return (
    <svg
      ref={rootRef}
      className={`mascot mascot--${mood}`}
      style={{ width: size, height: size }}
      viewBox="0 0 200 200"
      role="img"
      aria-label={label ?? 'Kaeru, your practice companion'}
    >
      {/* Outside the bobbing group, so it stays on the ground he lifts off. */}
      <ellipse className="mascot__shadow" cx="98" cy="194" rx="58" ry="5" />

      <g className="mascot__float">
        <g className="mascot__breathe">
          {/* Headband tails. This copy of the band reaches back under the head,
              and is drawn first, so rotating it shows only the loose ends. */}
          <path className="mascot__band-tail" d={KAERU_TAIL} />

          {/* Solid body-coloured backing, so a hairline left between any two
              traced regions above shows body rather than the page. */}
          <path className="mascot__backing" d={KAERU_BACKING} />

          {KAERU_BASE.map((d, i) => (
            <path className="mascot__base" key={`base-${i}`} d={d} />
          ))}
          {KAERU_SHADE.map((d, i) => (
            <path className="mascot__shade" key={`shade-${i}`} d={d} />
          ))}

          <path className="mascot__belly" d={KAERU_BELLY} />
          {KAERU_EYES.map((d, i) => (
            <path className="mascot__eye" key={`eye-${i}`} d={d} />
          ))}

          <path className="mascot__band" d={KAERU_BAND} />
          {KAERU_INK_DETAIL.map((d, i) => (
            <path className="mascot__detail" key={`ink-${i}`} d={d} />
          ))}

          {pleased ? (
            <>
              <path className="mascot__squint" d={squint(LEFT_EYE)} />
              <path className="mascot__squint" d={squint(RIGHT_EYE)} />
              <path className="mascot__grin" d={HAPPY_MOUTH} />
            </>
          ) : (
            <>
              <path className="mascot__mouth" d={KAERU_MOUTH} />
              <g className="mascot__pupils">
                {KAERU_PUPILS.map((d, i) => (
                  <path className="mascot__pupil" key={`pupil-${i}`} d={d} />
                ))}
              </g>
              {/* Lids scale down over the eyes to blink. Body-coloured, so any
                  overshoot past the eye is invisible against the face. */}
              <g className="mascot__lids">
                {KAERU_EYE_GEOM.map((eye, i) => (
                  <circle
                    className="mascot__lid"
                    key={`lid-${i}`}
                    cx={eye.cx}
                    cy={eye.cy + 1}
                    r={eye.r + 1.4}
                  />
                ))}
              </g>
            </>
          )}
        </g>
      </g>

      {/* Celebration sparkles, only visible in the cheer mood */}
      <g className="mascot__sparkles" aria-hidden="true">
        <path className="mascot__sparkle" d="M14 34 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" />
        <path className="mascot__sparkle" d="M186 96 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" />
        <path className="mascot__sparkle" d="M22 120 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
      </g>
    </svg>
  )
}
