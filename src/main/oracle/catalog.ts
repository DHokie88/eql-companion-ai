import type { OracleSource } from '../../shared/oracle'

const wiki = (page: string): string => `https://eqlwiki.com/wiki/${encodeURIComponent(page.replaceAll(' ', '_'))}`
interface ItemSnapshot { scrapedAt: string; items: Record<string, { page: string }> }
interface SpellSnapshot { scrapedAt: string; spells: { name: string }[] }
interface QuestSnapshot { scrapedAt: string; quests: { name: string; page: string; requiredItems?: string[]; steps?: string[] }[] }
interface MobSnapshot { scrapedAt: string; mobs: { name: string; page: string }[] }
interface ClassSnapshot { scrapedAt: string; names: Record<string, string>; [key: string]: unknown }
export async function catalogSources(): Promise<OracleSource[]> {
  const [{ default: items }, { default: spells }, { default: quests }, { default: mobs }, { default: classes }] = await Promise.all([
    import('../data/items.json') as unknown as Promise<{ default: ItemSnapshot }>,
    import('../data/spells.json') as unknown as Promise<{ default: SpellSnapshot }>,
    import('../../renderer/src/data/eqlegends/quests.json') as unknown as Promise<{ default: QuestSnapshot }>,
    import('../../renderer/src/data/eqlegends/mobs.json') as unknown as Promise<{ default: MobSnapshot }>,
    import('../data/classes.json') as unknown as Promise<{ default: ClassSnapshot }>
  ])
  const result: OracleSource[] = []
  for (const [name, item] of Object.entries(items.items)) {
    result.push({ id: `item:${name}`, kind: 'items', title: item.page, url: wiki(item.page), date: items.scrapedAt,
      attribution: 'Bundled EQL wiki item snapshot; may be incomplete or outdated.', text: JSON.stringify(item) })
  }
  for (const spell of spells.spells) {
    result.push({ id: `spell:${spell.name}`, kind: 'spells', title: spell.name, url: wiki(spell.name), date: spells.scrapedAt,
      attribution: 'Bundled EQL wiki spell snapshot; values are captured source data, not live client calculations.', text: JSON.stringify(spell) })
  }
  for (const quest of quests.quests) {
    // Chunk long walkthroughs so retrieval can find the relevant steps without sending a whole book.
    const text = `Required items: ${(quest.requiredItems ?? []).join(', ')}\n${(quest.steps ?? []).join('\n')}`
    for (let start = 0; start < Math.max(text.length, 1); start += 2400) result.push({
      id: `quest:${quest.page}:${start}`, kind: 'quests', title: quest.name, url: wiki(quest.page), date: quests.scrapedAt,
      attribution: 'Bundled EQL wiki quest snapshot; verify server-specific differences.', text: text.slice(start, start + 2800)
    })
  }
  for (const mob of mobs.mobs) result.push({ id: `mob:${mob.page}`, kind: 'mobs', title: mob.name, url: wiki(mob.page), date: mobs.scrapedAt,
    attribution: 'Bundled EQL wiki NPC snapshot; drops and locations are recorded, not guaranteed.', text: JSON.stringify(mob) })
  for (const [code, name] of Object.entries(classes.names)) result.push({
    id: `class:${code}`, kind: 'classes', title: `${name} (${code})`, url: wiki(name), date: classes.scrapedAt,
    attribution: 'Bundled EQL class tables; disputed entries remain disputed.', text: classText(code, classes)
  })
  result.push({ id: 'help:oracle', kind: 'help', title: 'Using EQ Oracle', url: null, date: null, attribution: 'EQ Oracle application help.',
    text: 'EQ Oracle reads EverQuest Legends logs. Overview, Combat, Mobs, Loot, Quests, Zone Loot, Gear, Maps, Raid Targets, Plane of Sky, Alerts, Leveling, Spells, Buffs and Timers are available from the sidebar. Preferences configures the install path. Ask EQ Oracle searches bundled reference data; it cannot see your live character, inventory or combat state. Discord What’s New is a bundled snapshot, not a live feed. The shared local Qwen connection is configured in Ask EQ Oracle and used by every question box. Hermes updates the source harvest separately; refreshed data must be imported and the app rebuilt.' })
  return result
}
function classText(code: string, data: Record<string, unknown>): string {
  const rows: string[] = []
  for (const [section, value] of Object.entries(data)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => JSON.stringify(v).includes(`"${code}"`))
    if (entries.length) rows.push(`${section}: ${JSON.stringify(Object.fromEntries(entries))}`)
  }
  return rows.join('\n')
}
