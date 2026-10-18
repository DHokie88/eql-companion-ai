import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SpellModifierCoordinator, type ModifierFacts, type ModifierSelection } from '../src/main/spellLibrary/modifierContext'
import { modifierProfileFile, type ModifierProfiles } from '../src/main/spellLibrary/modifierProfiles'
import { defaultSpellModifierPreferences } from '../src/shared/spellModifiers'
import { modifierRanks } from '../src/main/spellLibrary/modifierRanks'
import { validateModifierPreferences } from '../src/main/spellLibrary/modifierValidation'

const facts = (rank = 4): ModifierFacts => ({ ranks: { strike: { name: 'Strike', rank } },
  inventory: { state: 'ready', exportedAt: '2026-10-18T01:00:00Z', candidates: [], warnings: [] }, warnings: [] })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
function rig(read?: (who: ModifierSelection) => Promise<ModifierFacts>) {
  let selected: ModifierSelection = { installation: 'C:/EQ', character: { name: 'Alpha', server: 'freeport' } }
  let input = facts(), saved: ModifierProfiles = {}, writes = 0, fail = false, reads = 0
  const revisions: string[] = [], errors: unknown[] = []
  const coordinator = new SpellModifierCoordinator({ selection: () => selected,
    read: async (who) => { reads++; return read ? read(who) : structuredClone(input) },
    store: { async load() { return structuredClone(saved) }, async save(profiles) {
      writes++; if (fail) throw new Error('synthetic write failed'); saved = structuredClone(profiles)
    } }, changed: (rev) => revisions.push(rev), log: (error) => errors.push(error) })
  return { coordinator, revisions, errors, selected: (value: ModifierSelection) => { selected = value },
    facts: (value: ModifierFacts) => { input = value }, fail: () => { fail = true }, writes: () => writes,
    saved: () => saved, reads: () => reads }
}

test('a cast timestamp and merge-count update does not revise a calculation context', async () => {
  const first = { strike: { name: 'Strike', rank: 4, firstAt: 1, lastAt: 2, merges: 1 } }
  const second = { strike: { ...first.strike, lastAt: 100, merges: 50 } }
  const r = rig()
  r.facts({ ...facts(), ranks: modifierRanks(first) })
  const before = await r.coordinator.get()
  r.facts({ ...facts(), ranks: modifierRanks(second) }); r.coordinator.inputsChanged()
  assert.equal((await r.coordinator.get()).revision, before.revision)
  assert.equal(r.revisions.length, 1)
  r.coordinator.stop()
})

test('inventory provenance can refresh without re-ranking identical equipment', async () => {
  const r = rig(), first = await r.coordinator.get()
  const next = facts(); next.inventory.exportedAt = '2026-10-18T02:00:00Z'
  r.facts(next); r.coordinator.inputsChanged()
  const after = await r.coordinator.get()
  assert.equal(after.revision, first.revision)
  assert.equal(after.inventory.exportedAt, next.inventory.exportedAt)
  assert.deepEqual(r.revisions, [first.revision, first.revision])
  r.coordinator.stop()
})

test('mote ranks, worn effects and missing inventory are semantic context changes', async () => {
  const r = rig(), revisions = [(await r.coordinator.get()).revision]
  r.facts(facts(5)); r.coordinator.inputsChanged(); revisions.push((await r.coordinator.get()).revision)
  const focused = facts(5); focused.inventory.candidates.push({ effect: 'Improved Damage II', item: 'A mask' })
  r.facts(focused); r.coordinator.inputsChanged(); revisions.push((await r.coordinator.get()).revision)
  r.facts({ ...facts(5), inventory: { state: 'missing', exportedAt: null, candidates: [], warnings: [] } })
  r.coordinator.inputsChanged(); revisions.push((await r.coordinator.get()).revision)
  assert.equal(new Set(revisions).size, 4)
  r.coordinator.stop()
})

test('a pending former-character read never publishes after a switch', async () => {
  const old = deferred<ModifierFacts>(), started = deferred<boolean>()
  const r = rig(async (who) => {
    if (who.character?.name === 'Alpha') { started.resolve(true); return old.promise }
    return facts(8)
  })
  const pending = r.coordinator.get(); await started.promise
  r.selected({ installation: 'C:/EQ', character: { name: 'Beta', server: 'freeport' } })
  r.coordinator.inputsChanged(); old.resolve(facts(2))
  const context = await pending
  assert.equal(context.character?.name, 'Beta')
  assert.equal(context.ranks?.strike.rank, 8)
  assert.equal(r.revisions.length, 1)
  r.coordinator.stop()
})

test('an engine restart discards a pending read even when the character name is unchanged', async () => {
  const old = deferred<ModifierFacts>(), started = deferred<boolean>()
  let calls = 0
  const r = rig(async () => { calls++; if (calls === 1) { started.resolve(true); return old.promise }; return facts(9) })
  const pending = r.coordinator.get(); await started.promise
  r.coordinator.inputsChanged(); old.resolve(facts(2))
  assert.equal((await pending).ranks?.strike.rank, 9)
  assert.equal(calls, 2)
  r.coordinator.stop()
})

