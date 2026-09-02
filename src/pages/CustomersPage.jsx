import React, { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('customers').select('*').order('name')
      .then(({ data }) => { setCustomers(data || []); setLoading(false) })
  }, [])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return customers
    return customers.filter(c =>
      c.name.toLowerCase().includes(t) ||
      String(c.phone).includes(t) ||
      String(c.customer_no).includes(t)
    )
  }, [customers, q])

  return (
    <div className="page">
      <h1 className="page-title">Customers</h1>

      <input className="search" value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search name, phone or customer number" />

      {loading && <p className="muted">Loading…</p>}

      {!loading && shown.length === 0 && (
        <div className="empty">
          <h3>No customers yet</h3>
          <p>Customers are added automatically from the New order form.</p>
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
