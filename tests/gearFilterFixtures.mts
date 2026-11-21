import type { GearRow } from '../src/shared/planner/gear'

export function row(over: Partial<GearRow> & Pick<GearRow, 'key' | 'name'>): GearRow {
  return {
    searchKey: over.name.toLowerCase(),
    slots: [],
    classes: [],
    races: ['ALL'],
    flags: [],
    quest: false,
    playerCrafted: false,
    stats: {},
    effects: [],
    ...over
  }
}

/** Thelvorn, Blade of Light — DMG 20, Atk Delay 26, WIS +15, WT 3.0 (tests/gearIndex.test.mts). */
export const THELVORN = row({
  key: 'thelvorn, blade of light',
  name: 'Thelvorn, Blade of Light',
  slots: ['PRIMARY'],
  classes: ['PAL'],
  skill: '1H Slashing',
  stats: { WIS: 15, DMG: 20, DELAY: 26, WEIGHT: 3 },
  effects: [{ name: 'Dismiss Summoned', kind: 'combat', socket: 'proc', tierRequired: 4 }]
})

/** Crown of King Tranix — AC 13, CHA +15, SV MAGIC +20, WT 1.0, and the SV VOID synthesis case. */
export const CROWN = row({
  key: 'crown of king tranix',
  name: 'Crown of King Tranix',
  slots: ['HEAD'],
  classes: ['CLR', 'ENC', 'MAG', 'NEC', 'WIZ'],
  stats: { AC: 13, CHA: 15, SV_MAGIC: 20, WEIGHT: 1 },
  voidSynth: true,
  effects: [{ name: 'Shielding', kind: 'worn', socket: 'worn', tierRequired: 3 }],
  eraTag: 'Classic'
})

/** A plain, effect-free, stat-free row — the "states none" case every rule has to survive. */
export const PLAIN = row({ key: 'cloth cap', name: 'Cloth Cap', slots: ['HEAD'], classes: [], stats: { WEIGHT: 0.5 } })

/** A second weapon with a WORSE base ratio but a haste line, for the sort and threshold tests. */
export const CLUB = row({
  key: 'wooden club',
  name: 'Wooden Club',
  slots: ['PRIMARY', 'SECONDARY'],
  classes: ['WAR', 'PAL'],
  skill: '1H Blunt',
  stats: { DMG: 5, DELAY: 30, HASTE: 10, HP_REGEN: 2, WEIGHT: 2 },
  effects: []
})

export const ALL = [THELVORN, CROWN, PLAIN, CLUB]

/**
 * THE WEAPON-TYPE FIXTURES (JOS-302), and the four spellings are chosen from the corpus census in
 * `shared/planner/weaponType.ts` rather than invented: a clean `2H Slashing`, an `Archery`, the
 * bare `Piercing` that 322 pages state for the one-handed skill, and the stray `1H Slashing /` an
 * editor left a separator on. `PLAIN` (no `Skill:` at all) rides along as the not-a-weapon case.
 */
export const GREATSWORD = row({
  key: 'greatsword',
  name: 'Greatsword',
  slots: ['PRIMARY'],
  skill: '2H Slashing',
  stats: { DMG: 30, DELAY: 45 }
})
export const BOW = row({ key: 'short bow', name: 'Short Bow', slots: ['RANGE'], skill: 'Archery', stats: { DMG: 6, DELAY: 40 } })
export const DAGGER = row({
  key: 'rusty dagger',
  name: 'Rusty Dagger',
  slots: ['PRIMARY', 'SECONDARY'],
  skill: 'Piercing',
  stats: { DMG: 3, DELAY: 22 }
})
export const SLOPPY = row({
  key: 'faydark champions long sword',
  name: 'Faydark Champions Long Sword',
  slots: ['PRIMARY', 'SECONDARY'],
  skill: '1H Slashing /',
  stats: { DMG: 9, DELAY: 27 }
})

export const ARMS = [THELVORN, CLUB, GREATSWORD, BOW, DAGGER, SLOPPY, PLAIN]
