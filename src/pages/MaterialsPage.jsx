import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import {
  money, todayISO, startOfWeek, endOfWeek, monthRange, shortDate, longDate, RUPEE,
} from '../lib/helpers'

const BLANK_FORM = () => ({
  purchase_date: todayISO(), item: '', quantity: '', unit: '', cost: '', supplier: '', notes: '',
})

export default function MaterialsPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('week')
  const [form, setForm] = useState(BLANK_FORM())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('material_costs').select('*')
      .order('purchase_date', { ascending: false }).limit(300)
    setEntries(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const [from, to] = useMemo(() => {
    if (range === 'week') return [startOfWeek(), endOfWeek()]
    const d = new Date()
    return monthRange(d.getFullYear(), d.getMonth())
  }, [range])

  const shown = useMemo(
    () => entries.filter(e => e.purchase_date >= from && e.purchase_date <= to),
    [entries, from, to]
  )
  const total = shown.reduce((s, e) => s + Number(e.cost || 0), 0)

  async function addEntry(e) {
    e.preventDefault()
    setErr('')
    if (!form.item.trim()) return setErr('Add what was bought.')
    if (!form.purchase_date) return setErr('Set the date.')

    setSaving(true)
    const { error } = await supabase.from('material_costs').insert({
      purchase_date: form.purchase_date,
      item: form.item.trim(),
      quantity: form.quantity ? Number(form.quantity) : null,
      unit: form.unit.trim() || null,
      cost: Number(form.cost || 0),
      supplier: form.supplier.trim() || null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    if (error) return setErr(error.message)
    setForm(BLANK_FORM())
    load()
  }

  async function removeEntry(id) {
    await supabase.from('material_costs').delete().eq('id', id)
    load()
  }

  return (
    <div className="page">
      <h1 className="page-title">Materials</h1>

      <form className="card" onSubmit={addEntry}>
        <h2 className="card-label">Log a purchase</h2>
        <div className="row-2">
          <div className="field">
            <label htmlFor="mdate">Date</label>
            <input id="mdate" type="date" value={form.purchase_date}
              onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="mcost">Cost ({RUPEE})</label>
            <input id="mcost" type="number" min="0" value={form.cost}
              onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="mitem">Item</label>
          <input id="mitem" value={form.item} placeholder="Fabric, thread, lining…"
            onChange={e => setForm(f => ({ ...f, item: e.target.value }))} />
        </div>
        <div className="row-2">
          <div className="field">
            <label htmlFor="mqty">Quantity</label>
            <input id="mqty" type="number" min="0" step="0.01" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="munit">Unit</label>
            <input id="munit" value={form.unit} placeholder="metres, pieces…"
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="msupplier">Supplier</label>
          <input id="msupplier" value={form.supplier}
            onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
        </div>
        <div className="field">
          <label htmlFor="mnotes">Note</label>
          <input id="mnotes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        {err && <p className="err">{err}</p>}
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add entry'}</button>
      </form>

      <div className="seg seg-wide">
        <button type="button" className={range === 'week' ? 'on' : ''} onClick={() => setRange('week')}>
          This week
        </button>
        <button type="button" className={range === 'month' ? 'on' : ''} onClick={() => setRange('month')}>
          This month
        </button>
      </div>
      <p className="range-line">{longDate(from)} &ndash; {longDate(to)}</p>

      <div className="money-grid">
        <div><span>Spent</span><b className="mono">{money(total)}</b></div>
        <div><span>Entries</span><b className="mono">{shown.length}</b></div>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {!loading && shown.length === 0 && <p className="muted">Nothing logged in this period.</p>}

      {!loading && shown.length > 0 && (
        <ul className="sum-list">
          {shown.map(e => (
            <li key={e.id}>
              <span className="sum-name">{e.item}{e.supplier ? ` · ${e.supplier}` : ''}</span>
              <span className="mono dim">{shortDate(e.purchase_date)}</span>
              <span className="mono">{money(e.cost)}</span>
              <button type="button" className="link-danger" onClick={() => removeEntry(e.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
