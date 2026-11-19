import { updateCheckDue } from '@geekgeekrun/utils/update-schedule.mjs'
import type { RunningTask } from '../../../common/types/runtime'
import { defineStore } from 'pinia'
import { NewReleaseInfo } from '../../../common/types/update'
import { ref } from 'vue'
import { throttle } from 'lodash'

export const useUpdateStore = defineStore('update', () => {
  let cached: any = {}
  try { cached = JSON.parse(localStorage.getItem('update-check-cache') || '{}') } catch {}
  const availableNewRelease = ref<NewReleaseInfo | null>(cached.release || null)
  const autoCheck = ref(localStorage.getItem('auto-check-updates') !== 'false')
  const checking = ref(false), updateError = ref(''), lastCheckedAt = ref(cached.checkedAt || '')
  const checkStatus = ref(cached.status || 'idle'), downloading = ref(false), downloadError = ref(''), downloaded = ref<any>(null)
  function setAutoCheck(value: boolean) { autoCheck.value = value; localStorage.setItem('auto-check-updates', String(value)); if (value) checkUpdate() }
  async function downloadUpdate() {
    if (downloading.value) return
    downloading.value = true; downloadError.value = ''
    try { downloaded.value = await electron.ipcRenderer.invoke('download-update') }
    catch (error) { downloadError.value = String(error) }
    finally { downloading.value = false }
  }
  async function checkUpdate(force = false) {
    if (checking.value || !updateCheckDue(lastCheckedAt.value, Date.now(), force === true)) return
    checking.value = true; updateError.value = ''
    try {
      availableNewRelease.value = await electron.ipcRenderer.invoke('check-update')
      checkStatus.value = availableNewRelease.value ? 'available' : 'latest'
    } catch (error) { checkStatus.value = 'error'; updateError.value = String(error) }
    finally {
      checking.value = false; lastCheckedAt.value = new Date().toISOString()
      localStorage.setItem('update-check-cache', JSON.stringify({checkedAt:lastCheckedAt.value, status:checkStatus.value, release:availableNewRelease.value}))
    }
    if (checkStatus.value === 'available' && autoCheck.value) await downloadUpdate()
  }
  if (autoCheck.value) checkUpdate()
  setInterval(() => { if (autoCheck.value) checkUpdate() }, 60 * 60 * 1000)
  return { availableNewRelease, autoCheck, checking, updateError, lastCheckedAt, checkStatus, downloading, downloadError, downloaded, setAutoCheck, checkUpdate, downloadUpdate }
})

export const useTaskManagerStore = defineStore('taskManager', () => {
  const runningTasks = ref<RunningTask[]>([])
  async function getRunningTasks() {
    const { ipcRenderer } = electron
    const res = await ipcRenderer.invoke('get-task-manager-list')
    runningTasks.value = res.workers ?? []
  }
  const throttledGetRunningTasks = throttle(getRunningTasks, 2000)
  setInterval(throttledGetRunningTasks, 2 * 1000)
  getRunningTasks()
  return { runningTasks, getRunningTasks: throttledGetRunningTasks }
})
