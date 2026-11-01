import { cpSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildIfStale, check, failures, dumpArtifacts, reportRun } from './appHarness.mjs'
import { mainWindow, makeUserData, removeUserData } from './appWindow.mjs'
import { launchOnFixture } from './logFixture.mjs'
import { stepRespawnAudio } from './respawnAudioSteps.mjs'

async function main(): Promise<void> {
  buildIfStale()
  const userData = makeUserData()
  mkdirSync(join(userData, 'soundpacks'), { recursive: true })
  cpSync(
    join(process.cwd(), 'resources', 'soundpacks', 'eq-zera-console'),
    join(userData, 'soundpacks', 'eq-zera-console'),
    { recursive: true }
  )
  const launched = await launchOnFixture('e2e-leveling.log', { userData })
  const page = await mainWindow(launched.app)
  try {
    await page.waitForSelector('[data-testid="nav-timers"]', { timeout: 60000 })
    await page.click('[data-testid="nav-timers"]')
    await page.evaluate(() =>
      window.eq.setRespawn({
        watches: [{ key: 'a wan ghoul knight', display: 'a wan ghoul knight', customSec: 180 }]
      })
    )
    launched.log.append('You have entered Befallen.', 'You have slain a wan ghoul knight!')
    await page.waitForSelector(
      '[data-testid="respawn-row"][data-respawn-mob="a wan ghoul knight"]',
      { timeout: 30000 }
    )
    await stepRespawnAudio(page, launched.log, 'a wan ghoul knight', launched.app)
    if (failures.length) {
      console.log(
        'audio debug',
        JSON.stringify(
          await page.evaluate(async () => ({
            prefs: await window.eq.getRespawnAudio(),
            watches: await window.eq.getRespawn(),
            packs: await window.eq.listSoundPacks(),
            snap: await window.eq.getModuleSnapshot('respawn'),
            plays: (window as unknown as { timerAudioEvents: unknown[] }).timerAudioEvents
          }))
        )
      )
      await dumpArtifacts(page, 'respawn-audio-FAIL')
    }
    check('timer audio test completed', true)
  } finally {
    await launched.close()
    await launched.log.dispose()
    await removeUserData(userData)
  }
  reportRun()
}
main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
