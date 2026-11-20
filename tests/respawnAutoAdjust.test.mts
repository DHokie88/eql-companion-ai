import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRespawnPrefs, resolveRespawn, respawnFloored, respawnSourceLabel, respawnDurationText, type RespawnRow } from '../src/shared/respawn'

test('auto-adjust persists as an explicit choice and replaces a manual value', () => {
  const prefs = normalizeRespawnPrefs({ watches: [{ key: ' Priest ', display: 'Priest', customSec: 270, autoAdjust: true }] })
  assert.deepEqual(prefs, { watches: [{ key: 'priest', display: 'Priest', autoAdjust: true }] })
  assert.deepEqual(normalizeRespawnPrefs(JSON.parse(JSON.stringify(prefs))), prefs)
  assert.equal(normalizeRespawnPrefs({ watches: [{ key: 'x', autoAdjust: 'true' }] }).watches[0]?.autoAdjust, undefined)
})

test('auto-adjust follows the shortest observed gap without claiming an exact spawn', () => {
  const ev = { customMs: 270000, observedMs: 160000, samples: 1, wikiMs: 270000, autoAdjust: true }
  assert.deepEqual(resolveRespawn(ev), { estimateMs: 160000, source: 'observed' })
  assert.equal(resolveRespawn({ ...ev, observedMs: 150000, samples: 2 }).estimateMs, 150000)
  assert.equal(resolveRespawn({ samples: 0, wikiMs: 270000, autoAdjust: true }).estimateMs, 270000)
  assert.equal(resolveRespawn({ ...ev, autoAdjust: false }).estimateMs, 270000)
  const row = { ...ev, estimateMs: 160000, source: 'observed' } as RespawnRow
  assert.equal(respawnFloored(row), false)
  assert.match(respawnSourceLabel(row), /auto-adjust/)
  assert.match(respawnDurationText(row, String), /^<=/)
})
