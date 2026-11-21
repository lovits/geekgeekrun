<template>
  <div class="simulation-page">
    <div class="simulation-toolbar">
      <el-select v-model="simulationMode" size="small" style="width: 120px" :disabled="state?.running || starting"><el-option label="本地职位库" value="local" /><el-option label="BOSS 在线" value="online" /></el-select>
      <span class="batch-label">每批数量</span>
      <el-input-number v-model="batchSize" :min="1" :step="1" :precision="0" size="small" :disabled="state?.running || starting" controls-position="right" style="width: 90px" />
      <el-button size="small" type="primary" plain :loading="starting" :disabled="state?.running || !Number.isSafeInteger(batchSize) || batchSize < 1" @click="start">开始模拟</el-button>
      <el-button size="small" :loading="loading" @click="refresh">刷新</el-button>
      <el-button v-if="state?.online?.running" size="small" :loading="starting" @click="stopOnline">停止</el-button>
      <span v-if="state" class="run-summary">总数 {{ summaryJobs.length }} · 评估失败 {{ summaryJobs.filter(job => job.status === 'error').length }} · 拟沟通 {{ count('eligible') }} · 未沟通 {{ count('ineligible') }} · 已沟通 {{ count('delivered') }}</span>
      <div class="list-filters">
        <el-date-picker v-model="recordDate" type="date" value-format="YYYY-MM-DD" placeholder="全部日期" size="small" clearable :shortcuts="[{ text: '今日', value: () => new Date() }]" aria-label="按日期筛选模拟开聊记录" style="width: 145px" />
        <el-select v-model="filter" size="small" aria-label="沟通状态筛选" style="width: 110px"><el-option label="全部状态" value="all" /><el-option v-for="(label, key) in outcomeLabels" :key="key" :label="label" :value="key" /></el-select>
        <el-popover placement="bottom-end" trigger="click" :width="320">
          <template #reference><el-button size="small" :type="scaleFilter.length || industryFilter.length || scoreFilter !== 'all' ? 'primary' : 'default'" plain>筛选</el-button></template>
          <el-form label-position="top">
            <el-form-item label="公司规模"><el-select :teleported="false" v-model="scaleFilter" multiple clearable collapse-tags collapse-tags-tooltip placeholder="不筛选" @change="normalizeCompanyFilters"><el-option label="不筛选" value="" /><el-option v-for="option in companyFilterOptions.scales" :key="option.value" :value="option.value" :label="option.label" /></el-select></el-form-item>
            <el-form-item label="所在行业"><el-select :teleported="false" v-model="industryFilter" multiple clearable filterable collapse-tags collapse-tags-tooltip placeholder="不筛选" @change="normalizeCompanyFilters"><el-option label="不筛选" value="" /><el-option v-for="industry in companyFilterOptions.industries" :key="industry" :value="industry" :label="industry" /></el-select></el-form-item>
            <el-form-item label="AI分数"><el-select :teleported="false" v-model="scoreFilter" size="small" aria-label="AI分数筛选"><el-option label="AI分数：全部" value="all" /><el-option label="有AI分数" value="scored" /><el-option label="无AI分数" value="unscored" /></el-select></el-form-item>
          </el-form>
        </el-popover>
        <el-button size="small" @click="resetFilters">重置</el-button>
      </div>
    </div>
    <el-alert v-if="state?.pendingLocalRecords" :title="`本地待保存 ${state.pendingLocalRecords} 条；保存失败的记录会保留，下次运行重试`" type="warning" :closable="false" />
    <el-alert v-if="runError" :title="runError" type="error" :closable="false" />
    <div class="simulation-table">
      <el-table ref="tableRef" :data="visibleJobs" size="small" table-layout="fixed" row-key="jobId" height="100%" @sort-change="handleSortChange">
        <el-table-column prop="company" label="公司" sortable="custom" min-width="100" show-overflow-tooltip />
        <el-table-column prop="jobName" label="岗位" min-width="170" show-overflow-tooltip />
        <el-table-column prop="positionName" label="职位分类" min-width="85" show-overflow-tooltip />
        <el-table-column label="沟通状态" width="85"><template #default="{ row }"><el-tag v-if="row.status === 'error'" size="small" type="danger" effect="plain">评估失败</el-tag><el-tag v-else-if="applicationOutcome(row)" size="small" :type="applicationOutcome(row) === 'eligible' ? 'warning' : applicationOutcome(row) === 'delivered' ? 'success' : 'info'" effect="plain">{{ outcomeLabel(row) }}</el-tag><span v-else>—</span></template></el-table-column>
        <el-table-column prop="score" label="AI分数" sortable="custom" width="85" align="center"><template #default="{ row }">{{ row.score ?? '—' }}</template></el-table-column>
        <el-table-column prop="experience" label="工作经验" min-width="95" show-overflow-tooltip />
        <el-table-column label="薪资" min-width="100" show-overflow-tooltip><template #default="{ row }">{{ row.salaryDesc || row.snapshot?.salaryDesc || '—' }}</template></el-table-column>
        <el-table-column prop="reason" label="原因" sortable="custom" min-width="230"><template #default="{ row }"><el-tooltip :content="row.reason || '—'" placement="top" :show-after="300" popper-class="simulation-reason-tooltip"><div class="reason-preview" tabindex="0">{{ row.reason || '—' }}</div></el-tooltip></template></el-table-column>
        <el-table-column label="职位信息" width="100" fixed="right"><template #default="{ row }"><div class="row-actions"><el-button link type="primary" size="small" @click="selectedId = row.jobId; details = true">快照</el-button><el-button link type="primary" size="small" :aria-label="'岗位详情：' + row.jobName" @click="openJobDetails(row)">详情</el-button></div></template></el-table-column>
      </el-table>
    </div>
    <div class="flex flex-0 flex-justify-between pt10px pb10px">
      <div class="w100px" />
      <el-pagination v-model:current-page="pageNo" v-model:page-size="pageSize" :page-sizes="[100, 200, 300, 400]" small layout="total, sizes, prev, pager, next, jumper" :total="filteredJobs.length" @current-change="tableRef?.setScrollTop(0)" />
      <div class="w100px" />
    </div>
    <el-drawer v-model="details" title="模拟开聊快照" size="min(760px, 92vw)" append-to-body>
      <div v-if="selected" class="job-details"><h3>{{ selected.company }} · {{ selected.jobName }}</h3>
        <p>{{ outcomeLabel(selected) }} · AI {{ selected.score ?? '未评分' }} · {{ selected.aiEvaluated ? selected.model || state?.model || '模型未记录' : '未调用' }}</p>
        <p>{{ selected.city }} · {{ selected.experience }}</p><p>BOSS活跃状态：{{ selected.bossActiveTimeDesc || '未记录，需线上核验' }}</p>
        <p>{{ selected.chattedAt ? '开聊时间' : selected.recordOrigin === 'runtime' ? '记录时间' : '模拟时间' }}：{{ (selected.chattedAt || selected.evaluatedAt || selected.recordedAt) ? transformUtcDateToLocalDate(selected.chattedAt || selected.evaluatedAt || selected.recordedAt).format('YYYY-MM-DD HH:mm:ss') : '未记录' }}</p>
        <p>BOSS：{{ selected.bossName || selected.snapshot?.bossName || '未记录' }} · BOSS身份：{{ selected.bossTitle || selected.snapshot?.bossTitle || '未记录' }}</p>
        <p>来源：{{ selected.recordOrigin === 'online-simulation' ? 'BOSS 在线模拟' : selected.recordOrigin === 'runtime' ? '实际运行记录' : '本地职位库模拟' }}</p>
        <h4>判断原因</h4><p>{{ selected.reason || '尚未处理' }}</p>
        <template v-if="selected.reviewNotes?.length"><h4>人工复核 · {{ selected.manualRecommendation }}</h4><ul><li v-for="note in selected.reviewNotes" :key="note">{{ note }}</li></ul></template>
        <h4 v-if="selected.gaps?.length">差异与待确认</h4><ul><li v-for="gap in selected.gaps || []" :key="gap">{{ gap }}</li></ul>
        <p>规则{{ selected.rulePass == null ? '未检查' : selected.rulePass ? '通过' : '未通过' }} · {{ selected.aiEvaluated ? '已调用AI' : '未调用AI' }}</p>
        <h4>岗位描述原文</h4><p>{{ selected.description }}</p>
        <h4>岗位详情链接</h4><el-link class="job-link" type="primary" @click="openJobDetails(selected)">{{ selected.url }}</el-link><p>岗位ID：{{ selected.jobId }}</p>
      </div>
    </el-drawer>
  </div>
