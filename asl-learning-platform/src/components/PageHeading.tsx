import type { ReactNode } from 'react'
import './PageHeading.css'

interface PageHeadingProps {
  /** Section name, matching its navbar entry. */
  eyebrow: string
  /** Japanese label for the same section. Decorative echo of `eyebrow`. */
  ja: string
  title: string
  children?: ReactNode
}

/**
 * Page title block: an angled section kicker, then the title set as a heavy
 * oblique slab of type.
 *
 * The kicker's English is plain text (so it is announced normally), while the
 * Japanese beside it is aria-hidden - it repeats the English rather than adding
 * information, so announcing both would just be noise.
 */
export function PageHeading({ eyebrow, ja, title, children }: PageHeadingProps) {
  return (
    <header className="page-heading">
      <p className="page-heading__kicker slab slab--edged">
        <span className="page-heading__kicker-en">{eyebrow}</span>
        <span className="page-heading__kicker-ja ja" lang="ja" aria-hidden="true">
          {ja}
        </span>
      </p>
      <h1 className="page-heading__title">{title}</h1>
      {children}
    </header>
  )
}
