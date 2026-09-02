import React, { useEffect } from 'react'
import { NavLink } from 'react-router-dom'

export default function MenuDrawer({ open, onClose, links }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <nav className="drawer" onClick={e => e.stopPropagation()} aria-label="More pages">
        {links.map(l => (
          <NavLink key={l.to} to={l.to} onClick={onClose}
            className={({ isActive }) => `drawer-link ${isActive ? 'on' : ''}`}>
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
