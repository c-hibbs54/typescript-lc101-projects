import './AmbientBackground.css'

interface AmbientBackgroundProps {
  /**
   * `calm` drops the expensive blurred blobs and keeps only the cheap line
   * work. Used on the camera pages: the hand-tracking model wants the GPU, and
   * large blurred layers are the costliest thing here to composite.
   */
  variant?: 'full' | 'calm'
}

/**
 * A permanently-drifting decorative layer behind the whole app, so the page is
 * never completely still.
 *
 * Everything animates transform/opacity only (compositor-friendly), sits behind
 * all content, and never intercepts input. Stops entirely under
 * `prefers-reduced-motion`.
 */
export function AmbientBackground({ variant = 'full' }: AmbientBackgroundProps) {
  return (
    <div className={`ambient ambient--${variant}`} aria-hidden="true">
      {variant === 'full' && (
        <>
          <span className="ambient__blob ambient__blob--violet" />
          <span className="ambient__blob ambient__blob--lime" />
          <span className="ambient__blob ambient__blob--orange" />
        </>
      )}

      {/* Drifting hand-ish glyphs: a nod to the subject without being literal. */}
      <svg className="ambient__glyphs" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <g className="ambient__glyph ambient__glyph--1">
          <circle cx="150" cy="170" r="34" />
          <rect x="140" y="60" width="20" height="90" rx="10" />
        </g>
        <g className="ambient__glyph ambient__glyph--2">
          <circle cx="1030" cy="230" r="26" />
          <rect x="1021" y="140" width="18" height="80" rx="9" />
        </g>
        <g className="ambient__glyph ambient__glyph--3">
          <circle cx="920" cy="650" r="30" />
          <rect x="910" y="552" width="20" height="86" rx="10" />
        </g>
        <g className="ambient__glyph ambient__glyph--4">
          <circle cx="260" cy="640" r="22" />
          <rect x="252" y="562" width="16" height="70" rx="8" />
        </g>
      </svg>
    </div>
  )
}
