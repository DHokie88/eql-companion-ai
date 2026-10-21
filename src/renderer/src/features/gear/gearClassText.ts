import type { ClassAbbr } from '../../../../shared/classCombo'

const CLASS_GROUPS: readonly { label: string; members: readonly ClassAbbr[] }[] = [
  { label: 'Tanks', members: ['WAR', 'PAL', 'SHD'] },
  { label: 'Casters', members: ['WIZ', 'ENC', 'NEC', 'MAG'] }
]

/** Compact only complete groups; every remaining class keeps its original position. */
export function gearClassText(classes: readonly ClassAbbr[]): { tokens: string[]; lines: string[]; compact: boolean } {
  if (classes.length === 0) return { tokens: [], lines: [], compact: false }
  if (classes.length >= 16) return { tokens: ['ALL'], lines: ['ALL'], compact: false }

  const groups = CLASS_GROUPS.filter(({ members }) => members.every((member) => classes.includes(member)))
  const tokens: string[] = []
  for (const member of classes) {
    const group = groups.find(({ members }) => members.includes(member))
    if (group === undefined) tokens.push(member)
    else if (!tokens.includes(group.label)) tokens.push(group.label)
  }
  const compact = tokens.length > 4
  const split = Math.ceil(tokens.length / 2)
  const lines = compact
    ? [tokens.slice(0, split).join(' '), tokens.slice(split).join(' ')]
    : [tokens.join(' ')]
  return { tokens, lines, compact }
}
