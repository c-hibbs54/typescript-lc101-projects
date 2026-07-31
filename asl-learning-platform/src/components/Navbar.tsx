import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'
import './Navbar.css'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/learn', label: 'Learn' },
  { to: '/practice', label: 'Practice' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/spell', label: 'Spell' },
  { to: '/progress', label: 'Progress' },
]

export function Navbar() {
  return (
    <header className="navbar">
      <NavLink to="/" className="navbar__brand" end>
        <Logo />
        SignJutsu
      </NavLink>
      <nav className="navbar__links">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `navbar__link${isActive ? ' navbar__link--active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
