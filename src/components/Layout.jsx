import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tracker', label: 'Tracker' },
  { to: '/documents', label: 'Documents' },
  { to: '/recyclers', label: 'Recyclers' },
  { to: '/export', label: 'Audit Export' },
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const menuRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    setMenuOpen(false)
    await supabase.auth.signOut()
    navigate('/login')
  }

  const initial = user?.email?.[0]?.toUpperCase() || 'U'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--sans)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top Navbar ── */}
      <header style={{
        height: '60px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 28px',
        position: 'sticky', top: 0, zIndex: 100,
        gap: '32px',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '14px', color: 'var(--text)', lineHeight: 1 }}>Agastya</div>
            <div style={{ fontSize: '9px', color: 'var(--accent)', letterSpacing: '1px', marginTop: '2px' }}>FY 2025–26</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border)', flexShrink: 0 }} />

        {/* Nav Links — Desktop */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}
          className="max-lg:hidden">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to}
              style={({ isActive }) => ({
                padding: '7px 16px', borderRadius: '8px',
                fontSize: '13px', fontWeight: 500,
                textDecoration: 'none', transition: 'all 0.15s',
                background: isActive ? 'rgba(0,200,150,0.12)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--muted)',
                border: isActive ? '1px solid rgba(0,200,150,0.25)' : '1px solid transparent',
              })}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right — Avatar + Dropdown */}
        <div style={{ marginLeft: 'auto', position: 'relative', flexShrink: 0 }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen(p => !p)}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              border: menuOpen ? '2px solid var(--accent)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, color: '#000', fontSize: '14px',
              cursor: 'pointer', transition: 'all 0.15s',
              boxShadow: menuOpen ? '0 0 0 3px rgba(0,200,150,0.2)' : 'none',
            }}>
            {initial}
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 10px)',
              width: '220px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: '12px',
              padding: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              zIndex: 200,
            }}>
              {/* User info */}
              <div style={{ padding: '10px 12px 12px', borderBottom: '1px solid var(--border)', marginBottom: '6px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#000', fontSize: '13px', marginBottom: '8px' }}>
                  {initial}
                </div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>My Account</p>
                <p style={{ fontSize: '11px', color: 'var(--muted)', wordBreak: 'break-all' }}>{user?.email}</p>
              </div>

              {/* Nav links in mobile dropdown */}
              <div className="lg:hidden">
                {navItems.map(item => (
                  <NavLink key={item.to} to={item.to}
                    onClick={() => setMenuOpen(false)}
                    style={({ isActive }) => ({
                      display: 'block', padding: '9px 12px', borderRadius: '8px',
                      fontSize: '13px', fontWeight: 500, textDecoration: 'none',
                      color: isActive ? 'var(--accent)' : 'var(--muted)',
                      background: isActive ? 'rgba(0,200,150,0.08)' : 'transparent',
                      marginBottom: '2px',
                    })}>
                    {item.label}
                  </NavLink>
                ))}
                <div style={{ height: '1px', background: 'var(--border)', margin: '6px 0' }} />
              </div>

              {/* Logout */}
              <button onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '9px 12px', borderRadius: '8px',
                  background: 'transparent', border: 'none',
                  fontSize: '13px', fontWeight: 500, color: 'var(--danger)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span>🚪</span> Log Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Page Content ── */}
      <main style={{ flex: 1, padding: '36px 32px', maxWidth: '1200px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {children}
      </main>

    </div>
  )
}