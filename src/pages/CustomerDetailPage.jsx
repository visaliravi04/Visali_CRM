import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import OrderCard from '../components/OrderCard'
import { money } from '../lib/helpers'

export default function CustomerDetailPage() {
  const { id } = useParams()
  const [customer, setCustomer] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let off = false
    setLoading(true)
    Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('order_summary').select('*').eq('customer_id', id)
        .order('order_date', { ascending: false }),
    ]).then(([c, o]) => {
      if (off) return
      setCustomer(c.data)
      setOrders(o.data || [])
      setLoading(false)
    })
    return () => { off = true }
  }, [id, reload])

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>
  if (!customer) return <div className="page"><p className="muted">Customer not found.</p></div>

  const totalDue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.amount_due), 0)

  return (
    <div className="page">
      <h1 className="page-title">{customer.name}</h1>
      <p className="range-line">
        <span className="mono">#{customer.customer_no}</span> ·{' '}
        <span className="mono">{customer.phone}</span>
      </p>

      <div className="stat-grid">
        <div className="stat">
          <span className="stat-n mono">{orders.length}</span>
          <span className="stat-l">orders</span>
        </div>
        <div className="stat">
          <span className="stat-n mono">{money(totalDue)}</span>
          <span className="stat-l">balance due</span>
        </div>
      </div>

      <h2 className="section-label">
        Order history<span className="section-count mono">{orders.length}</span>
      </h2>

      {orders.length === 0 && <p className="muted">No orders yet.</p>}

      {orders.map(o => (
        <OrderCard key={o.id} order={o} onChanged={() => setReload(r => r + 1)} compact />
      ))}
    </div>
  )
}
