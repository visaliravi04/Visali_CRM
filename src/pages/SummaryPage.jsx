import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import {
  money, startOfWeek, endOfWeek, monthRange, shortDate, longDate, revenueTotals,
} from '../lib/helpers'

export default function SummaryPage() {
  const [range, setRange] = useState('week')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const [from, to] = useMemo(() => {
    if (range === 'week') return [startOfWeek(), endOfWeek()]
    const d = new Date()
    return monthRange(d.getFullYear(), d.getMonth())
  }, [range])

  useEffect(() => {
    let off = false
    setLoading(true)
    supabase.from('order_summary').select('*')
      .or(`and(order_date.gte.${from},order_date.lte.${to}),and(due_date.gte.${from},due_date.lte.${to})`)
      .order('due_date')
      .then(({ data }) => { if (!off) { setRows(data || []); setLoading(false) } })
    return () => { off = true }
  }, [from, to])

  const delivered = rows.filter(r => r.status === 'delivered' && r.due_date >= from && r.due_date <= to)
  const pending   = rows.filter(r => ['open','ready'].includes(r.status) && r.due_date >= from && r.due_date <= to)

  const { taken, billed, collected, outstanding } = revenueTotals(rows, from, to)
  const pieces = taken.reduce((s, r) => s + Number(r.total_qty), 0)

  return (
    <div className="page">
      <h1 className="page-title">Summary</h1>

      <div className="seg seg-wide">
        <button className={range === 'week' ? 'on' : ''} onClick={() => setRange('week')}>This week</button>
        <button className={range === 'month' ? 'on' : ''} onClick={() => setRange('month')}>This month</button>
      </div>

      <p className="range-line">{longDate(from)} &ndash; {longDate(to)}</p>

      {loading && <p className="muted">Loading…</p>}

      {!loading && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat-n mono">{taken.length}</span>
              <span className="stat-l">orders taken</span>
            </div>
            <div className="stat">
              <span className="stat-n mono">{pieces}</span>
              <span className="stat-l">pieces</span>
            </div>
            <div className="stat">
              <span className="stat-n mono">{delivered.length}</span>
              <span className="stat-l">delivered</span>
            </div>
            <div className="stat">
              <span className="stat-n mono">{pending.length}</span>
              <span className="stat-l">still pending</span>
            </div>
          </div>

          <div className="money-grid">
            <div><span>Billed</span><b className="mono">{money(billed)}</b></div>
            <div><span>Collected</span><b className="mono">{money(collected)}</b></div>
            <div className={outstanding > 0 ? 'due' : ''}>
              <span>Outstanding</span><b className="mono">{money(outstanding)}</b>
            </div>
          </div>

          <h2 className="section-label">Orders taken<span className="section-count mono">{taken.length}</span></h2>
          <SummaryList rows={taken} dateKey="order_date" empty="No new orders in this period." />

          <h2 className="section-label">Delivered<span className="section-count mono">{delivered.length}</span></h2>
          <SummaryList rows={delivered} dateKey="due_date" empty="Nothing delivered yet in this period." />

          <h2 className="section-label">Still pending<span className="section-count mono">{pending.length}</span></h2>
          <SummaryList rows={pending} dateKey="due_date" empty="Nothing pending. All caught up." />
        </>
      )}
    </div>
  )
}

function SummaryList({ rows, dateKey, empty }) {
  if (rows.length === 0) return <p className="muted">{empty}</p>
  return (
    <ul className="sum-list">
      {rows.map(r => (
        <li key={r.id}>
          <span className="sum-name">{r.customer_name}</span>
          <span className="mono dim">{shortDate(r[dateKey])}</span>
          <span className="mono">{r.completed_qty}/{r.total_qty}</span>
          <span className={`mono ${Number(r.amount_due) > 0 ? 'due-text' : 'dim'}`}>
            {money(r.amount_due)}
          </span>
        </li>
      ))}
    </ul>
  )
}
