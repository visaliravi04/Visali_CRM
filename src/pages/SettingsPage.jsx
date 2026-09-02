import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { RUPEE } from '../lib/helpers'

export default function SettingsPage() {
  const [services, setServices] = useState([])
  const [settings, setSettings] = useState(null)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [zones, setZones] = useState([])
  const [newZone, setNewZone] = useState('')
  const [newZoneDays, setNewZoneDays] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    const [s, st, z] = await Promise.all([
      supabase.from('service_types').select('*').order('sort_order'),
      supabase.from('shop_settings').select('*').eq('id', 1).single(),
      supabase.from('courier_zones').select('*').order('sort_order'),
    ])
    setServices(s.data || [])
    setSettings(st.data)
    setZones(z.data || [])
  }
  useEffect(() => { load() }, [])

  function flash(t) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  async function addService(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const { error } = await supabase.from('service_types').insert({
      name: newName.trim(),
      default_price: Number(newPrice || 0),
      sort_order: services.length + 1,
    })
    if (error) return flash(error.message)
    setNewName(''); setNewPrice(''); flash('Service added.'); load()
  }

  async function updatePrice(id, price) {
    await supabase.from('service_types').update({ default_price: Number(price || 0) }).eq('id', id)
  }

  async function toggleService(id, active) {
    await supabase.from('service_types').update({ is_active: active }).eq('id', id)
    load()
  }

  async function addZone(e) {
    e.preventDefault()
    if (!newZone.trim()) return
    const { error } = await supabase.from('courier_zones').insert({
      place_match: newZone.trim().toLowerCase(),
      lead_days: Number(newZoneDays || 0),
      sort_order: zones.length + 1,
    })
    if (error) return flash(error.message)
    setNewZone(''); setNewZoneDays(''); flash('Zone added.'); load()
  }

  async function updateZoneDays(id, days) {
    await supabase.from('courier_zones').update({ lead_days: Number(days || 0) }).eq('id', id)
  }

  async function removeZone(id) {
    await supabase.from('courier_zones').delete().eq('id', id)
    load()
  }

  async function saveSettings(e) {
    e.preventDefault()
    const { id, ...rest } = settings
    const { error } = await supabase.from('shop_settings').update(rest).eq('id', 1)
    flash(error ? error.message : 'Saved.')
  }

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      {msg && <p className="flash">{msg}</p>}

      <section className="card">
        <h2 className="card-label">Services offered</h2>
        <p className="hint">These appear in the dropdown when adding an order. Prices fill in automatically and can be changed per order.</p>
        <ul className="svc-list">
          {services.map(s => (
            <li key={s.id} className={s.is_active ? '' : 'off'}>
              <span className="svc-name">{s.name}</span>
              <input className="svc-price mono" type="number" min="0"
                defaultValue={s.default_price}
                onBlur={e => updatePrice(s.id, e.target.value)} />
              <button className="btn-ghost btn-sm"
                onClick={() => toggleService(s.id, !s.is_active)}>
                {s.is_active ? 'Hide' : 'Show'}
              </button>
            </li>
          ))}
        </ul>
        <form className="inline-form" onSubmit={addService}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="New service name" />
          <input className="w-price" type="number" min="0" value={newPrice}
            onChange={e => setNewPrice(e.target.value)} placeholder={RUPEE} />
          <button className="btn-primary btn-sm">Add</button>
        </form>
      </section>

      <section className="card">
        <h2 className="card-label">Courier zones</h2>
        <p className="hint">
          Used by the Today tab to work out when a courier order must be finished so it still
          reaches the customer on time. A destination is matched against these place names
          (longest match wins) — e.g. "Karur" needs far less lead time than "USA".
        </p>
        <ul className="svc-list">
          {zones.map(z => (
            <li key={z.id}>
              <span className="svc-name">{z.place_match}</span>
              <input className="svc-price mono" type="number" min="0"
                defaultValue={z.lead_days}
                onBlur={e => updateZoneDays(z.id, e.target.value)} />
              <button type="button" className="link-danger" onClick={() => removeZone(z.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form className="inline-form" onSubmit={addZone}>
          <input value={newZone} onChange={e => setNewZone(e.target.value)}
            placeholder="Place name, e.g. Karur" />
          <input className="w-price" type="number" min="0" value={newZoneDays}
            onChange={e => setNewZoneDays(e.target.value)} placeholder="Days" />
          <button className="btn-primary btn-sm">Add</button>
        </form>
      </section>

      {settings && (
        <form className="card" onSubmit={saveSettings}>
          <h2 className="card-label">Shop and messages</h2>
          <p className="hint">
            {'{customer}'}, {'{items}'}, {'{shop}'}, {'{tracking}'} and {'{due}'} are
            filled in automatically. Write these in whatever language your customers read.
          </p>

          <div className="field">
            <label>Shop name</label>
            <input value={settings.shop_name}
              onChange={e => setSettings(s => ({ ...s, shop_name: e.target.value }))} />
          </div>

          <div className="field">
            <label>Country code for WhatsApp</label>
            <input className="w-price mono" value={settings.country_code}
              onChange={e => setSettings(s => ({ ...s, country_code: e.target.value }))} />
          </div>

          <div className="row-2">
            <div className="field">
              <label>Orders to prioritize per day</label>
              <input type="number" min="1" className="mono" value={settings.daily_capacity}
                onChange={e => setSettings(s => ({ ...s, daily_capacity: Number(e.target.value) }))} />
            </div>
            <div className="field">
              <label>Default courier lead time (days)</label>
              <input type="number" min="0" className="mono" value={settings.courier_default_lead_days}
                onChange={e => setSettings(s => ({ ...s, courier_default_lead_days: Number(e.target.value) }))} />
            </div>
          </div>
          <p className="hint">
            The default lead time is used when a courier order has no destination, or one that
            doesn't match any courier zone above.
          </p>

          <div className="field">
            <label>When an order is ready for pickup</label>
            <textarea rows={3} value={settings.msg_ready}
              onChange={e => setSettings(s => ({ ...s, msg_ready: e.target.value }))} />
          </div>

          <div className="field">
            <label>When an order has been couriered</label>
            <textarea rows={3} value={settings.msg_courier}
              onChange={e => setSettings(s => ({ ...s, msg_courier: e.target.value }))} />
          </div>

          <div className="field">
            <label>Reminder before the due date</label>
            <textarea rows={2} value={settings.msg_reminder}
              onChange={e => setSettings(s => ({ ...s, msg_reminder: e.target.value }))} />
          </div>

          <button className="btn-primary">Save settings</button>
        </form>
      )}
    </div>
  )
}
