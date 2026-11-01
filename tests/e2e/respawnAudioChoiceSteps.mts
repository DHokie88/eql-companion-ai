import type { Page } from 'playwright-core'
import { check, settle } from './appHarness.mjs'

interface AudioEvent {
  volume: number
  dataBase64: string
}
interface AudioProbe {
  timerAudioEvents: AudioEvent[]
  timerAudioBlobs: Map<string, Blob>
  originalTimerCreateURL: typeof URL.createObjectURL
  originalTimerPlay: typeof HTMLMediaElement.prototype.play
}
export const SELECTED_SOUND = 'task-acknowledge-blip-03'
export async function installTimerAudioProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probe = window as unknown as AudioProbe
    probe.timerAudioEvents = []
    probe.originalTimerPlay = HTMLMediaElement.prototype.play
    probe.timerAudioBlobs = new Map()
    probe.originalTimerCreateURL = URL.createObjectURL
    URL.createObjectURL = (object: Blob | MediaSource): string => {
      const url = probe.originalTimerCreateURL(object)
      if (object instanceof Blob) probe.timerAudioBlobs.set(url, object)
      return url
    }
    HTMLMediaElement.prototype.play = async function (): Promise<void> {
      const blob = probe.timerAudioBlobs.get(this.src)
      if (!blob) throw new Error('Timer test did not capture the sound Blob')
      const buffer = await blob.arrayBuffer()
      const dataBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
      probe.timerAudioEvents.push({ volume: this.volume, dataBase64 })
    }
  })
}
export function readTimerAudio(page: Page): Promise<AudioEvent[]> {
  return page.evaluate(() => (window as unknown as AudioProbe).timerAudioEvents)
}
export async function resetTimerAudio(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(window as unknown as AudioProbe).timerAudioEvents = []
  })
}
export async function restoreTimerAudio(page: Page): Promise<void> {
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = (window as unknown as AudioProbe).originalTimerPlay
    URL.createObjectURL = (window as unknown as AudioProbe).originalTimerCreateURL
  })
}
export async function assertTimerSound(
  page: Page,
  event: AudioEvent | undefined,
  label: string
): Promise<void> {
  const expected = await page.evaluate(
    (sound) => window.eq.getSoundData('eq-zera-console', sound),
    SELECTED_SOUND
  )
  check(`${label} uses the selected WAV`, !!expected && event?.dataBase64 === expected.dataBase64)
  check(
    `${label} multiplies timer volume by Alerts master volume`,
    event !== undefined && Math.abs(event.volume - 0.245) < 0.000001,
    String(event?.volume)
  )
}
/** Preview operates on the unsaved draft; save and reopen must preserve both controls. */
export async function stepChooseTimerSound(page: Page, row: string, mob: string): Promise<void> {
  await installTimerAudioProbe(page)
  await page.locator('[data-testid="respawn-audio-picker"] [role="combobox"]').nth(1).click()
  await page.locator(`[role="option"][data-value="${SELECTED_SOUND}"]`).click()
  const slider = page.locator('[data-testid="respawn-audio-volume"] input')
  await slider.focus()
  await slider.press('Home')
  for (let i = 0; i < 7; i++) await slider.press('ArrowRight')
  await page.click('[data-testid="respawn-audio-test"]')
  const preview = await settle(
    () => readTimerAudio(page),
    (events) => events.length > 0
  )
  await assertTimerSound(page, preview[0], 'Unsaved Test sound')
  const beforeSave = await page.evaluate(() => window.eq.getRespawnAudio())
  check('preview leaves the saved sound untouched', beforeSave[mob]?.sound === undefined)
  await page.click('[data-testid="respawn-audio-save"]')
  const saved = await page.evaluate(() => window.eq.getRespawnAudio())
  check(
    'selected sound and timer volume persist through IPC',
    saved[mob]?.sound?.soundId === SELECTED_SOUND && saved[mob]?.volume === 0.35
  )
  await page.click(`${row} [data-testid="respawn-audio"]`)
  await page.locator('[data-testid="respawn-audio-picker"] [role="combobox"]').nth(1).waitFor()
  check(
    'sound reopens with the saved selection',
    (
      await page
        .locator('[data-testid="respawn-audio-picker"] [role="combobox"]')
        .nth(1)
        .innerText()
    ).includes('Pop')
  )
  check(
    'volume reopens with the saved setting',
    (await page.locator('[data-testid="respawn-audio-volume"] input').inputValue()) === '0.35'
  )
  await resetTimerAudio(page)
}
