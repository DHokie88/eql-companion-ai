import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateModifiedSpell, SpellModifierCatalog } from '../src/shared/clientSpellModifiers'
import { defaultSpellModifierPreferences, type SpellModifierContext } from '../src/shared/spellModifiers'
import { spellRow, syntheticCatalog } from './spellLibrarySynthetic.mts'
import { spellPreviewTargets } from '../src/shared/spellAnalysis'
import { spellRankProgression, rankHpTiming } from '../src/shared/clientSpellRankRules'

test('rank 0-X uses separate direct, tick and duration rules without equipment', () => {
  const direct = spellRow(1, 'Test direct', 20, 100)
  const hybrid = spellRow(2, 'Test hybrid'); hybrid[11] = '7'; hybrid[12] = '10'
  hybrid[172] = '1|79|-40|0|100|0$2|0|-100|0|100|0'
  const records = syntheticCatalog([direct, hybrid]).records
  const catalog = new SpellModifierCatalog(records)
  const totals = [1140, 1278, 1316, 1464, 1505, 1662, 1706, 1871, 1919, 2093, 2144]
  for (let rank = 0; rank <= 10; rank++) {
    const preferences = defaultSpellModifierPreferences()
    preferences.mode = 'emulate'; preferences.emulation.rank = rank; preferences.emulation.focus = 'none'
    const context: SpellModifierContext = { revision: 'test', modelVersion: '9', character: null, preferences,
      ranks: {}, inventory: { state: 'ready', exportedAt: null, candidates: [], warnings: [] }, warnings: [] }
    const options = { context, rankOnly: true, level: 10, classes: ['WIZ'] as const, metric: 'damage' as const }
    const input = { ...options, classes: [...options.classes] }
    assert.equal(evaluateModifiedSpell(records[0], input, catalog).total, 100 + 6 * rank)
    assert.equal(evaluateModifiedSpell(records[0], input, catalog).mana, Math.round(20 * (100 - 2 * rank) / 100))
    const dot = evaluateModifiedSpell(records[1], input, catalog)
    assert.equal(dot.perTick, 100 + 3 * rank)
    assert.equal(dot.total, totals[rank], `hybrid total at rank ${rank}`)
    assert.equal(dot.modifiers?.focus, null)
  }
})

test('observed ordinary DoT pulse counts are not duration intervals', () => {
  // Independently counted full applications in the local combat log, 2026-08-31:
  // Venom X: 10 pulses at +1,+7,+13,+19,+25,+31,+37,+43,+49,+55 seconds.
  // Ignite Blood VIII: 11 pulses at +3,+9,...,+63 seconds, then wear-off.
  // Only anonymous timing/count facts are retained; no raw player log is copied.
  const poison = spellRow(1, 'Synthetic six-interval poison'); poison[11] = '1'; poison[12] = '6'
  const fire = spellRow(2, 'Synthetic seven-interval fire'); fire[11] = '1'; fire[12] = '7'
  const [p, f] = syntheticCatalog([poison, fire]).records
  const px = spellRankProgression(p, 50, 'damage')[10].calculation
  assert.deepEqual([px.durationTicks, px.ticks, px.total], [9, 10, 1300])
  const fviii = spellRankProgression(f, 50, 'damage')[8].calculation
  assert.deepEqual([fviii.durationTicks, fviii.ticks, fviii.total], [10, 11, 1364])
  assert.equal(spellRankProgression(p, 50, 'damage')[0].calculation.ticks, 7)
})

test('rank costs and timing share the category model without raising zero reuse', () => {
  const direct = spellRow(1, 'Synthetic direct', 250, 900)
  direct[8] = '6000'; direct[9] = '1500'; direct[10] = '0'
  const dot = spellRow(2, 'Synthetic periodic', 409, 345)
  dot[8] = '3000'; dot[9] = '1500'; dot[10] = '12000'; dot[11] = '1'; dot[12] = '6'
  const [d, p] = syntheticCatalog([direct, dot]).records
  const ix = spellRankProgression(d, 50, 'damage')[9]
  assert.deepEqual([ix.calculation.total, ix.calculation.mana], [1386, 205])
  assert.equal(ix.calculation.perMana, 1386 / 205)
  assert.deepEqual(ix.timing, { castMs: 4920, recoveryMs: 1200, recastMs: 0 })
  assert.deepEqual(spellRankProgression(p, 50, 'damage')[10].timing, { castMs: 1800, recoveryMs: 1200, recastMs: 9000 })
  assert.equal(spellRankProgression(p, 50, 'damage')[10].calculation.mana, 327)
  assert.equal(rankHpTiming({ ...d, recoveryMs: 1500 }, 'damage', 5).recoveryMs, 1300, 'recovery ties round down')
  assert.equal(rankHpTiming({ ...d, recoveryMs: -1 }, 'damage', 5).recoveryMs, -1, 'invalid client timing stays available for exclusion')
})
test('old maximum and oversized target preferences become eight-enemy preview scenarios', () => {
  assert.deepEqual([undefined, 'maximum', 100, 8, 4, 1].map((n) => spellPreviewTargets(n as number | 'maximum' | undefined)), [4, 8, 8, 8, 4, 1])
})
