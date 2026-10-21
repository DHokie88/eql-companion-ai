import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PRIORITIES, PRIORITY_LEVELS, sanitizePriorities, sanitizePriorityExtras, scoreGear, type GearPriorities } from '../src/renderer/src/features/gear/gearPriorities'

test('five importance levels default to Normal with weight one and sanitize invalid stored choices', () => {
  assert.equal(PRIORITY_LEVELS.length, 5)
  assert.equal(PRIORITY_LEVELS.find((choice) => choice.level === DEFAULT_PRIORITIES.HP)?.weight, 1)
  assert.deepEqual(sanitizePriorities({ HP: 5, MP: 100, AC: '4', STATS: 2.5 }), { ...DEFAULT_PRIORITIES, HP: 5 })
  for (const input of [null, [], 'invalid']) assert.deepEqual(sanitizePriorities(input), DEFAULT_PRIORITIES)
})

test('normalization compares importance independently of raw stat units', () => {
  const rows = [{ name: 'Armor', stats: { AC: 100 } }, { name: 'Health', stats: { HP: 1000 } }]
  const balanced = scoreGear(rows, DEFAULT_PRIORITIES)
  assert.equal(balanced[0].priorityScore, balanced[1].priorityScore)
  const armor = scoreGear(rows, { ...DEFAULT_PRIORITIES, AC: 5, HP: 2 })
  assert.ok(armor[0].priorityScore > armor[1].priorityScore)
  const health = scoreGear(rows, { ...DEFAULT_PRIORITIES, AC: 2, HP: 5 })
  assert.ok(health[1].priorityScore > health[0].priorityScore)
  assert.equal('priorityScore' in rows[0], false, 'input rows stay unchanged')
})

test('each attribute and resistance has an independent weight; optional stats count only when selected', () => {
  const rows = [{ stats: { STR: 10 } }, { stats: { INT: 20 } }, { stats: { SV_FIRE: 30 } }, { stats: { SV_POISON: 40 } }]
  const allOff = Object.fromEntries(Object.keys(DEFAULT_PRIORITIES).map((key) => [key, 1])) as GearPriorities
  assert.deepEqual(scoreGear(rows, allOff).map((row) => row.priorityScore), [0, 0, 0, 0])
  assert.deepEqual(scoreGear(rows, { ...allOff, STR: 5 }).map((row) => row.priorityScore), [100, 0, 0, 0])
  assert.deepEqual(scoreGear(rows, { ...allOff, INT: 5 }).map((row) => row.priorityScore), [0, 100, 0, 0])
  assert.deepEqual(scoreGear(rows, { ...allOff, SV_FIRE: 5 }).map((row) => row.priorityScore), [0, 0, 100, 0])
  assert.deepEqual(scoreGear(rows, { ...allOff, SV_POISON: 5 }).map((row) => row.priorityScore), [0, 0, 0, 0])
  assert.deepEqual(scoreGear(rows, { ...allOff, SV_POISON: 5 }, ['SV_POISON']).map((row) => row.priorityScore), [0, 0, 0, 100])
  assert.deepEqual(sanitizePriorityExtras(['CHA', 'nope', 'CHA', 'SV_DISEASE']), ['SV_DISEASE', 'CHA'])
  assert.deepEqual(scoreGear([], DEFAULT_PRIORITIES), [])
})
