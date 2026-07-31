import { useEffect, useRef } from 'react'
import './Mascot.css'

export type MascotMood = 'idle' | 'happy' | 'thinking' | 'cheer'

interface MascotProps {
  mood?: MascotMood
  size?: number
  /** Turns off cursor-following (e.g. on camera pages, or to keep it calm). */
  gaze?: boolean
  label?: string
}

/**
 * "Tomo", the study companion: an original cute 2D character - rounded
 * friendly forms, big cel-shaded anime eyes, in this app's own violet/lime/
 * orange palette. Not traced from or based on any existing character.
 *
 * Deliberately NOT a sign-teaching authority: it encourages and reacts, while
 * the accurate handshape reference stays the pose-driven GhostHand. A cartoon
 * mascot miming ASL would risk teaching subtly wrong handshapes.
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
      // Coalesce to one update per frame: pointermove fires far faster than
      // the screen refreshes, and this shares a thread with hand tracking.
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const rect = el.getBoundingClientRect()
        if (!rect.width) return
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        // Clamp so the eyes glance rather than wander off the face.
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

  const happy = mood === 'happy' || mood === 'cheer'

  return (
    <svg
      ref={rootRef}
      className={`mascot mascot--${mood}`}
      style={{ width: size, height: size }}
      viewBox="0 0 200 200"
      role="img"
      aria-label={label ?? 'Tomo, your practice companion'}
    >
      <g className="mascot__float">
        {/* Soft shadow anchors the character so the bob reads as floating. */}
        <ellipse className="mascot__shadow" cx="100" cy="181" rx="40" ry="7" />

        <g className="mascot__body-group">
          {/* Ears */}
          <path className="mascot__ear" d="M62 62 L52 26 L86 46 Z" />
          <path className="mascot__ear" d="M138 62 L148 26 L114 46 Z" />
          <path className="mascot__ear-inner" d="M66 58 L60 38 L80 49 Z" />
          <path className="mascot__ear-inner" d="M134 58 L140 38 L120 49 Z" />

          {/* Body */}
          <ellipse className="mascot__body" cx="100" cy="108" rx="64" ry="60" />
          {/* Cel-shade highlight: one crisp light shape, anime-style. */}
          <ellipse className="mascot__sheen" cx="76" cy="80" rx="31" ry="23" />

          {/* Headband, with tails that flutter */}
          <path className="mascot__band" d="M40 78 Q100 62 160 78 L160 90 Q100 74 40 90 Z" />
          <path className="mascot__band-tail mascot__band-tail--a" d="M158 82 Q182 88 190 106 Q172 98 156 94 Z" />
          <path className="mascot__band-tail mascot__band-tail--b" d="M158 88 Q178 102 176 122 Q164 108 154 98 Z" />

          {/* Eyes */}
          <g className="mascot__eyes">
            {happy ? (
              <>
                <path className="mascot__eye-arc" d="M62 110 Q78 92 94 110" />
                <path className="mascot__eye-arc" d="M106 110 Q122 92 138 110" />
              </>
            ) : (
              <>
                <ellipse className="mascot__eye-white" cx="78" cy="104" rx="17" ry="19" />
                <ellipse className="mascot__eye-white" cx="122" cy="104" rx="17" ry="19" />
                <g className="mascot__pupils">
                  <ellipse className="mascot__pupil" cx="78" cy="106" rx="9" ry="11.5" />
                  <ellipse className="mascot__pupil" cx="122" cy="106" rx="9" ry="11.5" />
                  <circle className="mascot__glint" cx="82" cy="99" r="3.4" />
                  <circle className="mascot__glint" cx="126" cy="99" r="3.4" />
                  <circle className="mascot__glint mascot__glint--small" cx="73.5" cy="112" r="1.9" />
                  <circle className="mascot__glint mascot__glint--small" cx="117.5" cy="112" r="1.9" />
                </g>
                {/* Lids sit over the eyes and scale down to blink. */}
                <g className="mascot__lids">
                  <ellipse className="mascot__lid" cx="78" cy="104" rx="18" ry="20" />
                  <ellipse className="mascot__lid" cx="122" cy="104" rx="18" ry="20" />
                </g>
              </>
            )}
          </g>

          <ellipse className="mascot__cheek" cx="54" cy="122" rx="10" ry="6.5" />
          <ellipse className="mascot__cheek" cx="146" cy="122" rx="10" ry="6.5" />

          {/* Mouth */}
          {happy ? (
            <path className="mascot__mouth mascot__mouth--open" d="M89 128 Q100 145 111 128 Q100 134 89 128 Z" />
          ) : (
            <path className="mascot__mouth" d="M92 129 Q100 137 108 129" />
          )}

          {/* Mitt hands - the left one waves */}
          <g className="mascot__hand mascot__hand--wave">
            <ellipse cx="30" cy="126" rx="14" ry="16" />
          </g>
          <g className="mascot__hand">
            <ellipse cx="170" cy="130" rx="14" ry="16" />
          </g>
        </g>

        {/* Celebration sparkles, only visible in the cheer mood */}
        <g className="mascot__sparkles" aria-hidden="true">
          <path className="mascot__sparkle" d="M30 44 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" />
          <path className="mascot__sparkle" d="M168 36 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" />
          <path className="mascot__sparkle" d="M150 156 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
        </g>
      </g>
    </svg>
  )
}
