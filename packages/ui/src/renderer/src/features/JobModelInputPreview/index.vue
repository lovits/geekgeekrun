<template>
  <div class="input-preview">
    <div class="preview-banner"><div><strong>本次提供给模型的内容</strong><p>只展示实际勾选的资料；预览不调用模型，不会开聊。</p></div><el-tag effect="plain">{{ payload.currentDate }}</el-tag></div>
    <section class="preview-card">
      <h3>输入资料 <el-tooltip placement="right" :enterable="false"><template #content><div style="max-width: 340px; line-height: 1.8">“输入资料”用于决定哪些资料参与模型匹配。勾选后，这类资料会加入模型输入；取消勾选后，这类资料不会发送给模型。这里预览的是已保存设置，不会调用模型，也不会发出开聊消息。</div></template><QuestionFilled style="width: 15px; height: 15px; vertical-align: middle; color: var(--el-text-color-secondary)" aria-label="输入资料说明" /></el-tooltip></h3>
      <div class="source-list"><el-tag v-for="item in sources" :key="item.key" :type="payload.inputSources?.[item.key] ? 'success' : 'info'" effect="plain">{{ item.label }} · {{ payload.inputSources?.[item.key] ? '已提供' : '未提供' }}</el-tag></div>
      <div class="switch-grid"><div><h4>AI 检查字段</h4><p>{{ selectedFieldsLabel }}</p></div><div><h4>独立正则检查</h4><p>{{ enabledRegexLabel }}</p></div></div>
      
    </section>
    <section v-if="payload.inputSources?.preferences" class="preview-card"><h3>手写求职偏好</h3><div class="text-content">{{ payload.preferences || '未填写' }}</div></section>
    <section class="preview-card"><h3>匹配提示词</h3><div class="text-content">{{ payload.userPrompt }}</div></section>
    <section v-if="payload.inputSources?.resume" class="preview-card"><el-collapse><el-collapse-item title="简历内容 · 展开查看完整文本" name="resume"><div class="text-content">{{ payload.resume || '尚未导入' }}</div></el-collapse-item></el-collapse></section>
    <section v-if="contextSections.length" class="preview-card"><h3>本次提供的筛选条件</h3><el-form label-position="top"><JobFilterSettingsPreview :context="payload.filterContext || {}" :sections="contextSections" :editable-links="false" :switches="payload.switches" /></el-form></section>
    <section v-if="savedContext && !payload.inputSources?.pageFilters" class="preview-card"><h3>已保存的组合条件 <el-tag size="small" type="info" effect="plain">未提供给模型</el-tag></h3><p class="muted">当前未勾选「城市、经验、学历等条件」。下面仅供核对页面筛选设置，模型不会读取这些具体选项。</p><JobFilterSettingsPreview :context="savedContext" :sections="['pageFilters']" :editable-links="false" /></section>
    <section v-if="payload.inputSources?.feedback" class="preview-card">
      <h3>喜欢／不喜欢反馈</h3><p class="muted">{{ payload.feedbackRecommendation?.feedbackCount || 0 }} 条明确标记；未标记的岗位不参与学习。</p>
      <h4>反馈学习的偏好</h4><div class="text-content">{{ payload.learnedPreferences || '尚无反馈总结' }}</div>
      <div v-if="payload.feedbackRecommendation" class="switch-grid"><div><h4>内容相似度调整</h4><p>{{ signedAdjustment }} 分 · 最多正负 10 分</p></div><div><h4>正负样本</h4><p>喜欢 {{ payload.feedbackRecommendation.likeCount || 0 }} 条 · 不喜欢 {{ payload.feedbackRecommendation.dislikeCount || 0 }} 条</p></div></div>
      <el-collapse v-if="payload.feedbackExamples?.length"><el-collapse-item title="本次参考的历史岗位" name="examples"><article v-for="(item, index) in payload.feedbackExamples" :key="index" class="feedback-example"><el-tag :type="item.value === 'like' ? 'success' : 'info'" size="small">{{ item.value === 'like' ? '喜欢' : '不喜欢' }}</el-tag><h4>{{ item.company }} · {{ item.jobName }}</h4><div class="text-content">{{ item.description }}</div></article></el-collapse-item></el-collapse>
    </section>
    <section class="preview-card"><el-collapse><el-collapse-item title="固定审核规则与输出要求" name="system"><div class="text-content">{{ payload.systemInstructions }}</div></el-collapse-item></el-collapse></section>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { QuestionFilled } from '@element-plus/icons-vue'
