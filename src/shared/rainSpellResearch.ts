/** Audited direct-rain research, shared without importing the legacy wiki catalog.
 * The source evidence and client measurements remain documented in main/data/rainSpells.ts.
 * New analysis binds these exact names to compatible numeric client identities per snapshot.
 */
/** One registry row: the spell, how many waves it delivers, and the page sentence that says so. */
export interface RainPage {
  name: string
  waves: number
  /** The `description` field of the spell's own wiki page, verbatim, trimmed to the wave clause. */
  quote: string
}

/**
 * THE ROSTER. 23 rows, alphabetical, each quoting its own page (see the header for the sweep).
 *
 * The quotes are the evidence bar `spellCorrectionsList.ts` set for a hand-maintained table: a row
 * that cannot cite its page does not belong here, and a reader re-deciding one of these does not
 * have to go and find the sentence again.
 */
export const RAIN_PAGES: readonly RainPage[] = [
  { name: 'Avalanche', waves: 3, quote: 'Calls down a hailstorm from the sky, causing three waves of 125 damage, up to a maximum of 4 targets hit.' },
  { name: 'Blizzard', waves: 3, quote: 'Calls down a hailstorm from the sky, causing three waves of 490 damage, up to a maximum of 4 targets hit.' },
  { name: 'Cascade of Hail', waves: 3, quote: 'Calls down a hailstorm from the sky, causing three waves of 27 damage, up to a maximum of 4 targets hit.' },
  { name: 'Energy Storm', waves: 3, quote: 'Calls down an energy storm that falls in three waves, causing 96 damage to all creatures in the vicinity of your target.' },
  { name: 'Firestorm', waves: 3, quote: 'Calls down a firestorm in three waves. Each wave causes 28 damage to all creatures in the vicinity of your target.' },
  { name: 'Frost Storm', waves: 3, quote: 'Calls down a frost storm that falls in three waves, causing between 250 damage to all creatures in the vicinity of your target.' },
  { name: 'Gale of Poison', waves: 3, quote: 'Creates a rain of poison, causing three waves of 122 damage to everything in a small radius around your target.' },
  { name: 'Icestrike', waves: 3, quote: 'Calls down a cascade of sleet that falls in three waves, causing 16 damage to all creatures in the vicinity of your target for each wave. Has a potential maximum of 48 cold damage.' },
  { name: 'Lava Storm', waves: 3, quote: 'Calls down a storm of lava that falls in three waves, causing 128 damage to all creatures in the vicinity of your target.' },
  { name: 'Lightning Storm', waves: 3, quote: 'Calls down a lightning storm that falls in three waves. Each wave causes up to 75 damage to all creatures in the vicinity of your target.' },
  // The page hedges with a question mark; the client's own AEDuration 7500 on the player's row
  // (id 1665) answers it. Instrument 1 also has it — its cast line says "mana rains down".
  { name: 'Manastorm', waves: 3, quote: 'Creates a storm of mana around you, causing 675 damage (x3 waves?) to several creatures near your target, and draining their mana.' },
  { name: 'Pogonip', waves: 3, quote: 'Calls down a hailstorm from the sky, causing three waves of 62 damage, up to a maximum of 4 targets hit.' },
  { name: 'Poison Storm', waves: 3, quote: 'Creates a rain of poison, causing three waves of 60 damage to everything in a small radius around your target.' },
  { name: 'Rain of Blades', waves: 3, quote: 'Conjures a rain of blades that assaults all creatures in the vicinity of your target, causing three waves of up to 26 damage each.' },
  { name: 'Rain of Fire', waves: 3, quote: 'Conjures a rain of fire that assaults all creatures in the vicinity of your target, causing three waves of of up to 75 damage each.' },
  { name: 'Rain of Lava', waves: 3, quote: 'Conjures a rain of lava that assaults all creatures in the vicinity of your target, causing three waves of up to 172 damage each.' },
  { name: 'Rain of Spikes', waves: 3, quote: 'Conjures a rain of spikes that assaults all creatures in the vicinity of your target, causing three waves of up to 91 damage each.' },
  { name: 'Rain of Swords', waves: 3, quote: 'Conjures a rain of swords that assaults all creatures in the vicinity of your target, causing three waves of up to 324 damage each.' },
  { name: 'Sirocco', waves: 3, quote: 'Conjures a blistering wind that assaults several creatures in the vicinity of your target, causing three waves of between 630 and @1 damage.' },
  { name: 'Tears of Druzzil', waves: 3, quote: 'Tears of searing magic fall in three waves, causing 600 damage to four creatures in the vicinity of your target.' },
  { name: 'Tears of Prexus', waves: 3, quote: 'Tears of searing ice fall around your target, causing three waves of 690 damage to all creatures in the vicinity of your target.' },
  { name: 'Tears of Solusek', waves: 3, quote: 'Tears of searing flame fall around your target, causing three waves of 645 damage to all creatures in the vicinity of your target.' },
  // "1-3 waves" is the same downward hedge the log measures: a wave that connects with nothing
  // prints nothing. The page's own damage range settles the count — 1620 is 3 x 540.
  { name: 'Torrent of Poison', waves: 3, quote: 'Creates a rain of poison, causing 1-3 waves of 540 damage to 1-4 creatures in a small radius around your target.' }
]

