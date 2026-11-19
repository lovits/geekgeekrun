import { ipcMain } from 'electron'
import {
  createBrowserDownloadProgressWindow
} from '../window/browserDownloadProgressWindow'

export async function openBrowserDownloadWindow({ windowOption }: { windowOption?: Electron.BrowserWindowConstructorOptions } = {}) {
  return new Promise<string | null>((resolve, reject) => {
    const win = createBrowserDownloadProgressWindow({ ...windowOption })

    let processDone = false
    let pathOfDownloadedBrowser: string | null = null
    function handler(_, executablePath) {
      pathOfDownloadedBrowser = executablePath
      processDone = true
      win.close()
    }
    ipcMain.once('browser-download-done', handler)
    win.once('closed', () => {
      ipcMain.off('browser-download-done', handler)
      if (processDone) {
        resolve(pathOfDownloadedBrowser)
      } else {
        reject(new Error('USER_CANCELLED_CONFIG_BROWSER'))
      }
    })
  })
}
