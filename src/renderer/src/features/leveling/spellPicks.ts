import { nextMote, spellLoadout, voidMoteRank } from '../../../../shared/worth'

export interface RankedSpell {
  name: string
  total: number | null
  metric: string
}

/** Yours versus the pet, the largest mote gain, and the mote worth the most at equal replacement time. */
export function picksFromRankings(rows: readonly RankedSpell[]): { yours: string | null; pet: string | null; next: string | null; mote: string | null } {
  const spells: { name: string; stat: string; amount: number; pet: boolean }[] = []
  const motes: { name: string; moteGain: number }[] = []
  const voids: { name: string; gain: number; hoursToReplace: number }[] = []
  for (const row of rows) {
    const amount = row.total ?? 0
    const pet = /pet/i.test(row.name)
    const stat = row.metric === 'heal' || row.metric === 'hps' ? 'heal' : 'damage'
    spells.push({ name: row.name, stat, amount, pet })
    motes.push({ name: row.name, moteGain: amount })
    voids.push({ name: row.name, gain: amount, hoursToReplace: 1 })
  }
  const loadout = spellLoadout(spells, 'damage')
  return { yours: loadout.yours, pet: loadout.pet, next: nextMote(motes), mote: voidMoteRank(voids)[0]?.name ?? null }
}
