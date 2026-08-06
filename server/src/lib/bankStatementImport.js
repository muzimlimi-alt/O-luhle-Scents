import { parse } from 'csv-parse/sync'
import { DateTime } from 'luxon'

// Row/column tokenizing only — no assumptions about which column means what.
// Real bank CSV exports (FNB, Standard Bank, Nedbank, Absa, Capitec, ...)
// all lay out columns differently, so the admin maps them explicitly in the
// UI rather than this guessing a layout.
export function parseCsv(buffer) {
  const records = parse(buffer, { skip_empty_lines: true, relax_column_count: true })
  if (!records.length) return { headers: [], rows: [] }
  const [headers, ...rows] = records
  return { headers, rows }
}

// Handles common bank-export quirks: currency symbol, thousands separators
// (comma or space), parentheses-as-negative. A heuristic, not exhaustive —
// callers surface unparseable rows rather than silently dropping them, so
// an admin can spot anything this misses.
export function parseAmount(raw) {
  if (raw == null) return null
  let s = String(raw).trim()
  if (!s) return null

  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  }

  s = s.replace(/[R$\s]/g, '')

  // Comma is ambiguous (thousands sep vs. decimal sep depending on locale).
  // If both separators appear, the last one is the decimal point. If only
  // a comma appears, treat it as a decimal point only when exactly 2 digits
  // follow it (matches the common SA "1234,56" export style); otherwise
  // treat it as a thousands separator.
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (hasComma) {
    s = /,\d{2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '')
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

const DATE_FORMATS = {
  'dd/MM/yyyy': 'dd/MM/yyyy',
  'yyyy-MM-dd': 'yyyy-MM-dd',
  'MM/dd/yyyy': 'MM/dd/yyyy',
}

export function parseDate(raw, format = 'dd/MM/yyyy') {
  if (!raw) return null
  const pattern = DATE_FORMATS[format] || DATE_FORMATS['dd/MM/yyyy']
  // Pinned to UTC so "25/12/2025" always becomes the same instant regardless
  // of the server process's local timezone — otherwise a server running in
  // UTC vs. SAST would parse the same statement line to different calendar
  // days once the resulting Date is displayed or compared elsewhere.
  const dt = DateTime.fromFormat(String(raw).trim(), pattern, { zone: 'utc' })
  return dt.isValid ? dt.toJSDate() : null
}

// Applies the admin's column mapping to raw parsed rows, producing
// { date, description, amount, reference } rows ready for
// bankingService.importBankTransactions. Rows that fail to parse are
// collected separately rather than aborting the whole import — a single
// malformed line (e.g. a trailing "Balance brought forward" summary row)
// shouldn't block the rest of a real statement.
export function mapRows(rows, mapping) {
  const {
    dateColumn, descriptionColumn, referenceColumn,
    amountMode, amountColumn, debitColumn, creditColumn,
    dateFormat,
  } = mapping

  const mapped = []
  const invalid = []

  for (const row of rows) {
    const date = parseDate(row[dateColumn], dateFormat)
    const description = (row[descriptionColumn] || '').trim()

    let amount = null
    if (amountMode === 'separate') {
      const debit = parseAmount(row[debitColumn])
      const credit = parseAmount(row[creditColumn])
      if (credit) amount = Math.abs(credit)
      else if (debit) amount = -Math.abs(debit)
    } else {
      amount = parseAmount(row[amountColumn])
    }

    const reference = referenceColumn != null && referenceColumn !== '' ? (row[referenceColumn] || '').trim() || null : null

    if (!date || !description || amount == null || amount === 0) {
      invalid.push(row)
      continue
    }

    mapped.push({ date, description, amount, reference })
  }

  return { rows: mapped, invalid }
}