</template>
<script setup lang="ts">
import { useRecordAutoRefresh } from '@renderer/hooks/useRecordAutoRefresh'
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { applicationOutcome, filterApplicationRecords, applicationRecordDay } from '@geekgeekrun/utils/application-outcome.mjs'
import { formatCompanyScale } from '@geekgeekrun/sqlite-plugin/src/utils/parser'
import { transformUtcDateToLocalDate } from '@geekgeekrun/utils/date.mjs'
const state = ref<any>(null), loading = ref(false), starting = ref(false)
const batchSize = ref(10), filter = ref('all'), details = ref(false), selectedId = ref('')
const simulationMode = ref('online')
const recordDate = ref('')
const scaleFilter = ref<string[]>([]), industryFilter = ref<string[]>([])
function normalizeCompanyFilters() { if (scaleFilter.value.includes('')) scaleFilter.value = []; if (industryFilter.value.includes('')) industryFilter.value = [] }
const scoreFilter = ref('all'), sortBy = ref(''), sortOrder = ref('')
const tableRef = ref<any>(null)
const pageNo = ref(1), pageSize = ref(100)
const runError = computed(() => simulationMode.value === 'online' ? state.value?.online?.runError : state.value?.runError)
const selected = computed(() => dateJobs.value.find(job => job.jobId === selectedId.value))
const outcomeLabels: Record<string, string> = { eligible: '拟沟通', ineligible: '未沟通', delivered: '已沟通', failed: '评估失败' }
const outcomeLabel = job => job.status === 'error' ? '评估失败' : outcomeLabels[applicationOutcome(job)] || '未完成判断'
const batchJobs = computed<any[]>(() => state.value?.jobs?.slice(0, state.value.target) || [])
const jobs = computed<any[]>(() => state.value?.displayJobs || batchJobs.value)
const dailySource = computed<any[]>(() => state.value?.dailyJobs || jobs.value)
const dateJobs = computed(() => recordDate.value ? dailySource.value.filter(job => applicationRecordDay(job) === recordDate.value) : jobs.value)
const companyFilterOptions = computed(() => {
  const scales = new Map<string, { value: string; label: string; low: number }>()
  const industries = new Set<string>()
  for (const job of [...jobs.value, ...dailySource.value]) {
    const low = job.scaleLow ?? null, high = job.scaleHigh ?? null, value = JSON.stringify([low, high])
    scales.set(value, { value, low: low ?? -1, label: low === null && high === null ? '未记录' : formatCompanyScale(low, high) })
    if (job.industryName) industries.add(job.industryName)
  }
  return { scales: [...scales.values()].sort((a, b) => a.low - b.low), industries: [...industries].sort((a, b) => a.localeCompare(b, 'zh-CN')) }
})
const summaryJobs = computed(() => filterApplicationRecords(dateJobs.value, { score: scoreFilter.value, scales: scaleFilter.value, industries: industryFilter.value }))
const filteredJobs = computed(() => filterApplicationRecords(summaryJobs.value, { outcome: filter.value, score: scoreFilter.value, sortBy: sortBy.value, sortOrder: sortOrder.value }))
const visibleJobs = computed(() => filteredJobs.value.slice((pageNo.value - 1) * pageSize.value, pageNo.value * pageSize.value))
watch([filter, scoreFilter, sortBy, sortOrder, pageSize, recordDate, scaleFilter, industryFilter], () => { pageNo.value = 1; tableRef.value?.setScrollTop(0) }, { deep: true })
watch(() => filteredJobs.value.length, total => { pageNo.value = Math.min(pageNo.value, Math.max(1, Math.ceil(total / pageSize.value))) })
function handleSortChange({ prop, order }) { sortBy.value = prop || ''; sortOrder.value = order || '' }
function resetFilters() { scaleFilter.value = []; industryFilter.value = []; recordDate.value = ''; filter.value = 'all'; scoreFilter.value = 'all'; sortBy.value = ''; sortOrder.value = ''; tableRef.value?.clearSort() }
async function openJobDetails(job) {
  try { await window.electron.ipcRenderer.invoke('open-site-with-boss-cookie', { url: job.url }) }
  catch (error) { ElMessage.error(String(error)) }
}
const count = (outcome: string) => summaryJobs.value.filter(job => applicationOutcome(job) === outcome).length
async function refresh() {
  if (loading.value) return
  loading.value = true
  try { state.value = await window.electron.ipcRenderer.invoke('get-application-simulation'); if (state.value?.online?.running) simulationMode.value = 'online' }
  catch (error) { ElMessage.error(String(error)) }
  finally { loading.value = false }
}
async function start() {
  starting.value = true
  try { state.value = await window.electron.ipcRenderer.invoke('start-application-simulation', { batchSize: batchSize.value, mode: simulationMode.value }) }
  catch (error) { ElMessage.error(String(error)) }
  finally { starting.value = false }
}
async function stopOnline() {
  starting.value = true
  try { state.value = await window.electron.ipcRenderer.invoke('stop-online-application-simulation') }
  catch (error) { ElMessage.error(String(error)) }
  finally { starting.value = false }
}
useRecordAutoRefresh(refresh, () => simulationMode.value === 'local' && Boolean(state.value?.running))
</script>
<style scoped>
.simulation-page { display: flex; flex-direction: column; width: 100%; max-width: 1000px; min-width: 0; min-height: 0; margin: 0 auto; padding: 20px 0 0 20px; box-sizing: border-box; overflow: hidden; color: var(--el-text-color-primary); font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif; }
.simulation-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; flex-shrink: 0; font-size: 12px; }
.simulation-toolbar .el-button + .el-button { margin-left: 0; }.batch-label, .run-summary { color: var(--el-text-color-secondary); }.run-summary { white-space: nowrap; }
.list-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }.simulation-table { flex: 1; min-height: 0; overflow: hidden; }
.job-details { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.8; }.job-details h3 { font-size: 16px; line-height: 1.6; }.job-details h4 { margin-bottom: 8px; }
.job-link { max-width: 100%; }.job-link :deep(.el-link__inner) { white-space: normal; overflow-wrap: anywhere; }
.row-actions { display: flex; align-items: center; gap: 10px; }.row-actions .el-button + .el-button { margin-left: 0; }
.simulation-page :deep(.el-table .cell) { padding: 0 6px; line-height: 18px; }
.simulation-page :deep(.el-table .el-link) { font-size: 12px; }
.reason-preview { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; overflow-wrap: anywhere; max-height: 36px; }
</style>

<style>
.simulation-reason-tooltip { max-width: min(560px, 80vw); white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; }
</style>
