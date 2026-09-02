// Small shared helpers. Dates are plain YYYY-MM-DD strings throughout,
// so nothing shifts when the phone changes timezone.

export const RUPEE = '\u20B9'

export function money(n) {
  const v = Number(n || 0)
  return RUPEE + v.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function todayISO() {
  const d = new Date()
  return toISO(d)
}

export function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysBetween(aISO, bISO) {
  return Math.round((fromISO(bISO) - fromISO(aISO)) / 86400000)
}

/** "Fri 19 Sep" */
export function shortDate(iso) {
  if (!iso) return ''
  return fromISO(iso).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

/** "19 September 2026" */
export function longDate(iso) {
  if (!iso) return ''
  return fromISO(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

/** "2:30 pm" from "14:30" or "14:30:00" */
export function niceTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`
}

/** Today, overdue, or upcoming. Drives colour everywhere. */
export function dueState(dueISO, status) {
  if (status === 'delivered' || status === 'cancelled') return 'done'
  const diff = daysBetween(todayISO(), dueISO)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 2) return 'soon'
  return 'later'
}

export function dueLabel(dueISO, status) {
  if (status === 'delivered') return 'Delivered'
  if (status === 'cancelled') return 'Cancelled'
  const diff = daysBetween(todayISO(), dueISO)
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} overdue`
  return `In ${diff} days`
}

/** Strip everything that is not a digit, then prefix the country code. */
export function waNumber(phone, countryCode = '91') {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length > 10 && digits.startsWith(countryCode)) return digits
  return countryCode + digits.slice(-10)
}

/**
 * Build a wa.me link. This does not send anything — it opens WhatsApp
 * with the message already typed, and a person taps send.
 */
export function waLink(phone, text, countryCode = '91') {
  const n = waNumber(phone, countryCode)
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}

/** Fill {customer} {items} {shop} {tracking} {due} in a template. */
export function fillTemplate(tpl, vars) {
  return Object.entries(vars).reduce(
    (out, [k, v]) => out.replaceAll(`{${k}}`, v ?? ''),
    tpl || ''
  )
}

/** "5 blouse stitching, 2 kurti" */
export function itemsSentence(items, onlyReady = false) {
  const parts = (items || [])
    .map(i => {
      const n = onlyReady ? i.completed_qty : i.qty
      return n > 0 ? `${n} ${i.service_name.toLowerCase()}` : null
    })
    .filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0] + '.'
  return parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1) + '.'
}

export function startOfWeek(d = new Date()) {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7 // Monday = 0
  x.setDate(x.getDate() - day)
  return toISO(x)
}

export function endOfWeek(d = new Date()) {
  const s = fromISO(startOfWeek(d))
  s.setDate(s.getDate() + 6)
  return toISO(s)
}

export function monthRange(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  const last = new Date(year, monthIndex + 1, 0)
  return [toISO(first), toISO(last)]
}

/**
 * Billed/collected/outstanding for a date range, from order_summary rows.
 * `rows` should already be scoped to the range (order_date OR due_date
 * within [from, to]) — see SummaryPage's query.
 */
export function revenueTotals(rows, from, to) {
  const taken = rows.filter(r => r.order_date >= from && r.order_date <= to)
  const billed = taken.reduce((s, r) => s + Number(r.total_amount), 0)
  const collected = rows.reduce((s, r) => s + Number(r.amount_paid), 0)
  const outstanding = rows
    .filter(r => r.status !== 'cancelled')
    .reduce((s, r) => s + Number(r.amount_due), 0)
  return { taken, billed, collected, outstanding }
}
