// SARS Compliance Phase E — Export Centre. One shared utility, added as a
// `?format=csv|xlsx` option on top of reports that already exist as JSON —
// not a rebuild of the reports themselves. `columns` is [{ key, label }];
// `rows` is the same array the JSON response already returns, so a report
// route's export path is always "reshape the existing data, don't requery."
import ExcelJS from 'exceljs'

function cell(row, col) {
  const value = typeof col.value === 'function' ? col.value(row) : row[col.key]
  if (value === null || value === undefined) return ''
  // The on-screen tables round every currency figure for display (fmt() in
  // each page); a raw export skips that formatting step, so JS float noise
  // like `debit - credit` landing on -798.1500000000001 would otherwise go
  // straight into the file. Round every plain number the same way.
  if (typeof value === 'number') return Math.round((value + Number.EPSILON) * 100) / 100
  return value
}

// RFC 4180 quoting — wrap in quotes and escape embedded quotes whenever a
// field contains a comma, quote, or newline; leave everything else bare.
function csvField(value) {
  const str = String(value)
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function toCsv(columns, rows) {
  const header = columns.map(c => csvField(c.label)).join(',')
  const lines = rows.map(row => columns.map(c => csvField(cell(row, c))).join(','))
  return [header, ...lines].join('\r\n')
}

export async function toXlsxBuffer(columns, rows, sheetName = 'Sheet1') {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31)) // Excel's own sheet-name length limit
  sheet.columns = columns.map(c => ({ header: c.label, key: c.key, width: Math.max(c.label.length + 2, 14) }))
  sheet.getRow(1).font = { bold: true }
  for (const row of rows) {
    sheet.addRow(Object.fromEntries(columns.map(c => [c.key, cell(row, c)])))
  }
  return workbook.xlsx.writeBuffer()
}

// Called from a route after it already has `rows` (and, for JSON, would
// have just done `res.json(...)`) — if the caller asked for an export
// format, send the file instead; otherwise the route falls through to its
// normal res.json(). Keeps every report's query/shaping logic in exactly
// one place regardless of which format comes out.
export async function sendExport(res, format, filename, columns, rows) {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
    // BOM so Excel (which the brief specifically asks these to be usable
    // in) doesn't mis-render the Rand sign or any non-ASCII text as mojibake.
    res.send('﻿' + toCsv(columns, rows))
    return true
  }
  if (format === 'xlsx') {
    const buffer = await toXlsxBuffer(columns, rows, filename)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`)
    res.send(Buffer.from(buffer))
    return true
  }
  return false
}
