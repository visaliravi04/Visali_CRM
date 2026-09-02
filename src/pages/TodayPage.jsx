import React, { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import OrderCard from '../components/OrderCard'
import { buildQueue, shipToday, reasonFor } from '../lib/priority'
import {
  money, longDate, shortDate, todayISO,
  startOfWeek, endOfWeek, monthRange, revenueTotals,
} from '../lib/helpers'

export default function TodayPage() {
  const [orders, setOrders] = useState([])
  const [zones, setZones] = useState([])
  const [settings, setSettings] = useState(null)
  const [week, setWeek] = useState([])
  const [month, setMonth] = useState([])
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  const [wFrom, wTo] = useMemo(() => [startOfWeek(), endOfWeek()], [])
  const [mFrom, mTo] = useMemo(() => {
    const d = new Date()
    return monthRange(d.getFullYear(), d.getMonth())
  }, [])

  useEffect(() => {
    let off = false
    setLoading(true)
    Promise.all([
      supabase.from('order_summary').select('*').in('status', ['open', 'ready']).limit(500),
      supabase.from('courier_zones').select('*'),
      supabase.from('shop_settings').select('*').eq('id', 1).single(),
      supabase.from('order_summary').select('*')
        .or(`and(order_date.gte.${wFrom},order_date.lte.${wTo}),and(due_date.gte.${wFrom},due_date.lte.${wTo})`),
      supabase.from('order_summary').select('*')
        .or(`and(order_date.gte.${mFrom},order_date.lte.${mTo}),and(due_date.gte.${mFrom},due_date.lte.${mTo})`),
    ]).then(([o, z, s, w, m]) => {
      if (off) return
      setOrders(o.data || [])
      setZones(z.data || [])
      setSettings(s.data)
      setWeek(w.data || [])
      setMonth(m.data || [])
      setLoading(false)
    })
    return () => { off = true }
  }, [reload, wFrom, wTo, mFrom, mTo])

  const queue = useMemo(
    () => (settings ? buildQueue(orders, zones, settings) : { today: [], upNext: [] }),
    [orders, zones, settings]
  )
  const shipping = useMemo(
    () => (settings ? shipToday(orders, zones, settings) : []),
    [orders, zones, settings]
  )

  const overdue  = queue.today.filter(o => o.urgencyDays < 0)
  const dueToday = queue.today.filter(o => o.urgencyDays === 0)
  const comingUp = queue.today.filter(o => o.urgencyDays > 0)

  const weekTotals  = revenueTotals(week, wFrom, wTo)
  const monthTotals = revenueTotals(month, mFrom, mTo)

  return (
    <div className="page">
      <h1 className="page-title">Today</h1>
      <p className="range-line">{longDate(todayISO())}</p>

      {loading && <p className="muted">Loading…</p>}

      {!loading && (
        <>
          {shipping.length > 0 && (
            <section className="ship-alert">
              <h2 className="section-label overdue">
                Ship out today<span className="section-count mono">{shipping.length}</span>
              </h2>
              <p className="hint">Finished courier orders that need to leave today to reach the customer on time.</p>
              <ul className="sum-list">
                {shipping.map(o => (
                  <li key={o.id}>
                    <span className="sum-name">{o.customer_name}</span>
                    <span className="mono dim">{o.courier_destination || 'Courier'}</span>
                    <span className="mono">#{o.order_no}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <h2 className="section-label">
            Today's priority<span className="section-count mono">{queue.today.length}</span>
          </h2>

          {queue.today.length === 0 && (
            <div className="empty">
              <h3>Nothing urgent</h3>
              <p>No unfinished orders need work today.</p>
            </div>
          )}

          <PriorityGroup label="Overdue to finish" tone="overdue" items={overdue} onChanged={() => setReload(r => r + 1)} />
          <PriorityGroup label="Finish today" tone="today" items={dueToday} onChanged={() => setReload(r => r + 1)} />
          <PriorityGroup label="Coming up" tone="" items={comingUp} onChanged={() => setReload(r => r + 1)} />

          {queue.upNext.length > 0 && (
            <>
              <h2 className="section-label">
                Up next<span className="section-count mono">{queue.upNext.length}</span>
              </h2>
              <ul className="sum-list">
                {queue.upNext.map(o => (
                  <li key={o.id}>
                    <span className="sum-name">{o.customer_name}</span>
                    <span className="mono dim">{shortDate(o.due_date)}</span>
                    <span className="mono">
                      {o.urgencyDays < 0 ? `${Math.abs(o.urgencyDays)}d late`
                        : o.urgencyDays === 0 ? 'today' : `in ${o.urgencyDays}d`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="section-label">Revenue</h2>
          <section className="card">
            <h2 className="card-label">This week</h2>
            <div className="money-grid">
              <div><span>Billed</span><b className="mono">{money(weekTotals.billed)}</b></div>
              <div><span>Collected</span><b className="mono">{money(weekTotals.collected)}</b></div>
              <div className={weekTotals.outstanding > 0 ? 'due' : ''}>
                <span>Outstanding</span><b className="mono">{money(weekTotals.outstanding)}</b>
              </div>
            </div>
          </section>
          <section className="card">
            <h2 className="card-label">This month</h2>
            <div className="money-grid">
              <div><span>Billed</span><b className="mono">{money(monthTotals.billed)}</b></div>
              <div><span>Collected</span><b className="mono">{money(monthTotals.collected)}</b></div>
              <div className={monthTotals.outstanding > 0 ? 'due' : ''}>
                <span>Outstanding</span><b className="mono">{money(monthTotals.outstanding)}</b>
              </div>
            </div>
          </section>
          <NavLink to="/summary" className="btn-link">Full summary, week or month →</NavLink>
        </>
      )}
    </div>
  )
}

function PriorityGroup({ label, tone, items, onChanged }) {
  if (items.length === 0) return null
  return (
    <>
      <h2 className={`section-label ${tone}`}>
        {label}<span className="section-count mono">{items.length}</span>
      </h2>
      {items.map(o => (
        <div className="priority-item" key={o.id}>
          <span className={`reason-tag ${tone}`}>{reasonFor(o)}</span>
          <OrderCard order={o} onChanged={onChanged} compact />
        </div>
      ))}
    </>
  )
}
