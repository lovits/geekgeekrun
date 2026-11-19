<template>
  <div class="complete-preview" v-loading="loading">
    <header><div><h2>预览完整设置</h2></div><el-button :loading="loading" @click="refresh">刷新设置</el-button></header>
    <template v-if="config">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="岗位筛选设置" name="jobs">
          <section class="preview-card"><div class="card-heading"><h3>岗位与公司条件</h3></div><JobFilterSettingsPreview :context="context" :switches="{ regex: config.regexFilters, ai: config.aiFilters }" /></section>
        </el-tab-pane>
        <el-tab-pane label="我的资料与偏好" name="personal">
          <section class="preview-card"><div class="card-heading"><h3>我的简历</h3><el-button v-if="config.resumeFileId" link type="primary" @click="previewResume">预览原始简历</el-button></div><p class="muted">{{ config.resumeFileName || '尚未导入文件' }}</p><el-collapse><el-collapse-item title="查看简历内容" name="resume"><div class="readable-text">{{ config.resumeText || '尚未填写简历内容' }}</div></el-collapse-item></el-collapse></section>
          <section class="preview-card"><div class="card-heading"><h3>手写求职偏好</h3><el-button link type="primary" @click="$router.push('/main-layout/AiJobMatch')">编辑资料与偏好</el-button></div><div class="readable-text">{{ config.preferences || '尚未填写' }}</div></section>
          <section class="preview-card"><h3>反馈学习的偏好</h3><div class="readable-text">{{ config.learnedPreferences || '尚无反馈。未标记的岗位不会影响偏好。' }}</div></section>
        </el-tab-pane>
        <el-tab-pane label="模型输入设置" name="input"><p class="muted model-line">当前模型：{{ model.model || '尚未启用' }} · {{ model.reasoningEffort || '默认推理强度' }}</p><JobModelInputPreview v-if="payload" :payload="payload" :saved-context="context" /></el-tab-pane>
      </el-tabs>
    </template>
  </div>
</template>
<script setup lang="ts">
import { ref, onActivated } from 'vue'
import { ElMessage } from 'element-plus'
import JobFilterSettingsPreview from '@renderer/features/JobFilterSettingsPreview/index.vue'
import JobModelInputPreview from '@renderer/features/JobModelInputPreview/index.vue'
const loading = ref(false)
const activeTab = ref('jobs')
const config = ref<Record<string, any> | null>(null)
const context = ref<Record<string, any>>({})
const model = ref<Record<string, any>>({})
const payload = ref<Record<string, any> | null>(null)
async function previewResume() {
  try { await window.electron.ipcRenderer.invoke('preview-job-ai-resume', config.value?.resumeFileId) }
  catch (error) { ElMessage.error(String(error)) }
}

async function refresh() {
  loading.value = true
  try {
    const [snapshot, currentModel] = await Promise.all([window.electron.ipcRenderer.invoke('get-job-matching-preview'), window.electron.ipcRenderer.invoke('get-job-ai-model')])
    config.value = snapshot.config; context.value = snapshot.context; model.value = currentModel; payload.value = snapshot.payload
  } catch (error) { ElMessage.error(String(error)) }
  finally { loading.value = false }
}
onActivated(refresh)
</script>
<style scoped>
.complete-preview { padding: 24px; width: 100%; max-width: 1100px; margin: 0 auto; box-sizing: border-box; flex: 0 0 auto; align-self: flex-start; min-width: 0; overflow: visible; color: var(--el-text-color-primary); font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.7; }
/* The layout adds overflow-hidden to routed pages; let its scroll pane contain this full document. */
.complete-preview h2, .complete-preview h3, .complete-preview strong { font-weight: 600; }
header, .card-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; } header { margin-bottom: 16px; } h2 { margin: 0; font-size: 24px; } h3 { margin: 0 0 16px; font-size: 16px; } header p, .muted { color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.7; margin: 8px 0 0; }
.model-line { margin-bottom: 14px; }
.preview-card { border: 1px solid var(--el-border-color-light); background: var(--el-bg-color); border-radius: 12px; padding: 16px; margin-bottom: 16px; }.card-heading { margin-bottom: 16px; }.card-heading h3 { margin: 0; }.readable-text { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.85; font-size: 14px; } ol { padding-left: 22px; margin: 0; line-height: 1.9; font-size: 14px; } li + li { margin-top: 8px; }.status-list { display: flex; flex-wrap: wrap; gap: 10px; }
@media (max-width: 640px) { .complete-preview { padding: 16px; }.preview-card { padding: 16px; } header, .card-heading { align-items: flex-start; flex-wrap: wrap; } }
</style>
