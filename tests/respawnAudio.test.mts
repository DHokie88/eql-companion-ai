import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRespawnAudio, RespawnAudioClock } from '../src/shared/respawnAudio.ts'
import type { RespawnRow } from '../src/shared/respawn.ts'
const row: RespawnRow = {
  id: 'zone::mob',
  key: 'mob',
  display: 'Mob',
  zone: 'Zone',
  baseTs: 10000,
  basis: 'death',
  estimateMs: 120000,
  source: 'custom',
  samples: 0,
  kills: 1
}
const watched = new Set(['mob'])

test('audio preferences accept only bounded integer offsets and canonical keys', () => {
  const clean = normalizeRespawnAudio({
    mob: 60,
    end: 0,
    bad: -1,
    huge: 604801,
    fractional: 1.1,
    text: '60',
    Upper: 2
  })
  assert.deepEqual(Object.entries(clean), [
    ['mob', { leadSec: 60 }],
    ['end', { leadSec: 0 }]
  ])
  assert.deepEqual(Object.entries(normalizeRespawnAudio(null)), [])
})
test('one early warning per cycle, followed by a fresh warning after the next kill', () => {
  const clock = new RespawnAudioClock()
  assert.equal(clock.tick([row], { mob: { leadSec: 60 } }, watched, 69000).length, 0)
  assert.equal(clock.tick([row], { mob: { leadSec: 60 } }, watched, 70000).length, 1)
  assert.equal(clock.tick([row], { mob: { leadSec: 60 } }, watched, 71000).length, 0)
  const next = { ...row, baseTs: 80000 }
  assert.equal(clock.tick([next], { mob: { leadSec: 60 } }, watched, 139000).length, 0)
  assert.equal(clock.tick([next], { mob: { leadSec: 60 } }, watched, 140000).length, 1)
})
test('expiry uses zero offset; hydration and late arming stay silent', () => {
  const clock = new RespawnAudioClock()
  assert.equal(clock.tick([row], { mob: { leadSec: 0 } }, watched, 129000).length, 0)
  assert.equal(clock.tick([row], { mob: { leadSec: 0 } }, watched, 130000).length, 1)
  const late = new RespawnAudioClock()
  assert.equal(late.tick([row], { mob: { leadSec: 0 } }, watched, 140000).length, 0)
  assert.equal(late.tick([row], { mob: { leadSec: 0 } }, watched, 141000).length, 0)
})
test('unwatch, sighting, no estimate and impossible lead never fire', () => {
  for (const [candidate, prefs, watches] of [
    [row, { mob: { leadSec: 60 } }, new Set<string>()],
    [{ ...row, seenTs: 20000 }, { mob: { leadSec: 60 } }, watched],
    [{ ...row, estimateMs: undefined }, { mob: { leadSec: 60 } }, watched],
    [row, { mob: { leadSec: 120 } }, watched]
  ] as const) {
    const clock = new RespawnAudioClock()
    clock.tick([candidate], prefs, watches, 69000)
    assert.equal(clock.tick([candidate], prefs, watches, 70000).length, 0)
  }
})
test('sleep gaps, changed estimates, changed offsets, and past alarms are silent', () => {
  const clock = new RespawnAudioClock()
  clock.tick([row], { mob: { leadSec: 60 } }, watched, 69000)
  assert.equal(clock.tick([row], { mob: { leadSec: 60 } }, watched, 80000).length, 0)
  assert.equal(clock.tick([row], { mob: { leadSec: 60 } }, watched, 81000).length, 0)
  const moved = new RespawnAudioClock()
  moved.tick([row], { mob: { leadSec: 60 } }, watched, 69000)
  assert.equal(
    moved.tick([{ ...row, estimateMs: 119000 }], { mob: { leadSec: 60 } }, watched, 70000).length,
    0
  )
  assert.equal(moved.tick([row], { mob: { leadSec: 61 } }, watched, 71000).length, 0)
})
test('zone-specific rows fire independently; an explicit sighting rebase starts a new cycle', () => {
  const clock = new RespawnAudioClock()
  const other = { ...row, id: 'other::mob', zone: 'Other' }
  clock.tick([row, other], { mob: { leadSec: 60 } }, watched, 69000)
  assert.equal(clock.tick([row, other], { mob: { leadSec: 60 } }, watched, 70000).length, 2)
  const rebased = { ...row, baseTs: 20000, basis: 'sighting' as const }
  clock.tick([rebased], { mob: { leadSec: 60 } }, watched, 79000)
  assert.equal(clock.tick([rebased], { mob: { leadSec: 60 } }, watched, 80000).length, 1)
})

test('options preserve chosen sound and zero-to-full volume; legacy numbers retain defaults', () => {
  const raw = {
    legacy: 60,
    chosen: { leadSec: 0, sound: { packId: 'my-sounds', soundId: 'A custom ding!' }, volume: 0.35 },
    silent: { leadSec: 4, volume: 0 }
  }
  const clean = normalizeRespawnAudio(raw)
  assert.deepEqual(clean.legacy, { leadSec: 60 })
  assert.deepEqual(clean.chosen, raw.chosen)
  assert.deepEqual(clean.silent, raw.silent)
  assert.deepEqual(normalizeRespawnAudio(JSON.parse(JSON.stringify(clean))).chosen, raw.chosen)
})
test('invalid audio fields are dropped without moving a valid timing preference', () => {
  for (const volume of [-1, 1.01, Infinity, NaN, '0.5']) {
    assert.deepEqual(normalizeRespawnAudio({ mob: { leadSec: 60, volume } }).mob, { leadSec: 60 })
  }
  for (const sound of [
    { packId: '../escape', soundId: 'x' },
    { packId: 'safe', soundId: '' },
    { packId: 'safe', soundId: 'x'.repeat(129) }
  ]) {
    assert.deepEqual(normalizeRespawnAudio({ mob: { leadSec: 60, sound } }).mob, { leadSec: 60 })
  }
})
test('changing sound or gain preserves an armed crossing and cannot repeat a consumed cycle', () => {
  const clock = new RespawnAudioClock()
  clock.tick([row], { mob: { leadSec: 60, volume: 1 } }, watched, 69000)
  const prefs = {
    mob: { leadSec: 60, volume: 0.25, sound: { packId: 'my-sounds', soundId: 'new' } }
  }
  assert.equal(clock.tick([row], prefs, watched, 70000).length, 1)
  assert.equal(clock.tick([row], { mob: { ...prefs.mob, volume: 1 } }, watched, 71000).length, 0)
})
