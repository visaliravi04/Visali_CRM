import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { monthRange, toISO, todayISO, dueState, shortDate, niceTime, money } from '../lib/helpers'
import OrderCard from '../components/OrderCard'

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DOW = ['M','T','W','T','F','S','S']

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [orders, setOrders] = useState([])
  const [picked, setPicked] = useState(todayISO())
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let off = false
    setLoading(true)
    const [from, to] = monthRange(year, month)
    supabase.from('order_summary').select('*')
      .gte('due_date', from).lte('due_date', to)
      .neq('status', 'cancelled')
      .order('due_date').order('due_time', { nullsFirst: false })
      .then(({ data }) => { if (!off) { setOrders(data || []); setLoading(false) } })
    return () => { off = true }
  }, [year, month, reload])

  // Group orders by their due date so each cell knows its own load
  const byDate = useMemo(() => {
    const m = {}
    for (const o of orders) (m[o.due_date] ||= []).push(o)
    return m
  }, [orders])

  // Month grid starting Monday
  const cells = useMemo(() => {
    const first = new Date(year, month, 1)
    const lead = (first.getDay() + 6) % 7
    const days = new Date(year, month + 1, 0).getDate()
    const out = []
    for (let i = 0; i < lead; i++) out.push(null)
    for (let d = 1; d <= days; d++) out.push(toISO(new Date(year, month, d)))
    return out
  }, [year, month])

  function step(n) {
    const d = new Date(year, month + n, 1)
    setYear(d.getFullYear()); setMonth(d.getMonth())
  }

  const dayOrders = byDate[picked] || []

  return (
    <div className="page">
      <div className="cal-head">
        <button className="cal-nav" onClick={() => step(-1)} aria-label="Previous month">‹</button>
        <h1 className="page-title cal-title">{MONTHS[month]} <span className="mono">{year}</span></h1>
        <button className="cal-nav" onClick={() => step(1)} aria-label="Next month">›</button>
      </div>

      <div className="cal-dow">
        {DOW.map((d, i) => <span key={i}>{d}</span>)}
      </div>

      <div className="cal-grid">
        {cells.map((iso, i) => {
          if (!iso) return <span className="cal-cell empty" key={`e${i}`} />
          const list = byDate[iso] || []
          const isToday = iso === todayISO()
          const state = list.length
            ? list.some(o => dueState(o.due_date, o.status) === 'overdue') ? 'overdue'
              : isToday ? 'today' : 'later'
            : ''
          return (
            <button
              key={iso}
              className={`cal-cell ${picked === iso ? 'picked' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => setPicked(iso)}
            >
              <span className="cal-num mono">{Number(iso.slice(-2))}</span>
              {list.length > 0 && (
                <span className={`cal-dot ${state}`}>{list.length}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="cal-day">
        <h2 className="section-label">
          {shortDate(picked)}
          <span className="section-count mono">
            {dayOrders.length} order{dayOrders.length === 1 ? '' : 's'}
          </span>
        </h2>

        {loading && <p className="muted">Loading…</p>}

        {!loading && dayOrders.length === 0 && (
          <p className="muted">Nothing due on this date.</p>
        )}

        {dayOrders.map(o => (
          <OrderCard key={o.id} order={o} onChanged={() => setReload(r => r + 1)} compact />
        ))}
      </div>
    </div>
  )
}
