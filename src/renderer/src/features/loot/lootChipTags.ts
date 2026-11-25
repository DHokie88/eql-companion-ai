import { lootTags } from '../../../../shared/worth'

/** Chip words for a loot row. The donor tag list is the source; the table prints them in lower case. */
export function knowledgeTags(flags: { quest?: boolean; tradeskill?: boolean; noDrop?: boolean }): string[] {
  return lootTags(flags).map((tag) => tag.toLowerCase())
}
