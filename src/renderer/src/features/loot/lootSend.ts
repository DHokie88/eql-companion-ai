import { lootUpload, parseExamine } from '../../../../shared/worth'

/** Loot leaves the machine only when a player is signed in and there is something to send. */
export function lootMaySend(count: number, signedIn: boolean): { send: boolean; count: number } {
  return lootUpload(count, signedIn)
}

/** Numbers an examine window stated, such as `AC: 12`. */
export function examineNumbers(text: string | undefined): Record<string, number> {
  return parseExamine(text ?? '')
}
