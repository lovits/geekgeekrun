import { readJobFeedback, saveJobFeedback } from '@geekgeekrun/utils/job-feedback.mjs'
import { hasConfiguredLlm, learnJobPreferences } from '@geekgeekrun/utils/job-feedback-learning.mjs'
import { codexContextLimits, validateContextWindow } from '@geekgeekrun/utils/codex-context.mjs'
import fs from 'node:fs/promises'
import { exportScopes, normalizeExportOptions, selectExportRecords, recordsToCsv } from '@geekgeekrun/utils/runtime-export.mjs'
import { resumeDocumentPath, saveResumeDocument } from '@geekgeekrun/utils/resume-document.mjs'
import { recentScoreExamples } from '@geekgeekrun/utils/score-examples.mjs'
import { registerApplicationSimulation, readDisplayedSimulation } from '../../../features/application-simulation'
import { readOnlineSimulation, onlineSimulationRunning } from '@geekgeekrun/utils/online-application-simulation.mjs'
import { openResumePreview } from '../../../window/resumePreviewWindow'
import { listCodexModels } from '@geekgeekrun/utils/codex-models.mjs'
import { buildJobMatchContext } from '@geekgeekrun/utils/job-match-context.mjs'
import filterCatalog from '@geekgeekrun/geek-auto-start-chat-with-boss/internal-config/job-filter-conditions-20241002.json'
import { jobFilterOptions, matchInputSources, hasRequiredMatchInputs, mergeJobFilterSettings } from '@geekgeekrun/utils/job-filter-options.mjs'
import { parseResumeFile, parseResumeWithAi } from '@geekgeekrun/utils/resume-ai-parser.mjs'
import { defaultJobPreferences, defaultMatchPrompt, jobMatchSystemPrompt, matchingPayload, matchJobWithResume } from '@geekgeekrun/utils/ai-job-match.mjs'
import { codexStatus, codexCompletion, resolveCodexBinary } from '@geekgeekrun/utils/codex-request.mjs'
import { ipcMain, shell, app, dialog, BrowserWindow } from 'electron'
import path from 'path'
import * as childProcess from 'node:child_process'
import {
  readConfigFile,
  writeConfigFile,
  readStorageFile,
  storageFilePath
} from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'
import { ChildProcess } from 'child_process'
import * as JSONStream from 'JSONStream'
import { checkCookieListFormat } from '../../../../common/utils/cookie'
import { getAnyAvailablePuppeteerExecutable } from '../../DOWNLOAD_DEPENDENCIES/utils/puppeteer-executable/index'
import { mainWindow } from '../../../window/mainWindow'
import {
  getAutoStartChatRecord,
  getBossLibrary,
  getCompanyLibrary,
  getJobLibrary,
  getJobHistoryByEncryptId,
  getMarkAsNotSuitRecord,
  exportRuntimeData
} from '../utils/db/index'
import { PageReq } from '../../../../common/types/pagination'
import { pipeWriteRegardlessError } from '../../utils/pipe'
import { WriteStream } from 'node:fs'
// eslint-disable-next-line vue/prefer-import-from-vue
import { hasOwn } from '@vue/shared'
import { createLlmConfigWindow, llmConfigWindow } from '../../../window/llmConfigWindow'
import { createResumeEditorWindow, resumeEditorWindow } from '../../../window/resumeEditorWindow'
import {
  getValidTemplate,
  requestNewMessageContent
} from '../../READ_NO_REPLY_AUTO_REMINDER_MAIN/boss-operation'
import {
  defaultPromptMap,
  writeDefaultAutoRemindPrompt
} from '../../READ_NO_REPLY_AUTO_REMINDER_MAIN/boss-operation'
import {
  checkIsResumeContentValid,
  resumeContentEnoughDetect
} from '../../../../common/utils/resume'
import {
  createReadNoReplyReminderLlmMockWindow,
  readNoReplyReminderLlmMockWindow
} from '../../../window/readNoReplyReminderLlmMockWindow'
import { RequestSceneEnum } from '../../../features/llm-request-log'
import { checkUpdateForUi } from '../../../features/updater'
import gtag from '../../../utils/gtag'
import { daemonEE, sendToDaemon } from '../connect-to-daemon'
import { runCommon } from '../../../features/run-common'
import { loginWithCookieAssistant } from '../../../features/login-with-cookie-assistant'
import { configWithBrowserAssistant } from '../../../features/config-with-browser-assistant'
import {
  createFirstLaunchNoticeApproveFlag,
  isFirstLaunchNoticeApproveFlagExist,
  waitForUserApproveAgreement
} from '../../../features/first-launch-notice-window'
import { getLastUsedAndAvailableBrowser } from '../../DOWNLOAD_DEPENDENCIES/utils/browser-history'
import { waitForCommonJobConditionDone } from '../../../features/common-job-condition'
import { ensureConfigFileExist } from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'

