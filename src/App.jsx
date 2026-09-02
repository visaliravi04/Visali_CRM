import React, { useEffect, useState } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import MenuDrawer from './components/MenuDrawer'
import TodayPage from './pages/TodayPage'
import NewOrder from './pages/NewOrder'
import EditOrder from './pages/EditOrder'
import OrderReceipt from './pages/OrderReceipt'
import CalendarPage from './pages/CalendarPage'
import OrdersPage from './pages/OrdersPage'
import CustomersPage from './pages/CustomersPage'
import CustomerDetailPage from './pages/CustomerDetailPage'
import MaterialsPage from './pages/MaterialsPage'
import SummaryPage from './pages/SummaryPage'
import SettingsPage from './pages/SettingsPage'

const TABS = [
  { to: '/orders',   label: 'Orders' },
  { to: '/new',      label: 'New' },
  { to: '/summary',  label: 'Summary' },
]

const MENU_LINKS = [
  { to: '/today',     label: 'Today' },
  { to: '/calendar',  label: 'Calendar' },
  { to: '/customers', label: 'Customers' },
  { to: '/materials', label: 'Materials' },
  { to: '/settings',  label: 'Setup' },
]

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (!session) return <SignIn />

  return (
    <div className="app">
      <div className="header-wrap">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <span /><span /><span />
          </button>
          <span className="mark">Visali Designer Ledger</span>
          <button className="btn-ghost btn-sm" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </header>

        <nav className="tabbar">
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to}
              className={({ isActive }) => `tab ${isActive ? 'on' : ''}`}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} links={MENU_LINKS} />

      <Routes>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/new" element={<NewOrder />} />
        <Route path="/orders/:id/edit" element={<EditOrder />} />
        <Route path="/orders/:id/receipt" element={<OrderReceipt />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </div>
  )
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('signin')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    const { error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
  }

  return (
    <div className="signin-wrap">
      <form className="signin" onSubmit={submit}>
        <span className="mark big">Visali Designer Ledger</span>
        <p className="signin-sub">Orders, delivery dates and payments for the shop.</p>
        <div className="field">
          <label htmlFor="em">Email</label>
          <input id="em" type="email" value={email} required
            onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={password} required minLength={6}
            onChange={e => setPassword(e.target.value)} />
        </div>
        {err && <p className="err">{err}</p>}
        <button className="btn-primary btn-wide" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="btn-link"
          onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setErr('') }}>
          {mode === 'signin' ? 'First time? Create the shop account' : 'Already set up? Sign in'}
        </button>
      </form>
    </div>
  )
}
