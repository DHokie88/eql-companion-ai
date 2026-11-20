// The Bazaar's retained quotes as CSV, newest first. The ledger keeps at most 20 quotes per
// day, item, tier and direction, with a trader's newer quote replacing the equivalent older one.

import { newestFirst, type BazaarItem, type DayQuote } from './bazaar'

/** Retained quotes for these items, newest first. */
export function offersOf(items: readonly BazaarItem[]): DayQuote[] {
  return items.flatMap((x) => x.quotes).sort(newestFirst)
}

const BOM = String.fromCharCode(0xfeff)
const HEADER = ['Date', 'Time', 'Who', 'Direction', 'Item', 'Tier', 'Price (plat)', 'Message']
const DIR = { sell: 'WTS', buy: 'WTB', trade: 'WTT' } as const

/** One field, quoted when it holds a comma, a quote or a line break; a leading = + - @, tab or CR is defused. */
function field(v: string | number | null): string {
  const s = v === null ? '' : String(v)
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** The CSV text, with a byte-order mark so Excel reads it as UTF-8. */
export function offersCsv(quotes: readonly DayQuote[]): string {
  const lines = quotes.map((q) => [q.day, q.at, q.who, DIR[q.dir], q.item, q.tier, q.price, q.msg].map(field).join(','))
  return `${BOM}${[HEADER.join(','), ...lines].join('\r\n')}\r\n`
}
