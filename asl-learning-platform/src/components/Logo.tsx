import { MARK_FILL, MARK_LINE, MARK_RING } from './logoMark'
import './Logo.css'

interface LogoProps {
  size?: number
}

/**
 * The SignJutsu mark: a ringed handshape, traced from the supplied logo drawing
 * (see logoMark.ts).
 *
 * Two colours only, and both come from tokens rather than the drawing's flat
 * black-and-green: the handshape takes the EVA-01 accent it shares with the
 * mascot, and the linework takes `currentColor` so it inherits whatever text
 * colour the mark is sitting in. That is what lets the same mark read on a pale
 * page and a near-black one - a pinned black ring would vanish in dark mode.
 *
 * The wordmark is deliberately not part of this: it is set in the app's own
 * heavy oblique type by whoever places the mark, so the lettering matches the
 * rest of the interface instead of the drawing's serif.
 */
export function Logo({ size = 28 }: LogoProps) {
  return (
    <svg
      className="logo"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="SignJutsu"
    >
      {/* Fill first: the linework below carries knocked-out holes that this
          shows through. */}
      {MARK_FILL.map((d, i) => (
        <path className="logo__fill" key={i} d={d} />
      ))}
      <path className="logo__line" d={MARK_LINE} />
      <circle
        className="logo__ring"
        cx={MARK_RING.cx}
        cy={MARK_RING.cy}
        r={MARK_RING.r}
        strokeWidth={MARK_RING.width}
      />
    </svg>
  )
}
