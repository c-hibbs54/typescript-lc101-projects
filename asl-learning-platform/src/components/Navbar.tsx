import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'
import './Navbar.css'

/**
 * Each section carries a real Japanese label for the same idea - not ornamental
 * kanji. The English stays the accessible name; the Japanese is marked
 * aria-hidden so a screen reader announces "Learn", not "Learn 学ぶ".
 */
const LINKS = [
  { to: '/', label: 'Home', ja: 'ホーム', end: true },
  { to: '/learn', label: 'Learn', ja: '学ぶ' },
  { to: '/practice', label: 'Practice', ja: '練習' },
  { to: '/quiz', label: 'Quiz', ja: '試験' },
  { to: '/spell', label: 'Spell', ja: '綴り' },
  { to: '/progress', label: 'Progress', ja: '記録' },
]

export function Navbar() {
  return (
    <header className="navbar">
      <NavLink to="/" className="navbar__brand" end>
        <Logo />
        <span className="navbar__wordmark">SignJutsu</span>
      </NavLink>
      <nav className="navbar__links" aria-label="Sections">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `navbar__link${isActive ? ' navbar__link--active' : ''}`}
          >
            <span className="navbar__link-en">{link.label}</span>
            <span className="navbar__link-ja ja" lang="ja" aria-hidden="true">
              {link.ja}
            </span>
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
