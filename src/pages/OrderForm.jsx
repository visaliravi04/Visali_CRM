import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, NavLink } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { money, todayISO, RUPEE } from '../lib/helpers'

const BLANK_LINE = () => ({
  key: Math.random().toString(36).slice(2),
  id: null,
  service_type_id: '',
  service_name: '',
  qty: 1,
  unit_price: 0,
  design_ref_url: '',
  item_notes: '',
  completed_qty: 0,
})

/** Shared by NewOrder ("new") and EditOrder ("edit") — same fields, different save path. */
export default function OrderForm({ formMode }) {
  const nav = useNavigate()
  const { id: orderId } = useParams()
  const isEdit = formMode === 'edit'

  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [orderNo, setOrderNo] = useState(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [matches, setMatches] = useState([])
  const [lines, setLines] = useState([BLANK_LINE()])
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [advance, setAdvance] = useState('')
  const [notes, setNotes] = useState('')
  const [mode, setMode] = useState('pickup')
  const [courierDestination, setCourierDestination] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [savedOrder, setSavedOrder] = useState(null)
  const nameRef = useRef(null)

  useEffect(() => {
    supabase.from('service_types').select('*').eq('is_active', true)
      .order('sort_order').then(({ data }) => setServices(data || []))
    if (!isEdit) nameRef.current?.focus()
  }, [isEdit])

  // Edit mode: load the existing order and its items
  useEffect(() => {
    if (!isEdit) return
    let off = false
    Promise.all([
      supabase.from('order_summary').select('*').eq('id', orderId).single(),
      supabase.from('order_items').select('*').eq('order_id', orderId).order('created_at'),
    ]).then(([o, i]) => {
      if (off) return
      const ord = o.data
      if (ord) {
        setOrderNo(ord.order_no)
        setCustomerName(ord.customer_name)
        setCustomerPhone(ord.customer_phone)
        setDueDate(ord.due_date)
        setDueTime(ord.due_time || '')
        setMode(ord.delivery_mode)
        setCourierDestination(ord.courier_destination || '')
        setNotes(ord.notes || '')
      }
      setLines(
        (i.data || []).map(it => ({
          key: it.id,
          id: it.id,
          service_type_id: it.service_type_id || '',
          service_name: it.service_name,
          qty: it.qty,
          unit_price: it.unit_price,
          design_ref_url: it.design_ref_url || '',
          item_notes: it.item_notes || '',
          completed_qty: it.completed_qty,
        }))
      )
      setLoading(false)
    })
    return () => { off = true }
  }, [isEdit, orderId])

  // New mode: look up existing customers as they type a name
  useEffect(() => {
    if (isEdit || name.trim().length < 2) { setMatches([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      const { data } = await supabase.from('customers')
        .select('id,name,phone').ilike('name', `%${name.trim()}%`).limit(5)
      if (!cancelled) setMatches(data || [])
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [isEdit, name])

  const total = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_price || 0), 0)
  const balance = total - Number(advance || 0)

  function setLine(key, patch) {
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)))
  }

  function pickService(key, id) {
    const s = services.find(x => x.id === id)
    setLine(key, {
      service_type_id: id,
      service_name: s?.name || '',
      unit_price: s?.default_price ?? 0,
    })
  }

  async function save(e) {
    e.preventDefault()
    setErr('')

    const clean = lines.filter(l => l.service_name && Number(l.qty) > 0)
    if (!isEdit) {
      if (!name.trim()) return setErr('Add the customer name.')
      if (!phone.replace(/\D/g, '')) return setErr('Add a phone number so you can message them.')
    }
    if (clean.length === 0) return setErr('Add at least one item to the order.')
    if (!dueDate) return setErr('Set the delivery date.')
    for (const l of clean) {
      if (Number(l.qty) < Number(l.completed_qty || 0)) {
        return setErr(`"${l.service_name}" already has ${l.completed_qty} finished — count can't go below that.`)
      }
    }

    setSaving(true)
    try {
      if (isEdit) {
        for (const l of clean) {
          const payload = {
            service_type_id: l.service_type_id || null,
            service_name: l.service_name,
            qty: Number(l.qty),
            unit_price: Number(l.unit_price || 0),
            design_ref_url: l.design_ref_url.trim() || null,
            item_notes: l.item_notes.trim() || null,
          }
          const { error } = l.id
            ? await supabase.from('order_items').update(payload).eq('id', l.id)
            : await supabase.from('order_items').insert({ ...payload, order_id: orderId })
          if (error) throw error
        }
        const keptIds = new Set(clean.filter(l => l.id).map(l => l.id))
        const removedIds = lines.filter(l => l.id && !keptIds.has(l.id)).map(l => l.id)
        if (removedIds.length) {
          const { error } = await supabase.from('order_items').delete().in('id', removedIds)
          if (error) throw error
        }

        const { error: oErr } = await supabase.from('orders').update({
          due_date: dueDate,
          due_time: dueTime || null,
          delivery_mode: mode,
          courier_destination: mode === 'courier' ? (courierDestination.trim() || null) : null,
          total_amount: total,
          notes: notes.trim() || null,
        }).eq('id', orderId)
        if (oErr) throw oErr

        nav('/orders')
        return
      }

      // Reuse the customer if this phone is already on file
      const digits = phone.replace(/\D/g, '')
      let { data: cust } = await supabase.from('customers')
        .select('id').eq('phone', digits).maybeSingle()

      if (!cust) {
        const { data, error } = await supabase.from('customers')
          .insert({ name: name.trim(), phone: digits }).select('id').single()
        if (error) throw error
        cust = data
      }

      const { data: order, error: oErr } = await supabase.from('orders').insert({
        customer_id: cust.id,
        order_date: todayISO(),
        due_date: dueDate,
        due_time: dueTime || null,
        delivery_mode: mode,
        courier_destination: mode === 'courier' ? (courierDestination.trim() || null) : null,
        total_amount: total,
        notes: notes.trim() || null,
      }).select('id, order_no').single()
      if (oErr) throw oErr

      const { error: iErr } = await supabase.from('order_items').insert(
        clean.map(l => ({
          order_id: order.id,
          service_type_id: l.service_type_id || null,
          service_name: l.service_name,
          qty: Number(l.qty),
          unit_price: Number(l.unit_price || 0),
          design_ref_url: l.design_ref_url.trim() || null,
          item_notes: l.item_notes.trim() || null,
        }))
      )
      if (iErr) throw iErr

      if (Number(advance) > 0) {
        await supabase.from('payments').insert({
          order_id: order.id, amount: Number(advance), note: 'Advance',
        })
      }

      setSavedOrder(order)
    } catch (e2) {
      setErr(e2.message || 'Could not save the order.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>

  if (savedOrder) {
    return (
      <div className="page">
        <h1 className="page-title">Order saved</h1>
        <div className="empty">
          <h3>Order #{savedOrder.order_no} saved</h3>
          <p>Download a copy for the customer, or head back to Orders.</p>
        </div>
        <div className="order-actions">
          <NavLink className="btn-primary btn-sm" to={`/orders/${savedOrder.id}/receipt`}>
            Save as PDF
          </NavLink>
          <button type="button" className="btn-ghost btn-sm" onClick={() => nav('/orders')}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="page-form" onSubmit={save}>
      <h1 className="page-title">{isEdit ? `Edit order #${orderNo}` : 'New order'}</h1>

      <section className="card">
        <h2 className="card-label">Customer</h2>
        {isEdit ? (
          <p className="hint">
            {customerName} · <span className="mono">{customerPhone}</span>
          </p>
        ) : (
          <>
            <div className="field">
              <label htmlFor="cname">Name</label>
              <input id="cname" ref={nameRef} value={name} autoComplete="off"
                onChange={e => setName(e.target.value)} placeholder="Customer name" />
              {matches.length > 0 && (
                <ul className="suggests">
                  {matches.map(m => (
                    <li key={m.id}>
                      <button type="button" onClick={() => {
                        setName(m.name); setPhone(m.phone); setMatches([])
                      }}>
                        {m.name} <span className="mono">{m.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="field">
              <label htmlFor="cphone">Phone</label>
              <input id="cphone" value={phone} inputMode="numeric" autoComplete="off"
                onChange={e => setPhone(e.target.value)} placeholder="10 digit number" />
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2 className="card-label">Items</h2>
        {lines.map((l, idx) => (
          <div className="line" key={l.key}>
            <div className="line-head">
              <span className="line-no mono">{String(idx + 1).padStart(2, '0')}</span>
              {lines.length > 1 && (
                <button type="button" className="link-danger"
                  onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))}>
                  Remove
                </button>
              )}
            </div>

            <div className="field">
              <label>Service</label>
              <select value={l.service_type_id}
                onChange={e => pickService(l.key, e.target.value)}>
                <option value="">Choose…</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="row-2">
              <div className="field">
                <label>Count{l.completed_qty > 0 ? ` (${l.completed_qty} finished)` : ''}</label>
                <input type="number" min={l.completed_qty || 1} value={l.qty}
                  onChange={e => setLine(l.key, { qty: e.target.value })} />
              </div>
              <div className="field">
                <label>Price each ({RUPEE})</label>
                <input type="number" min="0" step="1" value={l.unit_price}
                  onChange={e => setLine(l.key, { unit_price: e.target.value })} />
              </div>
            </div>

            <div className="field">
              <label>Design reference link</label>
              <input type="url" value={l.design_ref_url} placeholder="Pinterest or photo link"
                onChange={e => setLine(l.key, { design_ref_url: e.target.value })} />
            </div>

            <div className="field">
              <label>Note for this item</label>
              <input value={l.item_notes} placeholder="Sleeve length, neck design, measurements"
                onChange={e => setLine(l.key, { item_notes: e.target.value })} />
            </div>

            <div className="line-total mono">
              {money(Number(l.qty || 0) * Number(l.unit_price || 0))}
            </div>
          </div>
        ))}

        <button type="button" className="btn-ghost"
          onClick={() => setLines(ls => [...ls, BLANK_LINE()])}>
          Add another item
        </button>
      </section>

      <section className="card">
        <h2 className="card-label">Delivery</h2>
        <div className="row-2">
          <div className="field">
            <label htmlFor="dd">Date</label>
            <input id="dd" type="date" value={dueDate} min={isEdit ? undefined : todayISO()}
              onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="dt">Time</label>
            <input id="dt" type="time" value={dueTime}
              onChange={e => setDueTime(e.target.value)} />
          </div>
        </div>
        <div className="seg">
          <button type="button" className={mode === 'pickup' ? 'on' : ''}
            onClick={() => setMode('pickup')}>Pickup</button>
          <button type="button" className={mode === 'courier' ? 'on' : ''}
            onClick={() => setMode('courier')}>Courier</button>
        </div>
        {mode === 'courier' && (
          <div className="field">
            <label htmlFor="cdest">Destination</label>
            <input id="cdest" value={courierDestination}
              onChange={e => setCourierDestination(e.target.value)}
              placeholder="City or country, e.g. Karur or USA" />
          </div>
        )}
      </section>

      {!isEdit && (
        <section className="card">
          <h2 className="card-label">Money</h2>
          <div className="totals">
            <div><span>Total</span><strong className="mono">{money(total)}</strong></div>
          </div>
          <div className="field">
            <label htmlFor="adv">Advance paid now</label>
            <input id="adv" type="number" min="0" value={advance}
              onChange={e => setAdvance(e.target.value)} placeholder="0" />
          </div>
          <div className="totals">
            <div className={balance > 0 ? 'due' : ''}>
              <span>Balance</span><strong className="mono">{money(balance)}</strong>
            </div>
          </div>
        </section>
      )}

      {isEdit && (
        <section className="card">
          <h2 className="card-label">Money</h2>
          <div className="totals">
            <div><span>Total</span><strong className="mono">{money(total)}</strong></div>
          </div>
          <p className="hint">Payments are recorded from the order card, not here.</p>
        </section>
      )}

      <section className="card">
        <h2 className="card-label">Order note</h2>
        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Anything to remember about this order" />
      </section>

      {err && <p className="err">{err}</p>}

      <button className="btn-primary btn-wide" disabled={saving}>
        {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save order'}
      </button>
    </form>
  )
}