test('preferences remain separate for installation, server and character', async () => {
  const r = rig(), original = await r.coordinator.get()
  const preferences = defaultSpellModifierPreferences(); preferences.mode = 'emulate'; preferences.emulation.rank = 5
  await r.coordinator.update({ expectedRevision: original.revision, preferences })
  for (const selected of [
    { installation: 'D:/EQ', character: { name: 'Alpha', server: 'freeport' } },
    { installation: 'C:/EQ', character: { name: 'Alpha', server: 'other' } },
    { installation: 'C:/EQ', character: { name: 'Beta', server: 'freeport' } }
  ]) {
    r.selected(selected); r.coordinator.inputsChanged()
    assert.equal((await r.coordinator.get()).preferences.mode, 'client')
  }
  r.selected({ installation: 'c:/eq', character: { name: 'ALPHA', server: 'FREEPORT' } }); r.coordinator.inputsChanged()
  assert.equal((await r.coordinator.get()).preferences.emulation.rank, 5)
  assert.equal(Object.keys(r.saved()).length, 1)
  r.coordinator.stop()
})

test('without a character emulation is session-only and detected mode is refused', async () => {
  const r = rig(); r.selected({ installation: 'C:/EQ', character: null })
  const original = await r.coordinator.get()
  assert.equal(original.ranks, null); assert.equal(r.reads(), 0)
  const preferences = defaultSpellModifierPreferences(); preferences.mode = 'emulate'; preferences.emulation.rank = 5
  const simulated = await r.coordinator.update({ expectedRevision: original.revision, preferences })
  assert.equal(simulated.preferences.emulation.rank, 5); assert.equal(r.writes(), 0)
  preferences.mode = 'mine'
  await assert.rejects(r.coordinator.update({ expectedRevision: simulated.revision, preferences }), /Select a character/)
  r.coordinator.stop()
})

test('stale update tokens cannot change another context and failed writes retain old preferences', async () => {
  const r = rig(), original = await r.coordinator.get()
  r.facts(facts(5)); r.coordinator.inputsChanged(); const changed = await r.coordinator.get()
  const preferences = defaultSpellModifierPreferences(); preferences.mode = 'mine'
  await assert.rejects(r.coordinator.update({ expectedRevision: original.revision, preferences }), /context changed/)
  assert.equal(r.writes(), 0)
  r.fail()
  await assert.rejects(r.coordinator.update({ expectedRevision: changed.revision, preferences }), /write failed/)
  assert.equal((await r.coordinator.get()).preferences.mode, 'client')
  r.coordinator.stop()
})

test('a failed engine read clears unavailable facts instead of carrying the previous world', async () => {
  let fail = false
  const r = rig(async () => { if (fail) throw new Error('engine restarted'); return facts() })
  await r.coordinator.get(); fail = true; r.coordinator.inputsChanged()
  const context = await r.coordinator.get()
  assert.equal(context.ranks, null); assert.equal(context.inventory.state, 'missing')
  assert.equal(context.warnings.length, 1)
  r.coordinator.stop()
})

test('consumers cannot mutate the coordinator through returned contexts', async () => {
  const r = rig(), context = await r.coordinator.get()
  context.ranks!.strike.rank = 10; context.preferences.mode = 'mine'
  assert.equal((await r.coordinator.get()).ranks?.strike.rank, 4)
  assert.equal((await r.coordinator.get()).preferences.mode, 'client')
  r.coordinator.stop()
})

test('profile files retain only validated preferences and round-trip atomically', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eqo-modifier-profiles-'))
  try {
    const path = join(directory, 'nested', 'spell-modifiers.json'), store = modifierProfileFile(path)
    assert.deepEqual(await store.load(), {})
    const key = 'a'.repeat(64), preferences = defaultSpellModifierPreferences()
    preferences.mode = 'emulate'; preferences.emulation.ranks['10'] = { rank: 5, name: 'Strike' }
    await store.save({ [key]: preferences })
    assert.deepEqual(await store.load(), { [key]: preferences })
    assert.deepEqual(Object.keys(JSON.parse(await readFile(path, 'utf8'))), ['version', 'profiles'])
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('invalid preferences reject numeric, count, key and mode violations', () => {
  const base = defaultSpellModifierPreferences()
  for (const preferences of [
    { ...base, mode: 'other' }, { ...base, emulation: { ...base.emulation, rank: 4.5 } },
    { ...base, emulation: { ...base.emulation, rank: 11 } }, { ...base, emulation: { ...base.emulation, focusIds: [-1] } },
    { ...base, emulation: { ...base.emulation, focusIds: [1, 1] } },
    { ...base, emulation: { ...base.emulation, ranks: { x: { rank: 5, name: 'Strike' } } } },
    { ...base, emulation: { ...base.emulation, ranks: { '1': { rank: 5, name: '' } } } }, { ...base, sql: 'SELECT 1' }
  ]) {
    assert.throws(() => validateModifierPreferences(preferences))
  }
})

test('target preferences retain legacy shapes and only change revisions when their effective value changes', async () => {
  const r = rig(), before = await r.coordinator.get()
  const old = defaultSpellModifierPreferences()
  assert.deepEqual(validateModifierPreferences(old), old)
  const explicit = await r.coordinator.update({ expectedRevision: before.revision, preferences: { ...old, targets: 4 } })
  assert.equal(explicit.revision, before.revision)
  const pack = await r.coordinator.update({ expectedRevision: explicit.revision, preferences: { ...old, targets: 8 } })
  assert.notEqual(pack.revision, before.revision)
  assert.equal(pack.preferences.targets, 8)
  const max = await r.coordinator.update({ expectedRevision: pack.revision, preferences: { ...old, targets: 'maximum' } })
  assert.notEqual(max.revision, pack.revision)
  for (const targets of [0, 101, 1.5, 'all', null]) assert.throws(() => validateModifierPreferences({ ...old, targets }))
  r.coordinator.stop()
})
