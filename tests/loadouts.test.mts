import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyLoadoutBook, normalizeLoadoutBook, applyLoadoutChange, matchingLoadout, type LoadoutCapture } from '../src/shared/loadouts'
const capture: LoadoutCapture = { capturedAt: '2026-11-01T12:00:00Z', classes: ['PAL','NEC','SHM'],
  sheet: { path: '/inventory.txt', loadedAt: '2026-11-01T12:00:00Z', cells: [], unplaced: [], totals: { ac: 0, stats: [], saves: [], unsummed: [], counted: 0, unknown: 0 } },
  inventory: { path: '/inventory.txt', loadedAt: '2026-11-01T12:00:00Z', hosts: [] } }
test('five independent slots and strategy documents start without invented equipment', () => {
  const a = emptyLoadoutBook(), b = emptyLoadoutBook()
  assert.equal(a.loadouts.length, 5); assert.equal(a.strategies.length, 5)
  a.loadouts[0].classes.push('PAL')
  assert.deepEqual(a.loadouts[1].classes, []); assert.deepEqual(b.loadouts[0].classes, [])
  assert.ok(a.loadouts.every((lo) => lo.capture === undefined))
})
test('manual class order survives; automatic matching requires one exact full set', () => {
  let book = applyLoadoutChange(emptyLoadoutBook(), {kind:'edit', id:'lo2', classes:['PAL','NEC','SHM']})
  assert.deepEqual(book.loadouts[1].classes,['PAL','NEC','SHM'])
  assert.equal(matchingLoadout(book,['SHM','PAL','NEC'])?.id,'lo2')
  assert.equal(matchingLoadout(book,['PAL']),null)
  assert.equal(matchingLoadout(book,[]),null)
  book = applyLoadoutChange(book,{kind:'edit',id:'lo3',classes:['SHM','NEC','PAL']})
  assert.equal(matchingLoadout(book,['SHM','PAL','NEC']),null)
})
test('planning and metadata edits cannot replace saved actual equipment or its capture classes', () => {
  const book = emptyLoadoutBook();book.loadouts[0].capture=capture
  const before=JSON.stringify(book)
  const planned=applyLoadoutChange(book,{kind:'plan',id:'lo1',plan:{HEAD:{key:'test helm',tier:2}}})
  const edited=applyLoadoutChange(planned,{kind:'edit',id:'lo1',classes:['WAR'],capture:{forged:true},plan:{},wishKeys:['forged']})
  assert.equal(edited.loadouts[0].capture,capture)
  assert.deepEqual(edited.loadouts[0].capture?.classes,['PAL','NEC','SHM'])
  assert.equal(edited.loadouts[0].plan.HEAD?.tier,2)
  assert.equal(edited.loadouts[1].plan.HEAD,undefined)
  assert.equal(JSON.stringify(book),before)
})
test('wishlist references may span loadouts without duplicating the acquisition document', () => {
  let book=applyLoadoutChange(emptyLoadoutBook(),{kind:'wish',id:'lo1',wishKeys:['cloak','cloak']})
  book=applyLoadoutChange(book,{kind:'wish',id:'lo2',wishKeys:['cloak']})
  assert.deepEqual(book.loadouts[0].wishKeys,['cloak']);assert.deepEqual(book.loadouts[1].wishKeys,['cloak'])
})
test('corrupt optional captures are dropped, valid snapshots survive a JSON round trip', () => {
  const book=emptyLoadoutBook();book.loadouts[0].capture=capture
  assert.deepEqual(normalizeLoadoutBook(JSON.parse(JSON.stringify(book))).loadouts[0].capture,capture)
  assert.equal(normalizeLoadoutBook({ ...book,loadouts:[{...book.loadouts[0],capture:{classes:[],sheet:42}}]}).loadouts[0].capture,undefined)
})
test('invalid operations and out-of-bound plans cannot escape named slots', () => {
  assert.throws(()=>applyLoadoutChange(emptyLoadoutBook(),{kind:'edit',id:'__proto__'}),/Unknown loadout/)
  const b=applyLoadoutChange(emptyLoadoutBook(),{kind:'plan',id:'lo1',plan:{fake:{key:'bad',tier:1},HEAD:{key:'bad',tier:Infinity}}})
  assert.deepEqual(b.loadouts[0].plan,{})
})


test('malformed nested equipment data cannot enter a saved loadout', () => {
  const bad = structuredClone(capture)
  bad.sheet.totals.unsummed = [{ label: 'Haste', values: null }] as never
  const book = emptyLoadoutBook(); book.loadouts[0].capture = bad
  assert.equal(normalizeLoadoutBook(book).loadouts[0].capture, undefined)
  bad.sheet.totals.unsummed = []
  bad.sheet.cells = [{ id:'head',label:'Head',column:'left',location:'Head',item:{name:'Helm',baseName:'Helm',itemId:1,exaltations:[],known:true,block:{stats:null}} }] as never
  assert.equal(normalizeLoadoutBook(book).loadouts[0].capture, undefined)
})
