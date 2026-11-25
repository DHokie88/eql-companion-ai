import { type JSX, useMemo, useState } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import { extractSteps, parseQuestPage } from '../../../../../scripts/sources/questPage'
import { zoneShortName } from '@shared/zones'
import { scaleAccuracy, voidAtTier } from '@shared/itemUpgrade'
import { sortLootRows, type LootSortKey } from '../loot/lootSort'
import {
  aaPlan,
  bestInSlot,
  canMakeRecipe,
  crawlMarks,
  enduranceScore,
  exaltAudit,
  factionStandings,
  followLoggedLoc,
  gearProgression,
  hangPoint,
  lootTags,
  lootUpload,
  macroSend,
  nextMote,
  ownTimeDps,
  parseExamine,
  petValetPicks,
  pickSpellTable,
  plannedSetAllows,
  procScore,
  raceUnlockOrder,
  readArchivedHistory,
  reincarnationClimbs,
  respawnAlertAt,
  resizeFraction,
  routeTo,
  searchAchievements,
  searchArchivedFights,
  skillRows,
  spareNames,
  spellLoadout,
  unlockProgress,
  valetPicks,
  voidMoteRank,
  wikiContribution,
  wikiGaps
} from '@shared/worth'

const SAMPLE_LOOT = [
  { item: 'Bone Chips', count: 2, last: 10 },
  { item: 'Rusty Dagger', count: 5, last: 3 }
]

/** The New tools tab. Every figure on this page is the shipped function, not a label. */
export default function WorthView(): JSX.Element {
  const [lead, setLead] = useState(30)
  const [panel, setPanel] = useState(0.5)
  const [sort, setSort] = useState<LootSortKey>('count')
  const [signedIn, setSignedIn] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const figures = useMemo(() => demo(), [])
  const loot = sortLootRows(SAMPLE_LOOT, sort)
  const upload = lootUpload(2, signedIn)
  const sent = macroSend('/pause', confirmed)
  const split = resizeFraction(panel, 0, 1000, 120)
  return (
    <Stack spacing={1.5} data-testid="worth-view" sx={{ p: 2 }}>
      <Typography variant="h6">New tools</Typography>
      <Line id="worth-aa" text={`AA shortfall ${figures.aa.shortfall}, ETA ${figures.aa.etaHours}`} />
      <Line id="worth-races" text={figures.races} />
      <Line id="worth-reincarnation" text={`Climb ${figures.climbMs} ms`} />
      <Line id="worth-effects" text={`Proc ${figures.proc}, endurance ${figures.endurance}, temporary allowed ${figures.temporary}`} />
      <Line id="worth-dps" text={`Own-time DPS ${figures.dps}`} />
      <Line id="worth-zones" text={figures.zone} />
      <Line id="worth-quest" text={figures.quest} />
      <Line id="worth-bis" text={`Best ${figures.best}, valet ${figures.valet}`} />
      <Line id="worth-void" text={`Mote ${figures.mote}`} />
      <Line id="worth-gaps" text={figures.gaps} />
      <Line id="worth-achievements" text={figures.achievements} />
      <Line id="worth-unlocks" text={figures.unlocks} />
      <Line id="worth-skills" text={figures.skills} />
      <Line id="worth-plan" text={figures.plan} />
      <Line id="worth-loadout" text={`Yours ${figures.loadout.yours}, pet ${figures.loadout.pet}`} />
      <Line id="worth-upgrades" text={`Next mote ${figures.moteSpell}`} />
      <Line id="worth-tags" text={figures.tags} />
      <Line id="worth-tradeskill" text={figures.make ? 'Can make' : 'Cannot make'} />
      <Line id="worth-factions" text={figures.faction} />
      <Line id="worth-spare" text={figures.spare} />
      <Line id="worth-pet" text={figures.pet} />
      <Line id="worth-exalt" text={`Empty ${figures.exalt.empty.join(',')}`} />
      <Line id="worth-loc" text={`Loc ${figures.loc?.x},${figures.loc?.headingDeg}`} />
      <Line id="worth-route" text={figures.route ? 'Route ready' : 'Route blocked'} />
      <Line id="worth-crawl" text={figures.crawl} />
      <Line id="worth-ocr" text={`AC ${figures.examine.AC ?? 'missing'}`} />
      <Line id="worth-wiki" text={figures.wiki.status} />
      <Line id="worth-archive" text={`${figures.archive} log ${figures.history.logName}`} />
      <Line id="worth-hair" text={figures.hair} />
      <Line id="worth-scale" text={`Void ${figures.voidListed} / ${figures.voidRank}, accuracy ${figures.accuracyExplicit} vs ${figures.accuracyGenerated}`} />
      <Line id="worth-spells" text={figures.spellFile ?? 'none'} />
      <Typography data-testid="worth-alert">Alert at {respawnAlertAt(120_000, lead)}</Typography>
      <Button data-testid="worth-lead" onClick={() => setLead(15)}>15 second lead</Button>
      <Typography data-testid="worth-split">Split {split}</Typography>
      <Button data-testid="worth-widen" onClick={() => setPanel(resizeFraction(panel, 100, 1000, 120))}>Widen combat panel</Button>
      <Button data-testid="loot-col-item" onClick={() => setSort('item')}>Item</Button>
      <Typography data-testid="worth-loot-order">{loot.map((row) => row.item).join(', ')}</Typography>
      <Button data-testid="worth-signin" onClick={() => setSignedIn(true)}>Sign in to send loot</Button>
      <Typography data-testid="worth-upload">{upload.send ? `Send ${upload.count}` : 'Not sending'}</Typography>
      <Button data-testid="worth-macro" onClick={() => setConfirmed(true)}>Send macro</Button>
      <Typography data-testid="worth-macro-result">{sent.written ? sent.body : 'Held'}</Typography>
    </Stack>
  )
}

