// Deterministic priority engine for the "Today" tab. No LLM involved —
// just working backwards from due_date (and, for courier orders, transit
// time) to the date an order actually needs to be finished by.

import { fromISO, toISO, daysBetween, todayISO, shortDate } from './helpers'

/** Longest matching keyword wins, so "united states" beats "international". */
export function leadDaysFor(destination, zones) {
  const d = String(destination || '').trim().toLowerCase()
  if (!d) return null
  let best = null
  for (const z of zones) {
    const m = String(z.place_match || '').toLowerCase()
    if (m && d.includes(m) && (!best || m.length > best.place_match.length)) best = z
  }
  return best ? best.lead_days : null
}

/** The date stitching must be finished by, given the courier's transit time. */
export function workDeadline(order, zones, defaultLeadDays) {
  const leadDays = order.delivery_mode === 'courier'
    ? leadDaysFor(order.courier_destination, zones) ?? defaultLeadDays
    : 0
  const d = fromISO(order.due_date)
  d.setDate(d.getDate() - leadDays)
  return { deadline: toISO(d), leadDays }
}

function scoreOrder(order, zones, defaultLeadDays, today) {
  const { deadline, leadDays } = workDeadline(order, zones, defaultLeadDays)
  return { ...order, workDeadline: deadline, leadDays, urgencyDays: daysBetween(today, deadline) }
}

const byUrgency = (a, b) =>
  a.urgencyDays - b.urgencyDays ||
  (a.due_time || '99:99').localeCompare(b.due_time || '99:99') ||
  a.order_date.localeCompare(b.order_date)

/**
 * Orders that still have unfinished pieces, ranked by how soon they need
 * to be *finished* (not just delivered), split into today's capacity and
 * whatever is queued after that.
 */
export function buildQueue(orders, zones, settings) {
  const today = todayISO()
  const defaultLeadDays = settings?.courier_default_lead_days ?? 4
  const capacity = settings?.daily_capacity ?? 8

  const scored = orders
    .filter(o => o.status === 'open' && Number(o.completed_qty) < Number(o.total_qty))
    .map(o => scoreOrder(o, zones, defaultLeadDays, today))
    .sort(byUrgency)

  return { today: scored.slice(0, capacity), upNext: scored.slice(capacity) }
}

/** Finished courier orders that must go out today (or are already late) to arrive on time. */
export function shipToday(orders, zones, settings) {
  const today = todayISO()
  const defaultLeadDays = settings?.courier_default_lead_days ?? 4

  return orders
    .filter(o => o.status === 'ready' && o.delivery_mode === 'courier')
    .map(o => scoreOrder(o, zones, defaultLeadDays, today))
    .filter(o => o.workDeadline <= today)
    .sort((a, b) => a.workDeadline.localeCompare(b.workDeadline))
}

/** Short human-readable explanation for why an order is ranked where it is. */
export function reasonFor(o) {
  const parts = []
  if (o.delivery_mode === 'courier') {
    parts.push(o.courier_destination ? `Courier → ${o.courier_destination}` : 'Courier')
    parts.push(`ship by ${shortDate(o.workDeadline)}`)
  } else {
    parts.push('Pickup')
  }
  if (o.urgencyDays < 0) parts.push(`${Math.abs(o.urgencyDays)}d overdue to finish`)
  else if (o.urgencyDays === 0) parts.push('finish today')
  else parts.push(`finish in ${o.urgencyDays}d`)
  return parts.join(' · ')
}
