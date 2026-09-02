import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import TallyRow from './TallyRow'
import {
  money, shortDate, niceTime, dueState, dueLabel,
  waLink, fillTemplate, itemsSentence, RUPEE,
} from '../lib/helpers'

export default function OrderCard({ order, onChanged, compact }) {
  const [open, setOpen] = useState(!compact)
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [settings, setSettings] = useState(null)
  const [payOpen, setPayOpen] = useState(false)
  const [payAmt, setPayAmt] = useState('')
  const [courierOpen, setCourierOpen] = useState(false)
  const [courier, setCourier] = useState({
    courier_name: order.courier_name || '',
    courier_tracking: order.courier_tracking || '',
    courier_receipt_url: order.courier_receipt_url || '',
    courier_destination: order.courier_destination || '',
  })

  const state = dueState(order.due_date, order.status)
  const allDone = order.total_qty > 0 && order.completed_qty >= order.total_qty

  useEffect(() => {
    if (!open || loaded) return
    Promise.all([
      supabase.from('order_items').select('*').eq('order_id', order.id).order('created_at'),
      supabase.from('shop_settings').select('*').eq('id', 1).single(),
    ]).then(([i, s]) => {
      setItems(i.data || [])
      setSettings(s.data)
      setLoaded(true)
    })
  }, [open, loaded, order.id])

  async function setCompleted(itemId, n) {
    setItems(is => is.map(i => (i.id === itemId ? { ...i, completed_qty: n } : i)))
    await supabase.from('order_items').update({ completed_qty: n }).eq('id', itemId)
    onChanged?.()
  }

  async function markStatus(status) {
    setBusy(true)
    const patch = { status }
    if (status === 'delivered') patch.delivered_at = new Date().toISOString()
    await supabase.from('orders').update(patch).eq('id', order.id)
    setBusy(false)
    onChanged?.()
  }

  async function addPayment() {
    const amt = Number(payAmt)
    if (!amt || amt <= 0) return
    setBusy(true)
    await supabase.from('payments').insert({ order_id: order.id, amount: amt })
    setPayAmt(''); setPayOpen(false); setBusy(false)
    onChanged?.()
  }

  async function saveCourier() {
    setBusy(true)
    await supabase.from('orders').update({
      courier_name: courier.courier_name.trim() || null,
      courier_tracking: courier.courier_tracking.trim() || null,
      courier_receipt_url: courier.courier_receipt_url.trim() || null,
      courier_destination: courier.courier_destination.trim() || null,
    }).eq('id', order.id)
    setBusy(false); setCourierOpen(false)
    onChanged?.()
  }

  function buildMessage() {
    if (!settings) return ''
    const readyItems = items.filter(i => i.completed_qty > 0)
    const vars = {
      customer: order.customer_name,
      shop: settings.shop_name,
      items: itemsSentence(readyItems, true),
      tracking: courier.courier_tracking || order.courier_tracking || '',
      due: shortDate(order.due_date),
    }
    const tpl = order.delivery_mode === 'courier' ? settings.msg_courier : settings.msg_ready
    let msg = fillTemplate(tpl, vars)
    if (order.amount_due > 0) {
      msg += ` Balance to pay: ${money(order.amount_due)}.`
    }
    return msg
  }

  async function sendMessage() {
    const body = buildMessage()
    if (!body) return
    window.open(waLink(order.customer_phone, body, settings?.country_code || '91'), '_blank')
    await supabase.from('message_log').insert({ order_id: order.id, body })
  }

  return (
    <article className={`order ${state}`}>
      <div className="order-who">
        <NavLink to={`/customers/${order.customer_id}`} className="order-name">
          {order.customer_name}
        </NavLink>
        <span className="order-no mono">#{order.order_no}</span>
      </div>
      <button className="order-top" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <div className="order-meta">
          <span className={`pill ${state}`}>{dueLabel(order.due_date, order.status)}</span>
          {order.due_time && <span className="mono dim">{niceTime(order.due_time)}</span>}
        </div>
        <div className="order-progress mono">
          {order.completed_qty}/{order.total_qty} pieces
          {order.amount_due > 0 && <span className="due-tag">{money(order.amount_due)} due</span>}
        </div>
      </button>

      {open && (
        <div className="order-body">
          {!loaded && <p className="muted">Loading…</p>}

          {loaded && (
            <>
              {items.map(it => (
                <div className="item" key={it.id}>
                  <div className="item-head">
                    <span className="item-name">{it.service_name}</span>
                    <span className="mono dim">{money(it.unit_price)} each</span>
                  </div>
                  {it.item_notes && <p className="item-note">{it.item_notes}</p>}
                  {it.design_ref_url && (
                    <a className="item-link" href={it.design_ref_url}
                       target="_blank" rel="noreferrer noopener">Design reference</a>
                  )}
                  <TallyRow
                    qty={it.qty}
                    completed={it.completed_qty}
                    disabled={order.status === 'delivered' || order.status === 'cancelled'}
                    onChange={n => setCompleted(it.id, n)}
                  />
                </div>
              ))}

              {order.notes && (
                <p className="order-note"><strong>Note:</strong> {order.notes}</p>
              )}

              <div className="order-money">
                <div><span>Total</span><b className="mono">{money(order.total_amount)}</b></div>
                <div><span>Paid</span><b className="mono">{money(order.amount_paid)}</b></div>
                <div className={order.amount_due > 0 ? 'due' : ''}>
                  <span>Balance</span><b className="mono">{money(order.amount_due)}</b>
                </div>
              </div>

              {payOpen ? (
                <div className="inline-form">
                  <input type="number" min="1" value={payAmt} autoFocus
                    onChange={e => setPayAmt(e.target.value)}
                    placeholder={`Amount in ${RUPEE}`} />
                  <button className="btn-primary btn-sm" onClick={addPayment} disabled={busy}>
                    Record
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => setPayOpen(false)}>
                    Cancel
                  </button>
                </div>
              ) : order.amount_due > 0 && order.status !== 'cancelled' ? (
                <button className="btn-ghost btn-sm" onClick={() => setPayOpen(true)}>
                  Record a payment
                </button>
              ) : null}

              {order.delivery_mode === 'courier' && (
                courierOpen ? (
                  <div className="courier-form">
                    <div className="field">
                      <label>Courier</label>
                      <input value={courier.courier_name}
                        onChange={e => setCourier(c => ({ ...c, courier_name: e.target.value }))}
                        placeholder="DTDC, Professional, India Post" />
                    </div>
                    <div className="field">
                      <label>Tracking number</label>
                      <input value={courier.courier_tracking}
                        onChange={e => setCourier(c => ({ ...c, courier_tracking: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>Destination</label>
                      <input value={courier.courier_destination}
                        onChange={e => setCourier(c => ({ ...c, courier_destination: e.target.value }))}
                        placeholder="City or country, e.g. Karur or USA" />
                    </div>
                    <div className="field">
                      <label>Receipt photo link</label>
                      <input type="url" value={courier.courier_receipt_url}
                        onChange={e => setCourier(c => ({ ...c, courier_receipt_url: e.target.value }))}
                        placeholder="Link to the receipt photo" />
                    </div>
                    <button className="btn-primary btn-sm" onClick={saveCourier} disabled={busy}>
                      Save courier details
                    </button>
                  </div>
                ) : (
                  <div className="courier-line">
                    {order.courier_tracking
                      ? <span className="mono dim">
                          {order.courier_name} · {order.courier_tracking}
                          {order.courier_destination ? ` · ${order.courier_destination}` : ''}
                        </span>
                      : <span className="dim">
                          {order.courier_destination || 'Courier order'}
                        </span>}
                    <button className="btn-ghost btn-sm" onClick={() => setCourierOpen(true)}>
                      {order.courier_tracking ? 'Edit' : 'Add courier details'}
                    </button>
                  </div>
                )
              )}

              <div className="order-actions">
                {order.completed_qty > 0 && order.status !== 'delivered' && (
                  <button className="btn-send" onClick={sendMessage}>
                    Message {order.customer_name.split(' ')[0]}
                  </button>
                )}
                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                  <NavLink className="btn-ghost btn-sm" to={`/orders/${order.id}/edit`}>
                    Edit
                  </NavLink>
                )}
                <NavLink className="btn-ghost btn-sm" to={`/orders/${order.id}/receipt`}>
                  Save as PDF
                </NavLink>
                {order.status === 'open' && allDone && (
                  <button className="btn-primary btn-sm" onClick={() => markStatus('ready')} disabled={busy}>
                    Mark ready
                  </button>
                )}
                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                  <button className="btn-ghost btn-sm" onClick={() => markStatus('delivered')} disabled={busy}>
                    Mark delivered
                  </button>
                )}
                {order.status === 'delivered' && (
                  <span className="delivered-tag">Delivered</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  )
}
