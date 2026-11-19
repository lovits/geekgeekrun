import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import gtag from './gtag'
import { projectUrl } from '@geekgeekrun/utils/project-links.mjs'
import buildInfo from '../../common/build-info.json'
import os from 'node:os'
import fs from 'node:fs'
import {
  ensureStorageFileExist,
  writeStorageFile,
  configFileNameList,
  readConfigFile,
  readStorageFile,
  writeConfigFile
} from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'

import { registerBrowserAssistantIpc } from '../window/browserAssistantWindow'

export default function initPublicIpc() {
  registerBrowserAssistantIpc()
  ipcMain.handle('save-common-job-condition-config', async (event, payload, { embedded = false } = {}) => {
    await writeConfigFile('common-job-condition-config.json', payload)
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send('common-job-condition-config-updated', { config: payload })
    if (!embedded) BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.on(
    'update-window-size',
    (
      ev,
      size: {
        width: number
        height: number
        animate?: boolean
      }
    ) => {
      const win = BrowserWindow.fromWebContents(ev.sender)
      if (!win) {
        return
      }
      win.setMinimumSize(size.width, size.height)
      win.setSize(size.width, size.height, size.animate)
    }
  )
  ipcMain.on('open-external-link', (_, link) => {
    shell.openExternal(link, {
      activate: true
    })
  })
  ipcMain.on('gtag', (_ev, { name, params } = {}) => {
    gtag(name, {
      ...params,
      electron_log_source: 'renderer'
    })
  })
  ipcMain.on('send-feed-back-to-github-issue', (_ev, _payload) => {
    const getIssueUrlWithBody = (issueBody: string = '') => {
      const baseUrl = `${projectUrl}/issues/new`
      issueBody = issueBody || ''
      if (!issueBody || !issueBody.trim()) {
        return baseUrl
      }
      const urlObj = new URL(baseUrl)
      urlObj.searchParams.append('body', issueBody)

      return urlObj.toString()
    }

    shell.openExternal(
      getIssueUrlWithBody(`\n\n\n-----
版本号：${buildInfo.version}(${buildInfo.buildVersion})
提交：${buildInfo.buildHash.substring(0, 6)}
操作系统信息: \`${os.type()}\` / \`${os.release()}\` / \`${os.arch()}\``),
      {
        activate: true
      }
    )
  })

  ipcMain.handle('read-storage-file', async (_ev, payload) => {
    ensureStorageFileExist()
    return await readStorageFile(payload.fileName)
  })

  ipcMain.handle('write-storage-file', async (_ev, payload) => {
    ensureStorageFileExist()
    return await writeStorageFile(payload.fileName, JSON.parse(payload.data))
  })
  ipcMain.handle('get-os-platform', () => {
    return os.platform()
  })
  ipcMain.handle('choose-file', (ev, { fileChooserConfig }) => {
    if (!fileChooserConfig) {
      fileChooserConfig = {}
    }
    const win = BrowserWindow.fromWebContents(ev.sender)
    if (!win) {
      return dialog.showOpenDialog(fileChooserConfig)
    } else {
      return dialog.showOpenDialog(win, fileChooserConfig)
    }
  })
  ipcMain.handle('check-executable-file', (_ev, filePath: string) => {
    if (!filePath?.trim()) {
      return {
        message: '文件名无效'
      }
    }
    if (!fs.existsSync(filePath)) {
      return {
        message: '文件不存在'
      }
    }
    if (!fs.statSync(filePath).isFile()) {
      const messageSeg = ['文件不是可执行文件']
      if (os.platform() === 'darwin') {
        messageSeg.push(
          'macOS 平台，可执行文件位于“App包.app/Contents/MacOS/ 文件夹下”，而不是“App包.app”文件夹整体'
        )
      }
      return {
        message: messageSeg.join('；')
      }
    }
    return null
  })

  ipcMain.handle('fetch-config-file-content', async () => {
    const configFileContentList = configFileNameList.map((fileName) => {
      return readConfigFile(fileName)
    })
    const result = {
      config: {}
    }

    configFileNameList.forEach((fileName, index) => {
      result.config[fileName] = configFileContentList[index]
    })

    return result
  })
}