import JobFilterSettingsPreview from '@renderer/features/JobFilterSettingsPreview/index.vue'
const props = defineProps<{ payload: Record<string, any>; savedContext?: Record<string, any> }>()
const sources = [{ key: 'activity', label: 'BOSS活跃度' }, { key: 'resume', label: '简历' }, { key: 'preferences', label: '求职偏好' }, { key: 'employmentAndTraversal', label: '求职类型与遍历方式' }, { key: 'regexRules', label: '公共正则条件' }, { key: 'pageFilters', label: '城市、经验、学历等条件' }, { key: 'companyRules', label: '公司名单与屏蔽规则' }, { key: 'feedback', label: '喜欢／不喜欢反馈' }]
const fieldLabels: Record<string, string> = { jobName: '岗位名称', postDescription: '岗位描述', positionName: '职位类型', companies: '期望公司', blockedCompanies: '屏蔽公司' }
const selectedFieldsLabel = computed(() => (props.payload.selectedFields || []).map((key: string) => fieldLabels[key] || key).join('、') || '未启用')
const enabledRegexLabel = computed(() => Object.entries(props.payload.switches?.regex || {}).filter(([, value]) => value).map(([key]) => fieldLabels[key] || key).join('、') || '未启用')
const contextSections = computed(() => ['employmentAndTraversal', 'regexRules', 'pageFilters', 'companyRules', 'activity'].filter(key => props.payload.inputSources?.[key]))
const signedAdjustment = computed(() => { const value = props.payload.feedbackRecommendation?.adjustment || 0; return value > 0 ? '+' + value : value })
</script>
<style scoped>
.input-preview { color: var(--el-text-color-primary); min-width: 0; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.7; }
.input-preview h3, .input-preview h4, .input-preview strong { font-weight: 600; }
.preview-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 0 12px; border-bottom: 1px solid var(--el-border-color-light); margin-bottom: 14px; }
.preview-banner p, .muted { color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.7; margin: 6px 0 0; }
.preview-card { border: 1px solid var(--el-border-color-light); background: var(--el-bg-color); border-radius: 10px; padding: 16px; margin-bottom: 14px; min-width: 0; }
h3 { margin: 0 0 14px; font-size: 16px; } h4 { font-size: 13px; margin: 16px 0 8px; color: var(--el-text-color-regular); } p { margin: 0; line-height: 1.7; }
.source-list, .job-meta { display: flex; flex-wrap: wrap; gap: 10px; } .source-list .el-tag { height: auto; padding: 6px 10px; white-space: normal; line-height: 1.5; }
.job-meta { color: var(--el-text-color-secondary); font-size: 13px; gap: 12px 24px; }
.switch-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
.text-content { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.85; }
.feedback-example { border-bottom: 1px solid var(--el-border-color-light); padding: 16px 0; }
:deep(.el-collapse) { border: 0; } :deep(.el-collapse-item__header) { background: transparent; line-height: 1.6; min-height: 44px; height: auto; border: 0; } :deep(.el-collapse-item__wrap) { border: 0; }
@media (max-width: 640px) { .preview-banner { align-items: flex-start; } .preview-card { padding: 16px; } .switch-grid { grid-template-columns: minmax(0, 1fr); gap: 0; } }
</style>
