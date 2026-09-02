import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import OrderCard from '../components/OrderCard'
import { shortDate, todayISO, dueState } from '../lib/helpers'

const FILTERS = [
  { id: 'active',    label: 'Active' },
  { id: 'overdue',   label: 'Overdue' },
  { id: 'today',     label: 'Today' },
  { id: 'delivered', label: 'Delivered' },
]

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('active')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let off = false
    setLoading(true)
    let sel = supabase.from('order_summary').select('*')

    if (filter === 'delivered') sel = sel.eq('status', 'delivered')
    else sel = sel.in('status', ['open', 'ready'])

    if (filter === 'overdue') sel = sel.lt('due_date', todayISO())
    if (filter === 'today')   sel = sel.eq('due_date', todayISO())

    sel.order('due_date', { ascending: filter !== 'delivered' })
      .order('due_time', { nullsFirst: false })
      .limit(300)
      .then(({ data }) => { if (!off) { setOrders(data || []); setLoading(false) } })
    return () => { off = true }
  }, [filter, reload])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return orders
    return orders.filter(o =>
      o.customer_name.toLowerCase().includes(t) ||
      String(o.customer_phone).includes(t) ||
      String(o.order_no).includes(t)
    )
  }, [orders, q])

  // Group by due date so the list reads like the calendar
  const groups = useMemo(() => {
    const m = new Map()
    for (const o of shown) {
      if (!m.has(o.due_date)) m.set(o.due_date, [])
      m.get(o.due_date).push(o)
    }
    return [...m.entries()]
  }, [shown])

  return (
    <div className="page">
      <h1 className="page-title">Orders</h1>

      <input className="search" value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search name, phone or order number" />

      <div className="chips">
        {FILTERS.map(f => (
          <button key={f.id} className={`chip ${filter === f.id ? 'on' : ''}`}
            onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && groups.length === 0 && (
        <div className="empty">
          <h3>Nothing here</h3>
          <p>{filter === 'active'
            ? 'No open orders. Add one from the New tab.'
            : 'No orders match this filter.'}</p>
        </div>
      )}

      {groups.map(([date, list]) => (
        <section key={date} className="day-group">
          <h2 className={`section-label ${dueState(date, 'open')}`}>
            {shortDate(date)}
            <span className="section-count mono">{list.length}</span>
          </h2>
          {list.map(o => (
            <OrderCard key={o.id} order={o} onChanged={() => setReload(r => r + 1)} compact />
          ))}
        </section>
      ))}
    </div>
  )
}
