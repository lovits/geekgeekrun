import { ipcMain } from 'electron'
import {
  createBrowserAssistantWindow
} from '../window/browserAssistantWindow'

export async function configWithBrowserAssistant({ windowOption, autoFind }: { windowOption?: Electron.BrowserWindowConstructorOptions; autoFind?: boolean } = {}) {
  return new Promise((resolve, reject) => {
    const win = createBrowserAssistantWindow({ ...windowOption }, { autoFind })

    let processDone = false
    function handler() {
      processDone = true
      win.close()
    }
    ipcMain.once('browser-config-saved', handler)
    win.once('closed', () => {
      ipcMain.off('browser-config-saved', handler)
      if (processDone) {
        resolve(true)
      } else {
        reject(new Error('USER_CANCELLED_CONFIG_BROWSER'))
      }
    })
  })
}
