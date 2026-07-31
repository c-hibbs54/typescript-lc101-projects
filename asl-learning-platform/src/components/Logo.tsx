interface LogoProps {
  size?: number
}

/**
 * Original geometric mark: a hexagon badge (deep violet, thin warm-orange
 * trim) around an abstract "ILY" handshape built from simple rounded bars
 * (lime). No traced artwork, no text/wordmark from anywhere else - just this
 * app's own accent triad and its own subject matter (a hand sign).
 */
export function Logo({ size = 28 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="SignJutsu">
      <polygon
        points="41.3,34 24,44 6.7,34 6.7,14 24,4 41.3,14"
        fill="var(--color-accent)"
        stroke="var(--color-highlight)"
        strokeWidth="1.5"
      />
      <rect x="12" y="30" width="22" height="10" rx="5" fill="var(--color-lime-vivid)" />
      <rect x="13" y="24" width="4" height="16" rx="2" fill="var(--color-lime-vivid)" />
      <rect x="19" y="11" width="4" height="27" rx="2" fill="var(--color-lime-vivid)" />
      <rect x="28" y="16" width="4" height="22" rx="2" fill="var(--color-lime-vivid)" />
    </svg>
  )
}
