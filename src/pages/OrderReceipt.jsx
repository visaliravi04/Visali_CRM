import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { money, longDate, niceTime, shortDate } from '../lib/helpers'

export default function OrderReceipt() {
  const { id } = useParams()
  const nav = useNavigate()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let off = false
    Promise.all([
      supabase.from('order_summary').select('*').eq('id', id).single(),
      supabase.from('order_items').select('*').eq('order_id', id).order('created_at'),
      supabase.from('shop_settings').select('*').eq('id', 1).single(),
    ]).then(([o, i, s]) => {
      if (off) return
      setOrder(o.data)
      setItems(i.data || [])
      setSettings(s.data)
      setLoading(false)
    })
    return () => { off = true }
  }, [id])

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>
  if (!order) return <div className="page"><p className="muted">Order not found.</p></div>

  return (
    <div className="page receipt">
      <div className="receipt-actions">
        <button className="btn-primary btn-sm" onClick={() => window.print()}>Save as PDF</button>
        <button className="btn-ghost btn-sm" onClick={() => nav(-1)}>Back</button>
      </div>

      <header className="receipt-head">
        <h1>{settings?.shop_name || 'Stitch Ledger'}</h1>
        <p className="mono dim">Order #{order.order_no} · {shortDate(order.order_date)}</p>
      </header>

      <section className="receipt-section">
        <h2>Customer</h2>
        <p>
          {order.customer_name}<br />
          <span className="mono">{order.customer_phone}</span>
        </p>
      </section>

      <section className="receipt-section">
        <h2>Delivery</h2>
        <p>
          {longDate(order.due_date)}{order.due_time ? ` · ${niceTime(order.due_time)}` : ''}<br />
          {order.delivery_mode === 'courier'
            ? `Courier${order.courier_destination ? ' to ' + order.courier_destination : ''}`
            : 'Pickup at shop'}
        </p>
      </section>

      <section className="receipt-section">
        <h2>Items</h2>
        <table className="receipt-table">
          <thead>
            <tr><th>Service</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td>
                  {it.service_name}
                  {it.item_notes && <span className="dim"> — {it.item_notes}</span>}
                </td>
                <td className="mono">{it.qty}</td>
                <td className="mono">{money(it.unit_price)}</td>
                <td className="mono">{money(it.qty * it.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="receipt-section receipt-totals">
        <div><span>Total</span><b className="mono">{money(order.total_amount)}</b></div>
        <div><span>Paid</span><b className="mono">{money(order.amount_paid)}</b></div>
        <div className={order.amount_due > 0 ? 'due' : ''}>
          <span>Balance due</span><b className="mono">{money(order.amount_due)}</b>
        </div>
      </section>

      {order.notes && (
        <section className="receipt-section">
          <h2>Note</h2>
          <p>{order.notes}</p>
        </section>
      )}
    </div>
  )
}