export default function initIpc() {
  registerApplicationSimulation()
  ipcMain.handle('save-config-file-from-ui', async (_ev, payload) => {
    payload = JSON.parse(payload)
    ensureConfigFileExist()

    const promiseArr: Array<Promise<unknown>> = []

    const dingtalkConfig = readConfigFile('dingtalk.json')
    if (hasOwn(payload, 'dingtalkRobotAccessToken')) {
      dingtalkConfig.groupRobotAccessToken = payload.dingtalkRobotAccessToken
    }
    promiseArr.push(writeConfigFile('dingtalk.json', dingtalkConfig))

    const bossConfig = readConfigFile('boss.json')
    if (hasOwn(payload, 'expectEmploymentType')) {
      if (![0, 1901, 1902, 1903].includes(payload.expectEmploymentType)) {
        throw new Error('无效的求职类型配置')
      }
      bossConfig.expectEmploymentType = payload.expectEmploymentType
    }
    if (hasOwn(payload, 'anyCombineRecommendJobFilter')) {
      bossConfig.anyCombineRecommendJobFilter = payload.anyCombineRecommendJobFilter
    }
    delete bossConfig.expectJobRegExpStr
    if (hasOwn(payload, 'expectJobNameRegExpStr')) {
      bossConfig.expectJobNameRegExpStr = payload.expectJobNameRegExpStr
    }
    if (hasOwn(payload, 'expectJobTypeRegExpStr')) {
      bossConfig.expectJobTypeRegExpStr = payload.expectJobTypeRegExpStr
    }
    if (hasOwn(payload, 'expectJobDescRegExpStr')) {
      bossConfig.expectJobDescRegExpStr = payload.expectJobDescRegExpStr
    }
    if (hasOwn(payload, 'jobNotMatchStrategy')) {
      bossConfig.jobNotMatchStrategy = payload.jobNotMatchStrategy
    }
    if (hasOwn(payload, 'markAsNotActiveSelectedTimeRange')) {
      bossConfig.markAsNotActiveSelectedTimeRange = payload.markAsNotActiveSelectedTimeRange
    }
    if (hasOwn(payload, 'jobNotActiveStrategy')) {
      bossConfig.jobNotActiveStrategy = payload.jobNotActiveStrategy
    }
    if (hasOwn(payload, 'autoReminder')) {
      bossConfig.autoReminder = payload.autoReminder
    }

    // city
    if (hasOwn(payload, 'expectCityList')) {
      bossConfig.expectCityList = payload.expectCityList
    }
    if (hasOwn(payload, 'expectCityNotMatchStrategy')) {
      bossConfig.expectCityNotMatchStrategy = payload.expectCityNotMatchStrategy
    }
    if (hasOwn(payload, 'strategyScopeOptionWhenMarkJobCityNotMatch')) {
      bossConfig.strategyScopeOptionWhenMarkJobCityNotMatch =
        payload.strategyScopeOptionWhenMarkJobCityNotMatch
    }

    // salary
    if (hasOwn(payload, 'expectSalaryCalculateWay')) {
      bossConfig.expectSalaryCalculateWay = payload.expectSalaryCalculateWay
    }
    if (hasOwn(payload, 'expectSalaryNotMatchStrategy')) {
      bossConfig.expectSalaryNotMatchStrategy = payload.expectSalaryNotMatchStrategy
    }
    if (hasOwn(payload, 'strategyScopeOptionWhenMarkSalaryNotMatch')) {
      bossConfig.strategyScopeOptionWhenMarkSalaryNotMatch =
        payload.strategyScopeOptionWhenMarkSalaryNotMatch
    }
    if (hasOwn(payload, 'expectSalaryLow')) {
      bossConfig.expectSalaryLow = payload.expectSalaryLow
    }
    if (hasOwn(payload, 'expectSalaryHigh')) {
      bossConfig.expectSalaryHigh = payload.expectSalaryHigh
    }

    // work exp
    if (hasOwn(payload, 'expectWorkExpList')) {
      bossConfig.expectWorkExpList = payload.expectWorkExpList
    }
    if (hasOwn(payload, 'expectWorkExpNotMatchStrategy')) {
      bossConfig.expectWorkExpNotMatchStrategy = payload.expectWorkExpNotMatchStrategy
    }
    if (hasOwn(payload, 'strategyScopeOptionWhenMarkJobWorkExpNotMatch')) {
      bossConfig.strategyScopeOptionWhenMarkJobWorkExpNotMatch =
        payload.strategyScopeOptionWhenMarkJobWorkExpNotMatch
    }
    if (hasOwn(payload, 'jobDetailRegExpMatchLogic')) {
      bossConfig.jobDetailRegExpMatchLogic = payload.jobDetailRegExpMatchLogic
    }
    if (hasOwn(payload, 'isSkipEmptyConditionForCombineRecommendJobFilter')) {
      bossConfig.isSkipEmptyConditionForCombineRecommendJobFilter =
        payload.isSkipEmptyConditionForCombineRecommendJobFilter
    }
    if (hasOwn(payload, 'jobSourceList')) {
      bossConfig.jobSourceList = payload.jobSourceList
    }
    if (hasOwn(payload, 'combineRecommendJobFilterType')) {
      bossConfig.combineRecommendJobFilterType = payload.combineRecommendJobFilterType
    }
    if (hasOwn(payload, 'staticCombineRecommendJobFilterConditions')) {
      bossConfig.staticCombineRecommendJobFilterConditions =
        payload.staticCombineRecommendJobFilterConditions
    }
    if (hasOwn(payload, 'isSageTimeEnabled')) {
      bossConfig.isSageTimeEnabled = payload.isSageTimeEnabled
    }
    if (hasOwn(payload, 'sageTimeOpTimes')) {
      bossConfig.sageTimeOpTimes = payload.sageTimeOpTimes
    }
    if (hasOwn(payload, 'sageTimePauseMinute')) {
      bossConfig.sageTimePauseMinute = payload.sageTimePauseMinute
    }
    if (hasOwn(payload, 'blockCompanyNameRegExpStr')) {
      bossConfig.blockCompanyNameRegExpStr = payload.blockCompanyNameRegExpStr
    }
    if (hasOwn(payload, 'blockCompanyNameRegMatchStrategy')) {
      bossConfig.blockCompanyNameRegMatchStrategy = payload.blockCompanyNameRegMatchStrategy
    }
    if (hasOwn(payload, 'fieldsForUseCommonConfig')) {
      bossConfig.fieldsForUseCommonConfig = payload.fieldsForUseCommonConfig
    }

    promiseArr.push(writeConfigFile('boss.json', bossConfig))

    if (hasOwn(payload, 'expectCompanies')) {
      promiseArr.push(
        writeConfigFile('target-company-list.json', payload.expectCompanies?.split(',') ?? [])
      )
    }

    return await Promise.all(promiseArr)
  })

  ipcMain.handle('run-geek-auto-start-chat-with-boss', async (_ev) => {
    if (onlineSimulationRunning(await readOnlineSimulation())) throw new Error('在线模拟正在运行，请先停止在线模拟后再启动真实开聊')
    const mode = 'geekAutoStartWithBossMain'
    const { runRecordId } = await runCommon({ mode })
    daemonEE.on('message', function handler(message) {
      if (message.workerId !== mode) {
        return
      }
      if (message.type === 'worker-exited') {
        mainWindow?.webContents.send('worker-exited', message)
      }
    })
    return { runRecordId }
  })

  ipcMain.handle('run-read-no-reply-auto-reminder', async () => {
    const mode = 'readNoReplyAutoReminderMain'
    const { runRecordId } = await runCommon({ mode })
    daemonEE.on('message', function handler(message) {
      if (message.workerId !== mode) {
        return
      }
      if (message.type === 'worker-exited') {
        mainWindow?.webContents.send('worker-exited', message)
      }
    })
    return { runRecordId }
  })

  ipcMain.handle('stop-geek-auto-start-chat-with-boss', async () => {
    mainWindow?.webContents.send('geek-auto-start-chat-with-boss-stopping')
    const p = new Promise((resolve) => {
      daemonEE.on('message', function handler(message) {
        if (message.workerId !== 'geekAutoStartWithBossMain') {
          return
        }
        if (message.type === 'worker-exited') {
          daemonEE.off('message', handler)
          resolve(undefined)
        }
      })
    })
    await sendToDaemon(
      {
        type: 'stop-worker',
        workerId: 'geekAutoStartWithBossMain'
      },
      {
        needCallback: true
      }
    )

    await p
    mainWindow?.webContents.send('geek-auto-start-chat-with-boss-stopped')
  })

  ipcMain.handle('stop-read-no-reply-auto-reminder', async () => {
    mainWindow?.webContents.send('read-no-reply-auto-reminder-stopping')
    const p = new Promise((resolve) => {
      daemonEE.on('message', function handler(message) {
        if (message.workerId !== 'readNoReplyAutoReminderMain') {
          return
        }
        if (message.type === 'worker-exited') {
          daemonEE.off('message', handler)
          resolve(undefined)
        }
      })
    })
    await sendToDaemon(
      {
        type: 'stop-worker',
        workerId: 'readNoReplyAutoReminderMain'
      },
      {
        needCallback: true
      }
    )

    await p
    mainWindow?.webContents.send('read-no-reply-auto-reminder-stopped')
  })

  ipcMain.handle('get-task-manager-list', async () => {
    const result = await sendToDaemon(
      {
        type: 'get-status'
      },
      {
        needCallback: true
      }
    )
    return result
  })

  // IPC处理：停止工具进程
  ipcMain.handle('stop-task', async (_, workerId) => {
    await sendToDaemon(
      {
        type: 'stop-worker',
        workerId
      },
      {
        needCallback: true
      }
    )
  })

  ipcMain.handle('check-boss-zhipin-cookie-file', () => {
    const cookies = readStorageFile('boss-cookies.json')
    return checkCookieListFormat(cookies)
  })

  ipcMain.handle('get-job-feedback', async () => Object.fromEntries((await readJobFeedback()).map(item => [item.jobId, item.value])))
  ipcMain.handle('get-job-feedback-availability', async () => {
    const model = readConfigFile('llm.json')?.find(it => it.enabled)
    return hasConfiguredLlm(model) && (model.provider !== 'codex-cli' || (await codexStatus(model)).loggedIn)
  })
  let feedbackUpdate = Promise.resolve()
  ipcMain.handle('save-job-feedback', (_, payload) => {
    const operation = feedbackUpdate.catch(() => {}).then(async () => {
      if (typeof payload?.jobId !== 'string' || typeof payload.jobName !== 'string' || typeof payload.description !== 'string') throw new Error('岗位反馈缺少必要信息')
      const model = readConfigFile('llm.json')?.find(it => it.enabled)
      if (!hasConfiguredLlm(model) || (model.provider === 'codex-cli' && !(await codexStatus(model)).loggedIn)) throw new Error('请先配置并登录大模型，再使用偏好反馈')
      const records = await saveJobFeedback(payload)
      let learnedPreferences = '', warning = ''
      try { learnedPreferences = await learnJobPreferences(records, readConfigFile('job-ai-match.json')?.preferences || '', model) }
      catch { warning = '标记已保存，但模型未能更新全局偏好；旧的自动总结已清空，后续仍可参考原始反馈。' }
      await writeConfigFile('job-ai-match.json', { ...readConfigFile('job-ai-match.json'), learnedPreferences, feedbackLearnedAt: new Date().toISOString() })
      return { value: payload.value, learnedPreferences, warning }
    })
    feedbackUpdate = operation.then(() => {}, () => {})
    return operation
  })
  ipcMain.handle('export-runtime-data', async (_, requested = {}) => {
    const options = normalizeExportOptions(requested)
    const result = await exportRuntimeData() as any
    if (result.data?.exportError) throw new Error('读取运行数据失败，未导出')
    const feedback = await readJobFeedback()
    const simulation = options.scope === 'all' || options.scope === 'simulation' ? await readDisplayedSimulation() : null
    if (options.scope === 'simulation') result.data.simulation = simulation?.displayJobs || []
    const records = options.scope === 'all' ? null : selectExportRecords(result.data, options, feedback)
    if (records && !records.length) throw new Error('没有符合条件的记录，请调整筛选条件')
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
    const selection = await dialog.showSaveDialog(mainWindow!, { title: '导出' + exportScopes[options.scope].label, defaultPath: path.join(app.getPath('downloads'), `GeekGeekRun-${exportScopes[options.scope].label}-${today}.${options.format}`), filters: [{ name: options.format === 'csv' ? 'CSV 表格' : 'JSON 完整数据', extensions: [options.format] }] })
    if (selection.canceled || !selection.filePath) return null
    async function readOptional(name, lines = false) {
      try { const text = await fs.readFile(path.join(storageFilePath, name), 'utf8'); return lines ? text.split('\n').filter(Boolean).map(line => JSON.parse(line)) : JSON.parse(text) }
      catch (error: any) { if (error.code === 'ENOENT') return []; throw error }
    }
    const output = records ? { version: 1, exportedAt: new Date().toISOString(), scope: options.scope, filters: options.filters, recordCount: records.length, records } : { version: 1, exportedAt: new Date().toISOString(), database: result.data, simulation, feedback, matchingAudit: await readOptional('job-ai-match-audit.jsonl', true), scoreExamples: await readOptional('job-ai-score-examples.json'), learnedPreferences: readConfigFile('job-ai-match.json')?.learnedPreferences || '' }
    await fs.writeFile(selection.filePath, options.format === 'csv' ? recordsToCsv(records, options.scope) : JSON.stringify(output, null, 2), { mode: 0o600 })
    return { path: selection.filePath, scope: options.scope, count: records?.length, tables: Object.keys(result.data).length }
  })
  ipcMain.handle('get-auto-start-chat-record', async (_ev, payload: PageReq) => {
    const a = await getAutoStartChatRecord(payload)
    return a
  })
  ipcMain.handle('get-mark-as-not-suit-record', async (_ev, payload: PageReq) => {
    const a = await getMarkAsNotSuitRecord(payload)
    return a
  })
  ipcMain.handle('get-job-library', async (_ev, payload: PageReq) => {
    const a = await getJobLibrary(payload)
    return a
  })
  ipcMain.handle('get-boss-library', async (_ev, payload: PageReq) => {
    const a = await getBossLibrary(payload)
    return a
  })
  ipcMain.handle('get-company-library', async (_ev, payload: PageReq) => {
    const a = await getCompanyLibrary(payload)
    return a
  })

  let subProcessOfOpenBossSiteDefer: null | PromiseWithResolvers<ChildProcess> = null
  let subProcessOfOpenBossSite: null | ChildProcess = null
  ipcMain.handle('open-site-with-boss-cookie', async (ev, data) => {
    const url = data.url
    if (
      !subProcessOfOpenBossSiteDefer ||
      !subProcessOfOpenBossSite ||
      subProcessOfOpenBossSite.killed
    ) {
      subProcessOfOpenBossSiteDefer = Promise.withResolvers()
      let puppeteerExecutable = await getLastUsedAndAvailableBrowser()
      if (!puppeteerExecutable) {
        try {
          const parent = BrowserWindow.fromWebContents(ev.sender) || undefined
          await configWithBrowserAssistant({
            autoFind: true,
            windowOption: {
              parent,
              modal: !!parent,
              show: true
            }
          })
          puppeteerExecutable = await getLastUsedAndAvailableBrowser()
        } catch (error) {
          //
        }
      }
      if (!puppeteerExecutable) {
        await dialog.showMessageBox({
          type: `error`,
          message: `未找到可用的浏览器`,
          detail: `请重新运行本程序，按照提示安装、配置浏览器`
        })
        return
      }
      const subProcessEnv = {
        ...process.env,
        PUPPETEER_EXECUTABLE_PATH: puppeteerExecutable!.executablePath
      }
      subProcessOfOpenBossSite = childProcess.spawn(
        process.argv[0],
        process.env.NODE_ENV === 'development'
          ? [process.argv[1], `--mode=launchBossSite`]
          : [`--mode=launchBossSite`],
        {
          env: subProcessEnv,
          stdio: ['inherit', 'inherit', 'inherit', 'pipe']
        }
      )
      subProcessOfOpenBossSite.once('exit', () => {
        subProcessOfOpenBossSiteDefer = null
      })
      subProcessOfOpenBossSite.stdio[3]!.pipe(JSONStream.parse()).on(
        'data',
        async function handler(data) {
          switch (data?.type) {
            case 'SUB_PROCESS_OF_OPEN_BOSS_SITE_READY': {
              subProcessOfOpenBossSiteDefer!.resolve(subProcessOfOpenBossSite as ChildProcess)
              break
            }
            case 'SUB_PROCESS_OF_OPEN_BOSS_SITE_CAN_BE_KILLED': {
              try {
                subProcessOfOpenBossSite &&
                  !subProcessOfOpenBossSite.killed &&
                  subProcessOfOpenBossSite.pid &&
                  process.kill(subProcessOfOpenBossSite.pid)
              } catch {
                //
              } finally {
                subProcessOfOpenBossSiteDefer = null
                subProcessOfOpenBossSite = null
              }
              break
            }
          }
        }
      )
    }

    await subProcessOfOpenBossSiteDefer.promise

    pipeWriteRegardlessError(
      subProcessOfOpenBossSite!.stdio[3]! as WriteStream,
      JSON.stringify({
        type: 'NEW_WINDOW',
        url: url ?? 'about:blank'
      })
    )
  })

  ipcMain.handle('get-job-history-by-encrypt-id', async (_, encryptJobId) => {
    return await getJobHistoryByEncryptId(encryptJobId)
  })

  function matchingContext() {
    return buildJobMatchContext(readConfigFile('boss.json'), readConfigFile('common-job-condition-config.json'), readConfigFile('target-company-list.json'), filterCatalog)
  }
  ipcMain.handle('get-job-ai-context', () => matchingContext())
  ipcMain.handle('preview-job-ai-input', async (_, draft) => {
    const config = readConfigFile('job-ai-match.json')
    return { systemInstructions: jobMatchSystemPrompt, ...matchingPayload({ ...config, inputSources: matchInputSources(draft), customPrompt: draft.customPrompt, resumeText: draft.resumeText, preferences: draft.preferences, filterContext: matchingContext(), feedbackRecords: await readJobFeedback() }, { jobInfo: draft.job, selectedJob: { brandName: draft.job?.company, cityName: draft.job?.city } }) }
  })
  ipcMain.handle('get-job-ai-model', async () => {
    const model = readConfigFile('llm.json')?.find(it => it.enabled)
    if (!model) return { provider: '未启用模型', model: '', account: '' }
    const codex = model.provider === 'codex-cli'
    const status = codex ? await codexStatus(model) : null
    return { provider: codex ? '本机 Codex CLI → OpenAI 云端模型' : 'API 接入', model: model.model || '自动选择（实际模型显示在每次运行结果）', reasoningEffort: model.reasoningEffort || '模型默认', account: status?.email || '', endpoint: codex ? status?.binary : model.providerCompleteApiUrl }
  })
  ipcMain.handle('get-job-ai-score-examples', () => {
    try { return recentScoreExamples(JSON.parse(require('node:fs').readFileSync(path.join(storageFilePath, 'job-ai-score-examples.json'), 'utf8'))) }
    catch { return [] }
  })
  function matchingSettings() {
    const config = readConfigFile('job-ai-match.json')
    const options = jobFilterOptions(config)
    return { ...config, enabled: options.enabled, regexFilters: options.regex, aiFilters: options.ai, inputSources: matchInputSources(config), customPrompt: config.customPrompt || defaultMatchPrompt, preferences: config.preferences || defaultJobPreferences }
  }
  ipcMain.handle('get-job-ai-match', matchingSettings)
  ipcMain.handle('get-job-matching-preview', async () => {
    const config = matchingSettings(), context = matchingContext()
    const payload = { systemInstructions: jobMatchSystemPrompt, ...matchingPayload({ ...config, filterContext: context, feedbackRecords: await readJobFeedback() }, { jobInfo: {} }) }
    return { config, context, payload }
  })
  ipcMain.handle('save-job-filter-switches', async (_, payload) => {
    const config = readConfigFile('job-ai-match.json')
    const updated = mergeJobFilterSettings(config, payload)
    if (updated.enabled && !hasRequiredMatchInputs(updated)) throw new Error('请先到AI模型筛选中保存简历和求职偏好')
    await writeConfigFile('job-ai-match.json', updated)
    return { enabled: updated.enabled, regexFilters: updated.regexFilters, aiFilters: updated.aiFilters, inputSources: updated.inputSources }
  })
  ipcMain.handle('save-job-ai-match', async (_, config) => {
    if (typeof config?.resumeText !== 'string' || typeof config.preferences !== 'string' || config.resumeText.length > 80000 || config.preferences.length > 20000) throw new Error('AI筛选配置格式无效或内容过长')
    const existing = readConfigFile('job-ai-match.json')
    if (jobFilterOptions(existing).enabled && !hasRequiredMatchInputs(config)) throw new Error('请先导入简历并填写求职偏好')
    if (typeof config.customPrompt !== 'string' || config.customPrompt.length > 20000) throw new Error('提示词无效或过长')
    const inputSources = matchInputSources(config)
    if (config.resumeFileId) await fs.access(resumeDocumentPath(config.resumeFileId))
    await writeConfigFile('job-ai-match.json', { ...existing, inputSources, customPrompt: config.customPrompt, resumeText: config.resumeText, resumeFileName: path.basename(String(config.resumeFileName || '')), resumeFileId: config.resumeFileId || '', preferences: config.preferences, resumeSourceText: typeof config.resumeSourceText === 'string' ? config.resumeSourceText.slice(0, 80000) : '', resumeParsingNotes: Array.isArray(config.resumeParsingNotes) ? config.resumeParsingNotes.filter(v => typeof v === 'string') : [], resumeParseMethod: String(config.resumeParseMethod || ''), resumeParseModel: String(config.resumeParseModel || '') })
  })
  ipcMain.handle('import-job-ai-resume', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { title: '使用AI解析简历', properties: ['openFile'], filters: [{ name: '简历', extensions: ['pdf', 'txt', 'md'] }] })
    if (result.canceled || !result.filePaths[0]) return null
    const parsed = await parseResumeFile(result.filePaths[0], readConfigFile('llm.json')?.find(it => it.enabled))
    return { ...parsed, resumeFileId: await saveResumeDocument(result.filePaths[0]) }
  })
  ipcMain.handle('preview-job-ai-resume', async (_, id) => {
    const file = resumeDocumentPath(id)
    await fs.access(file)
    await openResumePreview(file, readConfigFile('job-ai-match.json')?.resumeFileName || '简历.pdf', mainWindow!)
  })
  ipcMain.handle('parse-job-ai-resume-text', async (_, text) => {
    if (typeof text !== 'string' || text.length > 80000) throw new Error('简历文本无效或过长')
    return parseResumeWithAi(text, readConfigFile('llm.json')?.find(it => it.enabled))
  })
  ipcMain.handle('test-job-ai-match', async (_, candidate) => {
    if (typeof candidate?.jobName !== 'string' || typeof candidate?.postDescription !== 'string' || candidate.postDescription.length > 80000) throw new Error('请填写岗位名称与完整岗位描述')
    const config = readConfigFile('job-ai-match.json')
    const model = readConfigFile('llm.json')?.find(it => it.enabled)
    return matchJobWithResume({ ...config, filterContext: matchingContext() }, { jobInfo: candidate, selectedJob: { brandName: candidate.company || '', cityName: candidate.city || '' } }, model)
  })
  ipcMain.handle('codex-models', async (_, settings = {}) => listCodexModels({ binary: await resolveCodexBinary(settings) }))
  ipcMain.handle('codex-status', (_, settings = {}) => codexStatus(settings))
  ipcMain.handle('test-codex-connection', async (_, settings) => {
    const model = typeof settings === 'string' ? settings : settings?.model || ''
    const result = await codexCompletion([{ role: 'user', content: '只回复：连接成功' }], model, { codexDetectionMode: settings?.codexDetectionMode, codexBinaryPath: settings?.codexBinaryPath, reasoningEffort: typeof settings === 'object' ? settings.reasoningEffort : '', contextWindowTokens: settings?.contextWindowTokens })
    return `${result.choices[0].message.content}；实际模型：${result.model}`
  })
  ipcMain.handle('save-llm-config', async (_, configToSave, { embedded = false } = {}) => {
    for (const config of configToSave) if (config.provider === 'codex-cli') { await resolveCodexBinary(config); validateContextWindow(config.contextWindowTokens, await codexContextLimits(config.model)) }
    await writeConfigFile('llm.json', configToSave)
    if (!embedded) ipcMain.emit('llm-config-saved')
  })
  ipcMain.handle('llm-config', async () => {
    const win = createLlmConfigWindow({ parent: mainWindow!, modal: true, show: true })
    return new Promise<void>((resolve, reject) => {
      let saved = false
      const done = () => { saved = true; resolve(); win.close() }
      ipcMain.once('llm-config-saved', done)
      win.once('closed', () => { ipcMain.off('llm-config-saved', done); if (!saved) reject(new Error('cancel')) })
    })
  })
  ipcMain.on('close-llm-config', () => llmConfigWindow?.close())

  ipcMain.handle('resume-edit', async () => {
    createResumeEditorWindow({
      parent: mainWindow!,
      modal: true,
      show: true
    })
    const defer = Promise.withResolvers()
    async function saveResumeHandler(_, resumeContent) {
      await writeConfigFile('resumes.json', [
        {
          name: '默认简历',
          updateTime: Number(new Date()),
          content: resumeContent
        }
      ])
      defer.resolve()
      resumeEditorWindow?.close()
    }
    ipcMain.handle('save-resume-content', saveResumeHandler)
    resumeEditorWindow?.once('closed', () => {
      ipcMain.removeHandler('save-resume-content')
      defer.reject(new Error('cancel'))
    })

    return defer.promise
  })
  ipcMain.handle('fetch-resume-content', async () => {
    const res = (await readConfigFile('resumes.json'))?.[0]
    return res?.content ?? null
  })
  ipcMain.on('no-reply-reminder-prompt-edit', async (_, { type }) => {
    const template = await readStorageFile(defaultPromptMap[type].fileName, {
      isJson: false
    })
    if (!template) {
      await writeDefaultAutoRemindPrompt({ type })
    }
    const filePath = path.join(storageFilePath, defaultPromptMap[type].fileName)
    shell.openPath(filePath)
  })
  ipcMain.on('close-resume-editor', () => resumeEditorWindow?.close())
  ipcMain.handle('check-if-auto-remind-prompt-valid', async (_, { type }) => {
    await getValidTemplate({ type })
  })
  ipcMain.handle('check-is-resume-content-valid', async () => {
    const res = (await readConfigFile('resumes.json'))?.[0]
    return checkIsResumeContentValid(res)
  })
  ipcMain.handle('resume-content-enough-detect', async () => {
    const res = (await readConfigFile('resumes.json'))?.[0]
    return resumeContentEnoughDetect(res)
  })
  ipcMain.handle('overwrite-auto-remind-prompt-with-default', async (_, { type }) => {
    await writeDefaultAutoRemindPrompt({ type })
  })
  ipcMain.handle('check-if-llm-config-list-valid', async () => {
    const llmConfigList = await readConfigFile('llm.json')
    if (!Array.isArray(llmConfigList) || !llmConfigList?.length) {
      throw new Error('CANNOT_FIND_VALID_CONFIG')
    }
    if (llmConfigList.some((it) => (llmConfigList.length === 1 || it.enabled) && it.provider !== 'codex-cli' && !/^http(s)?:\/\//.test(it.providerCompleteApiUrl))) {
      throw new Error('CANNOT_FIND_VALID_CONFIG')
    }
    if (llmConfigList.length > 1) {
      const firstEnabledModel = llmConfigList.find((it) => it.enabled)
      if (!firstEnabledModel) {
        throw new Error('CANNOT_FIND_VALID_CONFIG')
      }
    }
  })
  ipcMain.on('test-llm-config-effect', (_, { autoReminderConfig } = {}) => {
    createReadNoReplyReminderLlmMockWindow(
      {
        parent: mainWindow!,
        modal: true,
        show: true
      },
      {
        autoReminderConfig
      }
    )
    async function requestLlm(_, requestPayload) {
      return await requestNewMessageContent(requestPayload.messageList, {
        requestScene: RequestSceneEnum.testing,
        llmConfigIdForPick: requestPayload.llmConfigIdForPick ?? null
      })
    }
    ipcMain.handle('request-llm-for-test', requestLlm)
    readNoReplyReminderLlmMockWindow?.once('closed', () => {
      ipcMain.removeHandler('request-llm-for-test')
    })
    async function getLlmConfigList() {
      return await readConfigFile('llm.json')
    }
    ipcMain.handle('get-llm-config-for-test', getLlmConfigList)
    readNoReplyReminderLlmMockWindow?.once('closed', () => {
      ipcMain.removeHandler('get-llm-config-for-test')
    })
  })
  ipcMain.on('close-read-no-reply-reminder-llm-mock-window', () => {
    readNoReplyReminderLlmMockWindow?.close()
    gtag('mock_chat_window_closed')
  })
  ipcMain.handle('check-update', async () => {
    const newRelease = await checkUpdateForUi()
    return newRelease
  })
  ipcMain.handle('login-with-cookie-assistant', async () => {
    return await loginWithCookieAssistant({
      windowOption: {
        parent: mainWindow!,
        modal: true,
        show: true
      }
    })
  })
  ipcMain.handle('config-with-browser-assistant', async () => {
    return await configWithBrowserAssistant({
      windowOption: {
        parent: mainWindow!,
        modal: true,
        show: true
      }
    })
  })

  ipcMain.handle('pre-enter-setting-ui', async () => {
    if (!isFirstLaunchNoticeApproveFlagExist()) {
      try {
        await waitForUserApproveAgreement({
          windowOption: {
            parent: mainWindow!,
            modal: true,
            show: true
          }
        })
        createFirstLaunchNoticeApproveFlag()
      } catch {
        app.exit(0)
        return
      }
    }
    const puppeteerExecutable = await getAnyAvailablePuppeteerExecutable()
    if (!puppeteerExecutable) {
      const lastBrowser = await getLastUsedAndAvailableBrowser()
      if (!lastBrowser) {
        try {
          await configWithBrowserAssistant({
            windowOption: {
              parent: mainWindow!,
              modal: true,
              show: true
            },
            autoFind: true
          })
        } catch (err) {
          void err
        }
      }
    }
  })
  ipcMain.handle('common-job-condition-config', async () => {
    await waitForCommonJobConditionDone()
    mainWindow?.webContents.send('common-job-condition-config-updated', {
      config: await readConfigFile('common-job-condition-config.json')
    })
  })

  ipcMain.handle('exit-app-immediately', () => {
    app.exit(0)
  })
}
