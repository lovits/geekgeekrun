import { ipcMain } from 'electron'
import { createCookieAssistantWindow } from '../window/cookieAssistantWindow';

export async function loginWithCookieAssistant({ windowOption }: { windowOption?: Electron.BrowserWindowConstructorOptions } = {}) {
  return new Promise((resolve, reject) => {
    const win = createCookieAssistantWindow({ ...windowOption })

    let processDone = false
    function handler() {
      processDone = true
      win.close()
    }
    ipcMain.once('cookie-saved', handler)
    win.once('closed', () => {
      ipcMain.off('cookie-saved', handler)
      if (processDone) {
        resolve(true)
      } else {
        reject(new Error('USER_CANCELLED_LOGIN'))
      }
    })
  })
}
