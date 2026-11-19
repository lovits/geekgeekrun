import { BrowserWindow } from 'electron'

export async function openResumePreview(file: string, name: string, parent: BrowserWindow) {
  const preview = new BrowserWindow({
    title: `简历预览 · ${name}`,
    width: 900,
    height: 780,
    minWidth: 540,
    minHeight: 420,
    resizable: true,
    parent,
    autoHideMenuBar: true,
    webPreferences: { sandbox: true, plugins: true, nodeIntegration: false, contextIsolation: true }
  })
  preview.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  try { await preview.loadFile(file) }
  catch { preview.destroy(); throw new Error('PDF预览失败，请重新导入原始文件') }
}
