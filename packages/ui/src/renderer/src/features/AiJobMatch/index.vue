<template>
  <section ref="pageRoot" class="ai-match-page">
    <header class="page-heading">
      <div><h2>AI 模型筛选</h2></div>
      <el-button @click="refreshInfo().catch(error => ElMessage.error(String(error)))">刷新</el-button>
    </header>
    <div class="model-strip">
      <span class="model-label">当前模型</span><strong>{{ modelInfo.model || '尚未启用' }}</strong>
      <span class="muted">{{ modelInfo.reasoningEffort === '模型默认' ? '默认推理强度' : modelInfo.reasoningEffort }}</span>
      <el-popover placement="bottom" :width="340" trigger="click"><template #reference><el-button link>模型详情</el-button></template>
        <div class="model-detail">{{ modelInfo.provider }}<br />{{ modelInfo.account }}<br />简历解析与岗位评分共用此模型。</div>
      </el-popover>
    </div>
    <el-tabs v-model="activeTab" class="match-tabs">
      <el-tab-pane label="匹配设置" name="settings">
        <section data-setting="scope" tabindex="-1" class="settings-card">
          <div class="card-heading"><h3>筛选范围</h3><span class="muted">开关立即保存</span></div>
          <JobFilterMode scope="ai" compact />
          <div class="field-label">提供给模型的资料</div>
          <div class="input-grid"><el-checkbox :data-setting="'input-' + item.key" v-for="item in inputOptions" :key="item.key" v-model="settings.inputSources[item.key]" :disabled="settings.loading" @change="saveInputSources">{{ item.label }}</el-checkbox></div>
          
        </section>
        <div class="settings-grid">
          <section class="settings-card">
            <div class="card-heading"><h3>我的简历</h3><el-tag size="small" effect="plain">本机保存</el-tag></div>
            <el-button v-if="config.resumeFileName" class="resume-file" link type="primary" :disabled="!config.resumeFileId" :loading="previewing" @click="previewResume">{{ config.resumeFileName }}<span v-if="config.resumeFileId" class="file-action">预览</span></el-button>
            
            <div class="actions"><el-button :loading="importing" @click="importResume">导入并用 AI 解析</el-button><el-button :loading="parsing" @click="parseText">AI 整理文本</el-button></div>
            <el-form-item data-setting="resume" label="简历内容"><el-input v-model="config.resumeText" type="textarea" :rows="7" maxlength="80000" /></el-form-item>
            <el-collapse class="quiet-collapse"><el-collapse-item title="原文与解析记录" name="resume">
              <p>{{ config.resumeParseMethod || '尚无解析记录' }} · {{ config.resumeParseModel || '模型未记录' }}</p>
              <p v-if="config.resumeParsingNotes?.length">待核对：{{ config.resumeParsingNotes.join('；') }}</p>
              <pre>{{ config.resumeSourceText || '尚无原始提取文本' }}</pre>
            </el-collapse-item></el-collapse>
          </section>
          <section class="settings-card">
            <div class="card-heading"><h3>求职偏好</h3><el-tag size="small" effect="plain">个人设置</el-tag></div>
            <el-form-item data-setting="preferences" label="手写偏好"><el-input v-model="config.preferences" type="textarea" :rows="7" maxlength="20000" /></el-form-item>
            
            <el-collapse v-model="feedbackSections" class="quiet-collapse"><el-collapse-item name="feedback"><template #title>反馈学习的偏好 <el-tooltip placement="top" :enterable="false"><template #content><div style="max-width: 350px; line-height: 1.8">这里是根据你明确标记的“喜欢／不喜欢”整理的偏好总结。程序提取岗位内容的相似特征，参考正负样本，并让已配置的大模型更新总结；未标记的岗位不参与学习。勾选反馈输入后，它会影响后续匹配。这里不能直接编辑；需要主动补充或纠正的偏好请写入“手写偏好”。取消或改变标记会重新整理总结，手写偏好不会被覆盖。</div></template><QuestionFilled @click.stop style="width: 14px; height: 14px; margin-left: 6px" aria-label="反馈学习偏好说明" /></el-tooltip></template>
              <el-input data-setting="feedback" :model-value="config.learnedPreferences || '尚无反馈。未标记的岗位不影响偏好。'" type="textarea" :rows="4" readonly />
              
            </el-collapse-item></el-collapse>
          </section>
        </div>
        <section class="settings-card">
          <el-collapse v-model="advancedSections" class="quiet-collapse"><el-collapse-item title="提示词与模型输入" name="advanced">
            <el-form-item data-setting="prompt" label="匹配提示词"><el-input v-model="config.customPrompt" type="textarea" :rows="5" maxlength="20000" /></el-form-item>
            
            <el-button :loading="previewLoading" @click="previewInput">预览实际模型输入</el-button>
            
          </el-collapse-item></el-collapse>
        </section>
        <div class="save-bar"><span class="muted">{{ saved ? '设置已保存' : '资料与偏好修改后请保存' }}</span><el-button type="primary" :disabled="settings.loading" @click="save">保存匹配设置</el-button></div>
      </el-tab-pane>
      <el-tab-pane label="岗位测试" name="test">
        <section class="settings-card">
          <div class="card-heading"><h3>测试一条岗位</h3><span class="muted">仅评分，不开聊</span></div>
          <div class="two-fields"><el-form-item label="公司"><el-input v-model="job.company" /></el-form-item><el-form-item label="城市"><el-input v-model="job.city" /></el-form-item></div>
          <el-form-item label="岗位名称"><el-input v-model="job.jobName" /></el-form-item>
          <el-form-item label="岗位描述"><el-input v-model="job.postDescription" type="textarea" :rows="6" maxlength="80000" /></el-form-item>
          <div class="test-actions"><el-button type="primary" :loading="testing" @click="testMatch">开始评分</el-button></div>
          <div v-if="lastDecision" class="decision-card"><strong>{{ lastDecision.score ?? '—' }}<small>/100</small></strong><div><b>{{ lastDecision.match ? 'AI 判断匹配' : 'AI 未放行' }}</b><p>{{ briefReason(lastDecision.reason) }}</p></div><el-button link type="primary" @click="showDetails(lastDecision)">详情</el-button></div>
          <p v-else-if="result" role="status">{{ result }}</p>
        </section>
        <section class="settings-card">
          <div class="card-heading"><h3>最近评分示例</h3><span class="muted">最近 5 条 · 历史数据</span></div>
          <el-table v-if="examples.length" :data="examples" style="width: 100%" table-layout="fixed">
            <el-table-column label="岗位" min-width="200"><template #default="scope"><b>{{ scope.row.jobName }}</b><div class="muted">{{ scope.row.company }}</div></template></el-table-column>
            <el-table-column prop="score" label="分数" width="70" />
            <el-table-column label="AI 判断" width="95"><template #default="scope"><el-tag size="small" :type="scope.row.match ? 'success' : 'info'" effect="light">{{ scope.row.match ? '匹配' : '未放行' }}</el-tag></template></el-table-column>
            <el-table-column label="简要理由" min-width="170"><template #default="scope">{{ briefReason(scope.row.reason) }}</template></el-table-column>
            <el-table-column label="" width="65"><template #default="scope"><el-button link type="primary" @click="showDetails(scope.row)">详情</el-button></template></el-table-column>
          </el-table><el-empty v-else description="尚无评分示例" :image-size="65" />
        </section>
      </el-tab-pane>
    </el-tabs>
    <el-drawer v-model="detailsVisible" title="岗位匹配详情" size="min(720px, 90vw)" append-to-body>
      <div v-if="selectedResult" class="result-details">
        <h3>{{ selectedResult.company }} · {{ selectedResult.jobName }}</h3>
        <p>评分 {{ selectedResult.score ?? '未评分' }}/100 · {{ selectedResult.model || '未运行' }}</p>
        <p v-if="selectedResult.baseScore != null">基础分 {{ selectedResult.baseScore }} · 偏好调整 {{ selectedResult.feedbackAdjustment > 0 ? '+' : '' }}{{ selectedResult.feedbackAdjustment }}</p>
        <p v-if="selectedResult.feedbackRecommendation">内容推荐：{{ selectedResult.feedbackRecommendation.algorithm }} · {{ selectedResult.feedbackRecommendation.feedbackCount }} 条明确反馈</p>
        <h4>判断依据</h4><p>{{ selectedResult.reason }}</p><h4>综合条件</h4><p>{{ (selectedResult.criteriaSummary || []).join('\n') }}</p>
        <h4>差异与待确认</h4><p>{{ (selectedResult.gaps || []).join('\n') || '未列出' }}</p>
        <template v-if="selectedResult.description"><h4>岗位描述</h4><p>{{ selectedResult.description }}</p></template>
        <p v-if="selectedResult.source" class="muted">{{ selectedResult.source }} · {{ selectedResult.evaluatedAt }}</p>
      </div>
    </el-drawer>
    <el-drawer v-model="inputPreviewVisible" title="预览实际模型输入" size="min(940px, 94vw)" append-to-body><JobModelInputPreview v-if="inputPreview" :payload="inputPreview" :saved-context="filterContext" /></el-drawer>
  </section>
