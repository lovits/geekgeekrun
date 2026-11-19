import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

export const useJobFilterSettings = defineStore('job-filter-settings', () => {
  const regexFilters = ref<Record<string, boolean>>({})
  const aiFilters = ref({ jobName: false, postDescription: false })
  const inputSources = ref<Record<string, boolean>>({})
  const loading = ref(false)
  let pending: Promise<void> | null = null
  function apply(config) {
    regexFilters.value = config.regexFilters
    aiFilters.value = config.aiFilters
    inputSources.value = config.inputSources
  }
  function refresh() {
    if (pending) return pending
    loading.value = true
    pending = window.electron.ipcRenderer.invoke('get-job-ai-match').then(apply).finally(() => { loading.value = false; pending = null })
    return pending!
  }
  async function save(scope: 'regex' | 'ai' | 'all' | 'inputSources') {
    loading.value = true
    const patch = scope === 'inputSources' ? { inputSources: inputSources.value }
      : { ...(scope !== 'ai' ? { regexFilters: regexFilters.value } : {}), ...(scope !== 'regex' ? { aiFilters: aiFilters.value } : {}) }
    try {
      const result = await window.electron.ipcRenderer.invoke('save-job-filter-switches', JSON.parse(JSON.stringify(patch)))
      apply(result)
      if (result.warning) ElMessage.warning(result.warning)
    }
    catch (error) { await refresh(); throw error }
    finally { loading.value = false }
  }
  return { regexFilters, aiFilters, inputSources, loading, refresh, save }
})