function questLine(): string {
  const page = [
    "! '''Starts In:''' [[East Freeport]]",
    '= Talk to the guard =',
    '== Summary ==',
    '* Hail the guard'
  ].join('\n')
  const parsed = parseQuestPage('A small errand', page)
  const steps = extractSteps(page)
  return `Starts in ${parsed.startsIn ?? 'missing'}: ${steps.join('; ')}`
}

function Line({ id, text }: { id: string; text: string }): JSX.Element {
  return <Box data-testid={id}>{text}</Box>
}

function demo() {
  const items = [
    { name: 'Rust', slot: 'Primary', score: 1, classes: ['WAR'], owned: true },
    { name: 'Steel', slot: 'Primary', score: 5, classes: ['WAR'], owned: true }
  ]
  const player = valetPicks(items)
  const history = readArchivedHistory({ count: 1 }, [{ count: 2 }], true, 'eqlog_Zarzac.txt')
  return {
    aa: aaPlan({
      catalog: [{ id: 'bash', name: 'Bash', maxRank: 3, costPerRank: 2 }],
      held: { bash: 1 },
      targets: { bash: 3 },
      unspent: 1,
      pointsLast24h: 24
    }),
    races: raceUnlockOrder([
      { race: 'Elf', have: 1, need: 5, factions: [{ name: 'Felwithe', fastest: 'hails' }] },
      { race: 'Dwarf', have: 4, need: 5, factions: [] }
    ]).map((row) => row.race).join(', '),
    climbMs: reincarnationClimbs([
      { kind: 'reincarnation', ts: 0 },
      { kind: 'level', ts: 5000, level: 50 }
    ])[0]?.ms ?? -1,
    proc: procScore(120, 0, 1),
    endurance: enduranceScore(20, true),
    temporary: String(plannedSetAllows(true)),
    dps: ownTimeDps(100, 4),
    zone: zoneShortName('Nektropos Castle') ?? 'missing',
    quest: questLine(),
    best: bestInSlot(items).get('Primary')?.name ?? 'none',
    valet: player.get('Primary')?.name ?? 'none',
    mote: voidMoteRank([{ name: 'Ring', gain: 2, hoursToReplace: 4 }])[0]?.name ?? 'none',
    gaps: wikiGaps(['New Helm'], ['Old Helm']).join(', '),
    achievements: searchAchievements([{ group: 'Slayer', name: 'Orc' }], 'orc').map((row) => row.name).join(', '),
    unlocks: unlockProgress([{ family: 'race', label: 'Elf', have: 1, need: 3 }]).map((row) => `${row.label} ${row.remaining}`).join(', '),
    skills: skillRows([{ skill: 'Baking', level: 12, ts: 1 }, { skill: 'Baking', level: 15, ts: 2 }]).map((row) => `${row.skill} ${row.level}`).join(', '),
    plan: gearProgression([{ name: 'Crushbone', minLevel: 5, maxLevel: 15, role: 'dps' }], 10, 'dps').join(', '),
    loadout: spellLoadout([
      { name: 'Courage', stat: 'hp', amount: 40, pet: false },
      { name: 'Pet Heal', stat: 'hp', amount: 10, pet: true }
    ], 'hp'),
    moteSpell: nextMote([{ name: 'Bolt', moteGain: 3 }, { name: 'Shield', moteGain: 1 }]),
    tags: lootTags({ tradeskill: true, quest: true }).join(', '),
    make: canMakeRecipe({ skill: 'Baking', trivial: 15 }, { Baking: 20 }, true),
    faction: factionStandings([{ name: 'Guards', base: 0, adjusted: 100 }]).map((row) => `${row.name} ${row.delta}`).join(', '),
    spare: spareNames(items).join(', '),
    pet: petValetPicks(items, player).get('Primary')?.name ?? 'none',
    exalt: exaltAudit([{ slot: 'Head', stone: null, wants: ['Focus'] }]),
    loc: followLoggedLoc([{ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 1 }]),
    route: routeTo({ x: 0, y: 0 }, { x: 4, y: 0 }, () => false) !== null,
    crawl: crawlMarks(['a bat'], ['a bat']).map((row) => `${row.name} ${row.cleared}`).join(', '),
    examine: parseExamine('AC: 12'),
    wiki: wikiContribution({ title: 'A bat', fact: 'Drops a bone.', confirmed: false }),
    archive: searchArchivedFights([{ id: '1', name: 'a bat', zone: 'qeynos', startTs: 5 }], 'bat').map((row) => row.name).join(', '),
    history,
    hair: hangPoint('HUM_ACTORDEF', 'HAIR_POINT'),
    voidListed: voidAtTier(4, { full: 2, fraction: 0 }, true),
    voidRank: voidAtTier(undefined, { full: 2, fraction: 0 }, true),
    accuracyExplicit: scaleAccuracy(10, { full: 2, fraction: 0 }, 'explicit'),
    accuracyGenerated: scaleAccuracy(10, { full: 2, fraction: 0 }, 'generated'),
    spellFile: pickSpellTable(['spells_de.txt', 'spells_us.txt', 'spells_de_str.txt'])
  }
}
