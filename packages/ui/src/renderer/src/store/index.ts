import type { RunningTask } from '../../../common/types/runtime'
import { defineStore } from 'pinia'
import { NewReleaseInfo } from '../../../common/types/update'
import { ref } from 'vue'
import { throttle } from 'lodash'

export const useUpdateStore = defineStore('update', () => {
  const availableNewRelease = ref<NewReleaseInfo | null>(null)

  const autoCheck = ref(localStorage.getItem('auto-check-updates') !== 'false')
  const checking = ref(false), updateError = ref(''), lastCheckedAt = ref('')
  function setAutoCheck(value: boolean) { autoCheck.value = value; localStorage.setItem('auto-check-updates', String(value)) }
  async function checkUpdate() {
    if (checking.value) return
    checking.value = true; updateError.value = ''
    let result: NewReleaseInfo | null = null
    try {
      result = (await electron.ipcRenderer.invoke('check-update')) as NewReleaseInfo | null
    } catch (error) {
      updateError.value = String(error)
    } finally { checking.value = false; lastCheckedAt.value = new Date().toLocaleString() }
    availableNewRelease.value = result
  }
  if (autoCheck.value) checkUpdate()
  setInterval(() => { if (autoCheck.value) checkUpdate() }, 30 * 60 * 1000)
  return { availableNewRelease, autoCheck, checking, updateError, lastCheckedAt, setAutoCheck, checkUpdate }
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
