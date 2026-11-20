import overrideConsole from './utils/overrideConsole'
import minimist from 'minimist'
import { runCommon } from './features/run-common'
import { launchDaemon } from './flow/OPEN_SETTING_WINDOW/launch-daemon'
import { app } from 'electron'
import path from 'node:path'

// Keep the existing app data directory when the display name changes.
if (app.isPackaged && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(app.getPath('appData'), 'GeekGeekRun Pro'))
}

const isUiDev = process.env.NODE_ENV === 'development'
const enableLogToFile = process.env.GEEKGEEKRUN_ENABLE_LOG_TO_FILE === String(1)
if (isUiDev || enableLogToFile) {
  overrideConsole()
}
console.log('NODE_ENV:', process.env.NODE_ENV)

// 捕获未处理的 EPIPE 错误
process.on('uncaughtException', (err) => {
  if ((err as NodeJS.ErrnoException)?.code === 'EPIPE' || (err as NodeJS.ErrnoException)?.code === 'ERR_STREAM_DESTROYED') {
    return
  }
  throw err
})

console.log('argv:', process.argv)
const commandlineArgs = minimist(isUiDev ? process.argv.slice(2) : process.argv.slice(1))
console.log('parsed commandline args:', commandlineArgs)

const runMode = commandlineArgs['mode']

;(async () => {
  switch (runMode) {
    case 'verifyBossFilters': {
      await app.whenReady()
      app.dock?.hide()
      const { getLastUsedAndAvailableBrowser } = await import('./flow/DOWNLOAD_DEPENDENCIES/utils/browser-history')
      const executable = await getLastUsedAndAvailableBrowser()
      if (!executable) throw new Error('未配置可用的招聘浏览器')
      process.env.PUPPETEER_EXECUTABLE_PATH = executable.executablePath
      const { mainLoop } = await import('@geekgeekrun/geek-auto-start-chat-with-boss/index.mjs')
      try {
        const result = await mainLoop({
          userInfoResponse: {
            promise: async ({ userInfoResponse }) => console.log('FILTER_CHECK_LOGIN', JSON.stringify({
              code: userInfoResponse?.code,
              message: userInfoResponse?.message
            }))
          }
        }, { filterCheckOnly: true })
        console.log('FILTER_CHECK_RESULT', JSON.stringify(result))
      } catch (error) {
        console.error('FILTER_CHECK_FAILED', error instanceof Error ? error.message : String(error))
      }
      break
    }
    // #region internal use
    case 'geekAutoStartWithBossMain':
    case 'geekSimulateApplications': {
      const { waitForProcessHandShakeAndRunAutoChat } = await import(
        './flow/GEEK_AUTO_START_CHAT_WITH_BOSS_MAIN/index'
      )
      waitForProcessHandShakeAndRunAutoChat()
      break
    }
    case 'downloadDependenciesForInit': {
      const { downloadDependenciesForInit } = await import('./flow/DOWNLOAD_DEPENDENCIES/index')
      downloadDependenciesForInit()
      break
    }
    case 'launchBossZhipinLoginPageWithPreloadExtension': {
      const { launchBossZhipinLoginPageWithPreloadExtension } = await import(
        './flow/LAUNCH_BOSS_ZHIPIN_LOGIN_PAGE_WITH_PRELOAD_EXTENSION'
      )
      launchBossZhipinLoginPageWithPreloadExtension()
      break
    }
    case 'launchBossSite': {
      const { launchBossSite } = await import('./flow/LAUNCH_BOSS_SITE')
      launchBossSite()
      break
    }
    case 'readNoReplyAutoReminderMain': {
      const { runEntry } = await import('./flow/READ_NO_REPLY_AUTO_REMINDER_MAIN/index')
      runEntry()
      break
    }
    case 'launchDaemon': {
      await import('./flow/LAUNCH_DAEMON')
      break
    }
    // #endregion

    // #region user entry
    case 'geekAutoStartWithBoss': {
      app.dock?.hide()
      await launchDaemon()
      const { isAlreadyRunning } = await runCommon({ mode: 'geekAutoStartWithBossMain' })
      if (isAlreadyRunning) {
        process.exit(0)
      }
      break
    }
    case 'readNoReplyAutoReminder': {
      app.dock?.hide()
      await launchDaemon()
      const { isAlreadyRunning } = await runCommon({ mode: 'readNoReplyAutoReminderMain' })
      if (isAlreadyRunning) {
        process.exit(0)
      }
      break
    }
    default: {
      globalThis.GEEKGEEKRUN_PROCESS_ROLE = 'ui'
      await launchDaemon()
      const { openSettingWindow } = await import('./flow/OPEN_SETTING_WINDOW/index')
      openSettingWindow()
      break
    }
    // #region
  }
})()
