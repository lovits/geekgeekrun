<template>
  <div class="company-jobs-preview" v-loading="loading">
    <div class="preview-heading">{{ companyName }} · 已收录职位</div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table :data="jobs" size="small" table-layout="fixed" empty-text="暂无已收录职位" max-height="330">
      <el-table-column prop="jobName" label="职位名称" min-width="200" show-overflow-tooltip />
      <el-table-column prop="experienceName" label="工作经验" min-width="110" show-overflow-tooltip />
      <el-table-column label="薪资" min-width="120" :formatter="row => formatJobSalary(row)" show-overflow-tooltip />
      <el-table-column prop="degreeName" label="学历" min-width="90" show-overflow-tooltip />
      <el-table-column prop="address" label="工作地点" min-width="150" show-overflow-tooltip />
    </el-table>
    <div class="preview-footer">
      <el-button v-if="error" size="small" @click="loadJobs">重试</el-button>
      <el-pagination v-model:current-page="pageNo" small layout="total, prev, pager, next" :page-size="20" :total="total" :disabled="loading" @current-change="loadJobs" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatJobSalary } from '@geekgeekrun/utils/job-salary.mjs'
const props = defineProps<{ companyId: string; companyName: string }>()
const jobs = ref<any[]>([]), total = ref(0), pageNo = ref(1), loading = ref(false), error = ref('')
let requestId = 0
async function loadJobs() {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  try {
    const { data: result } = await electron.ipcRenderer.invoke('get-job-library', { pageNo: pageNo.value, pageSize: 20, companyId: props.companyId })
    if (currentRequest !== requestId) return
    jobs.value = result.data
    total.value = result.totalItemCount
  } catch (cause) {
    if (currentRequest !== requestId) return
    jobs.value = []
    total.value = 0
    error.value = String(cause)
  } finally { if (currentRequest === requestId) loading.value = false }
}
watch(() => props.companyId, () => { pageNo.value = 1; loadJobs() }, { immediate: true })
</script>
<style scoped>
.company-jobs-preview { padding: 12px 20px; background: var(--el-fill-color-lighter); }
.preview-heading { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.preview-footer { display: flex; justify-content: flex-end; margin-top: 8px; }
</style>