</template>
<script setup lang="ts">
import JobFilterMode from '@renderer/features/JobFilterMode/index.vue'
import JobModelInputPreview from '@renderer/features/JobModelInputPreview/index.vue'
import { useJobFilterSettings } from '@renderer/store/job-filter-settings'
import { QuestionFilled } from '@element-plus/icons-vue'
import { ref, onMounted, onActivated, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
const route = useRoute()
const advancedSections = ref<string[]>([])
const feedbackSections = ref<string[]>([])
const pageRoot = ref<HTMLElement>()
async function revealSetting() {
  const focus = String(route.query.focus || '')
  if (!['resume', 'preferences', 'prompt', 'scope', 'feedback', 'ai-jobName', 'ai-postDescription', ...inputOptions.map(item => 'input-' + item.key)].includes(focus)) return
  inputPreviewVisible.value = false
  activeTab.value = 'settings'
  if (focus === 'prompt') advancedSections.value = ['advanced']
  if (focus === 'feedback') feedbackSections.value = ['feedback']
  await nextTick()
  const section = pageRoot.value?.querySelector<HTMLElement>(`[data-setting="${focus}"]`)
  section?.scrollIntoView({ block: 'center' })
  const input = section?.querySelector<HTMLElement>('textarea, input, button') || section
  input?.focus({ preventScroll: true })
}
const settings = useJobFilterSettings()
const config = ref({ enabled: false, resumeFileName: '', resumeFileId: '', resumeText: '', preferences: '', learnedPreferences: '', feedbackLearnedAt: '', resumeSourceText: '', resumeParsingNotes: [] as string[], resumeParseMethod: '', resumeParseModel: '', customPrompt: '', inputSources: { resume: true, preferences: true, employmentAndTraversal: true, regexRules: false, pageFilters: false, companyRules: false, feedback: true } as Record<string, boolean> })
const job = ref({ jobName: '', postDescription: '', company: '', city: '' })
const saved = ref(false)
const importing = ref(false)
const activeTab = ref('settings')
const previewing = ref(false)
async function previewResume() {
  previewing.value = true
  try { await window.electron.ipcRenderer.invoke('preview-job-ai-resume', config.value.resumeFileId) }
  catch (error) { ElMessage.error(String(error)) }
  finally { previewing.value = false }
}
const parsing = ref(false)
const testing = ref(false)
const result = ref('')
const lastDecision = ref<any>(null)
const detailsVisible = ref(false)
const selectedResult = ref<any>(null)
function briefReason(reason: string) { return reason?.length > 55 ? reason.slice(0, 55) + '…' : reason }
function showDetails(row: any) { selectedResult.value = row; detailsVisible.value = true }

const modelInfo = ref({ provider: '读取中', model: '', account: '', reasoningEffort: '' })
const inputOptions = [{key: 'activity', label: 'BOSS活跃度（沿用自动开聊设置）'}, {key: 'resume', label: '我的简历内容'}, {key: 'preferences', label: '我的求职偏好'}, {key: 'regexRules', label: '公共正则条件'}, {key: 'employmentAndTraversal', label: '求职类型与遍历方式'}, {key: 'pageFilters', label: '城市、经验、学历等条件'}, {key: 'companyRules', label: '公司名单与屏蔽规则'}, {key: 'feedback', label: '喜欢 / 不喜欢反馈'}]
const inputPreview = ref<Record<string, any> | null>(null)
const inputPreviewVisible = ref(false)
const previewLoading = ref(false)
async function previewInput() {
  previewLoading.value = true
  try { inputPreview.value = await window.electron.ipcRenderer.invoke('preview-job-ai-input', JSON.parse(JSON.stringify({...config.value, inputSources: settings.inputSources, job: job.value}))); inputPreviewVisible.value = true }
  catch (error) { ElMessage.error(String(error)) }
  finally { previewLoading.value = false }
}
const filterContext = ref<Record<string, any>>({})
const examples = ref<any[]>([])
async function refreshInfo() {
  const [model, context, scores, latest] = await Promise.all([
    window.electron.ipcRenderer.invoke('get-job-ai-model'),
    window.electron.ipcRenderer.invoke('get-job-ai-context'),
    window.electron.ipcRenderer.invoke('get-job-ai-score-examples'),
    window.electron.ipcRenderer.invoke('get-job-ai-match')
  ])
  modelInfo.value = model
  filterContext.value = context
  config.value.learnedPreferences = latest.learnedPreferences || ''
  config.value.feedbackLearnedAt = latest.feedbackLearnedAt || ''
  examples.value = scores
  await settings.refresh()
}

watch(() => ({ resumeFileId: config.value.resumeFileId, resumeText: config.value.resumeText, resumeSourceText: config.value.resumeSourceText, preferences: config.value.preferences, customPrompt: config.value.customPrompt, inputSources: config.value.inputSources }), () => { saved.value = false }, { deep: true })
let mounted = false
onActivated(() => { if (mounted) refreshInfo().then(revealSetting).catch(error => ElMessage.error(String(error))) })
watch(() => route.query.focus, () => { if (mounted) revealSetting() })
onMounted(async () => {
  try { config.value = await window.electron.ipcRenderer.invoke('get-job-ai-match'); await refreshInfo(); await revealSetting() }
  catch (error) { ElMessage.error(String(error)) }
  finally { mounted = true }
})
async function saveInputSources() {
  try { await settings.save('inputSources') }
  catch (error) { ElMessage.error(String(error)) }
}
async function importResume() {
  importing.value = true
  try {
    const resume = await window.electron.ipcRenderer.invoke('import-job-ai-resume')
    if (resume) Object.assign(config.value, resume)
  } catch (error) { ElMessage.error(String(error)) }
  finally { importing.value = false }
}
async function parseText() {
  parsing.value = true
  try {
    const parsed = await window.electron.ipcRenderer.invoke('parse-job-ai-resume-text', config.value.resumeText)
    Object.assign(config.value, parsed)
    ElMessage.success('AI整理完成，请检查后保存')
  } catch (error) { ElMessage.error(String(error)) }
  finally { parsing.value = false }
}
async function persist() {
  await window.electron.ipcRenderer.invoke('save-job-ai-match', JSON.parse(JSON.stringify({ ...config.value, inputSources: settings.inputSources })))
  saved.value = true
}
async function save() {
  try { await persist(); ElMessage.success('AI筛选设置已保存') }
  catch (error) { ElMessage.error(String(error)) }
}
async function testMatch() {
  testing.value = true
  result.value = ''
  lastDecision.value = null
  try {
    await persist()
    const decision = await window.electron.ipcRenderer.invoke('test-job-ai-match', JSON.parse(JSON.stringify(job.value)))
    lastDecision.value = { ...decision, jobName: job.value.jobName, company: job.value.company, description: job.value.postDescription }
    result.value = `分数：${decision.score ?? '未评分'}/100；模型：${decision.model || '未运行'}\n综合条件：${(decision.criteriaSummary || []).join('；')}\n${decision.match ? '已勾选AI字段匹配' : '不放行'}：${decision.reason}${decision.gaps.length ? '；差异：' + decision.gaps.join('；') : ''}`
  } catch (error) { result.value = String(error) }
  finally { testing.value = false }
}
</script>

<style scoped lang="scss">
.ai-match-page { --card-border: var(--el-border-color-light); color: var(--el-text-color-primary); min-width: 0; }
.page-heading, .card-heading, .model-strip, .save-bar, .test-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.page-heading { margin-bottom: 20px; } h2 { margin: 0; font-size: 24px; letter-spacing: -.4px; } h3 { margin: 0; font-size: 16px; } p { line-height: 1.6; }
.page-heading p, .helper { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 13px; }
.model-strip { justify-content: flex-start; flex-wrap: wrap; padding: 12px 16px; background: var(--el-color-primary-light-9); border: 1px solid var(--el-color-primary-light-8); border-radius: 10px; font-size: 13px; }
.model-strip .el-button { margin-left: auto; } .model-label { color: var(--el-text-color-secondary); } .model-detail { line-height: 1.8; overflow-wrap: anywhere; }
.match-tabs { margin-top: 16px; } .settings-card { margin: 0 0 16px; padding: 22px; background: var(--el-bg-color); border: 1px solid var(--card-border); border-radius: 12px; box-shadow: 0 2px 8px rgba(15, 23, 42, .025); min-width: 0; }
.card-heading { margin-bottom: 16px; } .muted { color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.7; }
.settings-grid, .two-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
.field-label { font-size: 13px; margin: 14px 0 8px; color: var(--el-text-color-regular); } .input-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px 12px; }
.input-grid :deep(.el-checkbox) { margin: 0; min-width: 0; } .input-grid :deep(.el-checkbox__label) { white-space: normal; font-size: 13px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 16px; } .actions .el-button + .el-button { margin-left: 0; }
.resume-file { max-width: 100%; height: auto; min-height: 28px; } .resume-file :deep(span) { white-space: normal; overflow-wrap: anywhere; text-align: left; line-height: 1.6; } .file-action { margin-left: 12px; font-size: 12px; }
.quiet-collapse { border: 0; } .quiet-collapse :deep(.el-collapse-item__header) { font-size: 13px; height: 38px; line-height: 1.5; border: 0; background: transparent; } .quiet-collapse :deep(.el-collapse-item__wrap) { border: 0; }
pre { max-height: 300px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 12px; border-radius: 8px; background: var(--el-fill-color-light); font-size: 12px; line-height: 1.7; }
.save-bar { padding: 4px 0 20px; } .test-actions { flex-wrap: wrap; } .test-actions p { margin: 0; } .decision-card { display: flex; align-items: center; gap: 18px; margin-top: 20px; padding: 18px; border-radius: 10px; background: var(--el-fill-color-light); } .decision-card > strong { font-size: 32px; color: var(--el-color-primary); white-space: nowrap; } .decision-card small { font-size: 13px; color: var(--el-text-color-secondary); } .decision-card p { margin: 4px 0 0; font-size: 13px; } .decision-card > .el-button { margin-left: auto; } .result-details { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.8; }
.prompt-helper { margin: -8px 0 14px; }
@media (max-width: 1080px) { .settings-grid { grid-template-columns: minmax(0, 1fr); } .input-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .settings-card { padding: 16px; } .two-fields, .input-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
