import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeClientSpellFocus, qualifyClientSpellFocus } from '../src/shared/clientSpellFocus'
import { effect, modifierFocus, modifierSpell } from './helpers/spellModifierFixtures.mts'

function qualify(limits, changes = {}, input = {}) {
  const focus = decodeClientSpellFocus(modifierFocus(limits))
  assert.ok(focus)
  return qualifyClientSpellFocus(focus, modifierSpell(changes), { level: 50, classes: ['WIZ'], ticks: 0, ...input })
}

test('numeric focus decoder retains encoded band and zero secondary value means a fixed bonus', () => {
  assert.deepEqual([qualify([]).minPct, qualify([]).maxPct, qualify([]).pct], [1, 20, 10.5])
  const fixed = decodeClientSpellFocus(modifierFocus([], { effects: [effect(125, 12)] }))
  assert.equal(fixed?.kind, 'healing')
  assert.equal(fixed?.maxPct, 12)
  assert.equal(decodeClientSpellFocus(modifierSpell()), null)
})

test('focus max level uses client acquisition level and its encoded decay, not caster level or hardcoded five percent', () => {
  const limits = [effect(134, 10, 7)]
  assert.equal(qualify(limits).pct, 10.5 * 0.86)
  assert.equal(qualify(limits, { classes: [{ code: 'WIZ', level: 10 }] }).pct, 10.5)
  assert.equal(qualify(limits, { classes: [{ code: 'WIZ', level: 25 }] }).pct, 0)
  assert.equal(qualify([effect(134, 11)]).pct, 0)
  assert.equal(qualify([effect(134, 12)]).pct, 10.5)
})

test('union classes choose earliest eligible acquisition while unresolved classes stay explicitly unknown', () => {
  const changes = { classes: [{ code: 'WIZ', level: 20 }, { code: 'PAL', level: 8 }] }
  assert.equal(qualify([effect(134, 10, 7)], changes, { classes: ['WIZ', 'PAL'] }).pct, 10.5)
  assert.equal(qualify([effect(134, 10, 7)], changes, { classes: ['WIZ'] }).pct, 10.5 * 0.3)
  assert.match(qualify([effect(134, 10, 7)], changes, { classes: [] }).unknown ?? '', /resolved eligible caster class/)
  assert.equal(qualify([effect(142, 12)]).pct, 10.5)
  assert.equal(qualify([effect(142, 13)]).pct, 0)
})

test('same-family includes are alternatives, separate families all pass, and exclusions veto', () => {
  const limits = [effect(135, 1), effect(135, 2), effect(136, 5), effect(137, 0), effect(139, 101)]
  assert.equal(qualify(limits).pct, 10.5)
  assert.equal(qualify(limits, { target: 8 }).pct, 0)
  assert.equal(qualify([...limits, effect(135, -2)]).pct, 0)
  assert.equal(qualify([...limits, effect(136, -5)]).pct, 0)
  assert.equal(qualify([...limits, effect(137, -79)], { effects: [effect(0, -10), effect(79, -10)] }).pct, 0)
  assert.equal(qualify([...limits, effect(139, -101)]).pct, 0)
})

test('focus names never substitute for exact numeric spell or effect restrictions', () => {
  assert.equal(qualify([effect(139, 102)]).pct, 0)
  assert.equal(qualify([effect(139, 101), effect(139, 102)]).pct, 10.5)
  assert.equal(qualify([effect(137, 79)], { effects: [effect(0, -100)] }).pct, 0)
  assert.equal(qualify([effect(137, 79), effect(137, 0)]).pct, 10.5)
  assert.equal(qualify([effect(137, 0)], { effects: [effect(79, -100)] }).pct, 0)
})

test('instant and periodic restrictions use client duration, minimum duration uses calculated ticks', () => {
  assert.equal(qualify([effect(141, 1)]).pct, 10.5)
  assert.equal(qualify([effect(141, 1)], { durationFormula: 7 }, { ticks: 5 }).pct, 0)
  assert.equal(qualify([effect(141, 0)], { durationFormula: 7 }, { ticks: 5 }).pct, 10.5)
  assert.equal(qualify([effect(141, 0)]).pct, 0)
  assert.equal(qualify([effect(140, 4)], { durationFormula: 7 }, { ticks: 3 }).pct, 0)
  assert.equal(qualify([effect(140, 4)], { durationFormula: 7 }, { ticks: 4 }).pct, 10.5)
})

test('polarity and cast time restrictions include boundary values', () => {
  assert.equal(qualify([effect(138, 0), effect(143, 2500), effect(144, 2500)]).pct, 10.5)
  assert.equal(qualify([effect(138, 1)]).pct, 0)
  assert.equal(qualify([effect(143, 2501)]).pct, 0)
  assert.equal(qualify([effect(144, 2499)]).pct, 0)
  assert.equal(qualify([effect(138, 1)], { beneficial: true }).pct, 10.5)
})

test('combat/proc limits require known classification instead of assuming every client record is a spell', () => {
  assert.equal(qualify([effect(311, 0)]).pct, 10.5)
  assert.equal(qualify([effect(311, 1)]).pct, 0)
  assert.equal(qualify([effect(311, 0)], { fields: { isDiscipline: true } }).pct, 0)
  assert.equal(qualify([effect(311, 1)], { fields: { isCombatProc: true } }).pct, 10.5)
  assert.match(qualify([effect(311, 0)], { classes: [], mana: 0 }).unknown ?? '', /classification is unknown/)
  assert.match(qualify([effect(311, 0)], { fields: { skill: 1 } }).unknown ?? '', /classification is unknown/)
})

test('missing decoded resist does not silently satisfy an include or exclusion', () => {
  assert.match(qualify([effect(135, 2)], { fields: {} }).unknown ?? '', /cannot be resolved/)
  assert.match(qualify([effect(135, -2)], { fields: {} }).unknown ?? '', /cannot be resolved/)
})

test('unsupported and multi-head focus layouts remain visible but fail closed', () => {
  for (const extra of [effect(348, 10), { ...effect(134, 20, 5), calc: 101 }, effect(138, 2), effect(141, -1), effect(143, -1), effect(135, 2, 1)]) {
    const result = qualify([extra])
    assert.equal(result.pct, 0)
    assert.ok(result.unknown)
  }
  const both = decodeClientSpellFocus(modifierFocus([], { effects: [effect(124, 1, 20), effect(125, 1, 20)] }))
  assert.equal(both?.kind, null)
  assert.match(both?.reason ?? '', /Multiple focus heads/)
  for (const head of [effect(124, -1, 20), effect(124, 20, 1), { ...effect(124, 1, 20), calc: 101 }]) {
    assert.ok(decodeClientSpellFocus(modifierFocus([], { effects: [head] }))?.reason)
  }
})
