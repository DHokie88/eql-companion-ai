import type { LoadoutCapture } from './loadouts'
import { isClassAbbr } from './classCombo'
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function text(value: unknown): value is string { return typeof value === 'string' && value.length <= 4096 }
function strings(value: unknown): boolean { return Array.isArray(value) && value.length <= 256 && value.every(text) }
function finite(value: unknown): boolean { return typeof value === 'number' && Number.isFinite(value) }
function optionalFields(value: Record<string, unknown>, keys: string[], check: (v: unknown) => boolean): boolean {
  return keys.every((key) => value[key] === undefined || check(value[key]))
}
function pairs(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 256 && value.every((v: unknown) => object(v) && text(v.key) && text(v.value))
}
function effects(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 256 && value.every((v: unknown) => object(v) && ['combat','focus','click','worn','proc','effect'].includes(String(v.kind)) && text(v.name) && optionalFields(v,['detail'],text) && optionalFields(v,['reqLevel'],finite))
}
function sockets(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 256 && value.every((v: unknown) => object(v) && text(v.type) && optionalFields(v,['content'],text) && optionalFields(v,['empty'],(b) => typeof b === 'boolean'))
}
function block(value: unknown): boolean {
  if (!object(value) || !strings(value.flags) || !pairs(value.stats) || !pairs(value.saves)) return false
  if (!effects(value.effects) || !sockets(value.exaltationSlots) || !strings(value.extras)) return false
  return optionalFields(value,['classes','races'],strings) && optionalFields(value,['slot','skill','weight','size','range'],text) && optionalFields(value,['atkDelay','dmg','dmgBonus','backstab','ac'],finite)
}
function itemExtras(value: Record<string, unknown>): boolean {
  return optionalFields(value,['block'],block) && optionalFields(value,['ornament','skill','model','ornamentModel'],text) && optionalFields(value,['tier','ornamentId','ornamentIconId','material','color','ornamentMaterial','ornamentColor'],finite)
}
function item(value: unknown): boolean {
  if (value === null) return true
  if (!object(value) || !text(value.name) || !text(value.baseName)) return false
  return finite(value.itemId) && strings(value.exaltations) && typeof value.known === 'boolean' && itemExtras(value)
}
function cells(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 64 && value.every((v: unknown) => object(v) && text(v.id) && text(v.label) && text(v.location) && ['left','right','bottom'].includes(String(v.column)) && item(v.item))
}
function stats(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 256 && value.every((v: unknown) => object(v) && text(v.label) && finite(v.total) && finite(v.from))
}
function unsummed(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 256 && value.every((v: unknown) => object(v) && text(v.label) && strings(v.values))
}
function totals(value: unknown): boolean {
  if (!object(value)) return false
  return finite(value.ac) && stats(value.stats) && stats(value.saves) && unsummed(value.unsummed) && finite(value.counted) && finite(value.unknown)
}
function inventory(value: unknown): boolean {
  if (!object(value) || !text(value.path) || !text(value.loadedAt)) return false
  return Array.isArray(value.hosts) && value.hosts.length <= 64 && value.hosts.every((v: unknown) => object(v) && text(v.slot) && text(v.name) && text(v.key))
}
function header(value: Record<string, unknown>): boolean {
  return text(value.capturedAt) && Number.isFinite(Date.parse(value.capturedAt)) && Array.isArray(value.classes) && value.classes.length <= 3 && value.classes.every(isClassAbbr)
}
function body(value: unknown): boolean {
  if (!object(value) || !text(value.path) || !text(value.loadedAt)) return false
  return cells(value.cells) && cells(value.unplaced) && totals(value.totals)
}
export function validLoadoutCapture(value: unknown): value is LoadoutCapture {
  if (!object(value) || !header(value)) return false
  if (!body(value.sheet) || !inventory(value.inventory)) return false
  try { return JSON.stringify(value).length <= 524288 } catch { return false }
}
