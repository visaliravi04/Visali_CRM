import React, { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function load() {
    return supabase.from('customers').select('*').order('name')
      .then(({ data }) => { setCustomers(data || []); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return customers
    return customers.filter(c =>
      c.name.toLowerCase().includes(t) ||
      String(c.phone).includes(t) ||
      String(c.customer_no).includes(t)
    )
  }, [customers, q])

  async function addCustomer(e) {
    e.preventDefault()
    setErr('')
    if (!newName.trim()) return setErr('Add the customer name.')
    const digits = newPhone.replace(/\D/g, '')
    if (!digits) return setErr('Add a phone number.')

    setSaving(true)
    const { data: existing } = await supabase.from('customers')
      .select('id,name').eq('phone', digits).maybeSingle()
    if (existing) {
      setSaving(false)
      return setErr(`${existing.name} already has this phone number.`)
    }

    const { error } = await supabase.from('customers').insert({ name: newName.trim(), phone: digits })
    setSaving(false)
    if (error) return setErr(error.message)
    setNewName(''); setNewPhone('')
    load()
  }

  return (
    <div className="page">
      <h1 className="page-title">Customers</h1>

      <form className="card" onSubmit={addCustomer}>
        <h2 className="card-label">Add customer</h2>
        <div className="row-2">
          <div className="field">
            <label htmlFor="ncname">Name</label>
            <input id="ncname" value={newName} autoComplete="off"
              onChange={e => setNewName(e.target.value)} placeholder="Customer name" />
          </div>
          <div className="field">
            <label htmlFor="ncphone">Phone</label>
            <input id="ncphone" value={newPhone} inputMode="numeric" autoComplete="off"
              onChange={e => setNewPhone(e.target.value)} placeholder="10 digit number" />
          </div>
        </div>
        {err && <p className="err">{err}</p>}
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add customer'}</button>
      </form>

      <input className="search" value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search name, phone or customer number" />

      {loading && <p className="muted">Loading…</p>}

      {!loading && shown.length === 0 && (
        <div className="empty">
          <h3>No customers yet</h3>
          <p>Add one above, or start a New order — that adds the customer too.</p>
        </div>
      )}

      {!loading && shown.length > 0 && (
        <ul className="cust-list">
          {shown.map(c => (
            <li key={c.id}>
              <NavLink to={`/customers/${c.id}`} className="cust-row">
                <span className="cust-no mono">#{c.customer_no}</span>
                <span className="cust-name">{c.name}</span>
                <span className="mono dim">{c.phone}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
