import type { GearRow } from '../../../../shared/planner/gear'
import {
  bestInSlot, enduranceScore, exaltAudit, petValetPicks, spareNames, valetPicks, type GearPick
} from '../../../../shared/worth'

const ENDURANCE_CLASSES = new Set(['BER', 'BRD', 'BST', 'MNK', 'PAL', 'RNG', 'ROG', 'SHD', 'WAR'])

export interface SlotLeaders {
  primary: string | null
  valetPrimary: string | null
  petPrimary: string | null
  spare: string[]
  emptySockets: string[]
  endurance: number
}

/** Best, valet, pet, spare, empty sockets, and endurance, from the rows the build is already scoring. */
export interface SlotLeaderInput {
  rows: readonly GearRow[]
  scoreOf: (row: GearRow) => number
  owned: (row: GearRow) => boolean
  classes: readonly string[]
  worn: readonly GearRow[]
}

function asPick(row: GearRow, scoreOf: (row: GearRow) => number, owned: (row: GearRow) => boolean): GearPick | null {
  const slot = row.slots[0]
  if (!slot) return null
  return {
    name: row.name,
    slot,
    score: scoreOf(row),
    classes: row.classes,
    owned: owned(row),
    temporary: row.flags.some((flag) => /temporary|summoned/i.test(flag))
  }
}

function collect(input: SlotLeaderInput): { picks: GearPick[]; wornPicks: GearPick[]; sockets: { slot: string; stone: string | null; wants: string[] }[]; endurance: number } {
  const wornKeys = new Set<string>()
  for (const row of input.worn) wornKeys.add(row.key)
  const picks: GearPick[] = []
  const wornPicks: GearPick[] = []
  const sockets: { slot: string; stone: string | null; wants: string[] }[] = []
  let endurance = 0
  const spends = input.classes.some((code) => ENDURANCE_CLASSES.has(code))
  for (const row of input.rows) {
    endurance += enduranceScore(row.stats.END ?? 0, spends)
    const pick = asPick(row, input.scoreOf, input.owned)
    if (pick) {
      picks.push(pick)
      if (wornKeys.has(row.key)) wornPicks.push(pick)
    }
    for (const effect of row.effects) {
      if (!effect.socket) continue
      sockets.push({ slot: `${row.name}:${effect.socket}`, stone: effect.name || null, wants: [] })
    }
  }
  return { picks, wornPicks, sockets, endurance }
}

export function slotLeaders(input: SlotLeaderInput): SlotLeaders {
  const { picks, wornPicks, sockets, endurance } = collect(input)
  const best = bestInSlot(picks)
  const valet = valetPicks(picks)
  const pet = petValetPicks(picks, valet)
  return {
    primary: best.get('PRIMARY')?.name ?? best.values().next().value?.name ?? null,
    valetPrimary: valet.get('PRIMARY')?.name ?? null,
    petPrimary: pet.get('PRIMARY')?.name ?? null,
    spare: spareNames(wornPicks),
    emptySockets: exaltAudit(sockets).empty,
    endurance
  }
}
