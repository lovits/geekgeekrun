<template>
  <section class="matching-flow" aria-label="岗位匹配流程图">
    <div class="input-columns">
      <div v-for="panel in panels" :key="panel.key" class="input-panel" :class="panel.key">
        <template v-for="(column, index) in panel.columns" :key="column.title">
          <div v-if="index" class="screening-stage"><span>筛选通过 ↓</span></div>
          <section class="input-column">
            <h4>{{ column.title }}</h4>
            <div class="group-grid">
              <button v-for="group in column.groups" :key="group.key" type="button" class="setting-group" :class="['state-' + group.state, 'capability-' + group.capability, { 'has-members': group.items.length > 1 }]" :data-stage="column.before ? 'before' : 'model'" :data-input="group.key" :data-state="group.state" @click="openSetting(group.action, column.before)">
                <span class="group-title"><strong>{{ group.label }}</strong><span class="group-arrow" aria-hidden="true">↗</span></span>
                <span class="group-status">{{ group.capability === 'fixed' ? flow.aiEnabled ? '固定提供' : '固定提供 · AI 未启用' : stateLabels[group.state] }}</span>
                <span v-if="group.items.length > 1" class="member-list">
                  <span v-for="item in group.items" :key="item.key" class="member" :class="{ enabled: item.enabled }" :data-member="item.key" :data-enabled="item.enabled" :title="item.label + (item.enabled ? '：已启用' : '：未启用')">{{ item.enabled ? '✓' : '–' }} {{ item.label }}</span>
                </span>
              </button>
            </div>
          </section>
        </template>
      </div>
    </div>
    <section class="instructions" aria-label="匹配提示词与审核规则">
      <el-collapse v-model="instructionSections">
        <el-collapse-item name="command"><template #title><strong>匹配提示词</strong><el-button data-input="prompt" link type="primary" style="margin-left: 12px" @click.stop="openSetting('prompt')">编辑 ↗</el-button></template><div class="instruction-text">{{ payload.userPrompt || '未填写' }}</div></el-collapse-item>
        <el-collapse-item name="system"><template #title><strong>固定审核规则与输出格式</strong></template><div class="instruction-text" data-detail="system-rules">{{ payload.systemInstructions || '当前预览未提供系统规则原文' }}</div></el-collapse-item>
      </el-collapse>
    </section>
    <section v-if="info" ref="infoPanel" tabindex="-1" class="info-panel" data-detail="source-info"><header><strong>{{ info.title }}</strong><el-button link @click="infoKey = ''">收起</el-button></header><p>{{ info.text }}</p></section>
    <div class="merge-arrow" :class="{ on: flow.aiEnabled }" aria-hidden="true">↓</div>
    <div class="result-node" :class="{ inactive: !flow.aiEnabled }"><strong>{{ flow.aiEnabled ? 'AI 匹配结果' : 'AI 未启用' }}</strong><span v-if="flow.aiEnabled">评分 · 结论 · 原因 · 差异</span></div>
    <el-collapse class="score-details"><el-collapse-item title="查看评分标准与输出字段" name="score"><div data-detail="score-rules">
      <dl><dt>基础分（0–100）</dt><dd>职责 40 分、技能 30 分、资格 20 分、偏好 10 分。</dd><dt>最终分</dt><dd>启用反馈时，程序再根据已有喜欢／不喜欢样本调整，最多正负 10 分。</dd><dt>匹配结论</dt><dd>符合／不符合；高分不代表已沟通或已投递。</dd><dt>判断依据</dt><dd>综合条件摘要、具体匹配原因，以及资格或技能差异。</dd></dl>
    </div></el-collapse-item></el-collapse>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter()
const destinations: Record<string, { path: string; query: { focus: string } }> = {
  resume: { path: '/main-layout/AiJobMatch', query: { focus: 'resume' } },
  preferences: { path: '/main-layout/AiJobMatch', query: { focus: 'preferences' } },
  prompt: { path: '/main-layout/AiJobMatch', query: { focus: 'prompt' } },
  companyRules: { path: '/main-layout/CommonJobConditionConfig', query: { focus: 'companies' } },
  regexRules: { path: '/main-layout/CommonJobConditionConfig', query: { focus: 'regex' } },
  feedback: { path: '/main-layout/AiJobMatch', query: { focus: 'input-feedback' } },
  switches: { path: '/main-layout/AiJobMatch', query: { focus: 'scope' } },
  activity: { path: '/main-layout/GeekAutoStartChatWithBoss', query: { focus: 'activity' } },
  employmentAndTraversal: { path: '/main-layout/GeekAutoStartChatWithBoss', query: { focus: 'filters' } },
  pageFilters: { path: '/main-layout/GeekAutoStartChatWithBoss', query: { focus: 'filters' } }
}
const instructionSections = ref<string[]>([])
const infoKey = ref('')
const infoPanel = ref<HTMLElement>()
const info = computed(() => ({
  date: { title: '当前日期 · 自动生成', text: `${props.payload.currentDate || '运行时生成'}（北京时间）。每次构造模型输入时由程序生成，供模型判断发布日期、截止日期、届次及实习时间；不能手动编辑。` },
  metadata: { title: '岗位基础信息 · 来自 BOSS', text: '公司、城市、职位类型、经验要求和有效状态由具体岗位页面提供，随已选岗位字段发送给模型，没有单独的编辑开关。未抓取到的事实不能推断为已知。' },
}[infoKey.value]))
async function openSetting(key: string, before = false) {
  const autoFields = ['city', 'salary', 'experience', 'degree', 'industry', 'scale', 'employmentType', 'bossActivity']
  if (before && ['jobName', 'postDescription', 'positionName'].includes(key)) return router.push({ path: '/main-layout/CommonJobConditionConfig', query: { focus: key } })
  if (before && autoFields.includes(key)) return router.push({ path: '/main-layout/GeekAutoStartChatWithBoss', query: { focus: key === 'bossActivity' ? 'activity' : key === 'employmentType' ? 'employmentType' : key + 'List' } })
  if (!before && ['jobName', 'postDescription'].includes(key)) return router.push({ path: '/main-layout/AiJobMatch', query: { focus: 'ai-' + key } })
  if (!before && key === 'bossActivity') return router.push({ path: '/main-layout/AiJobMatch', query: { focus: 'input-activity' } })
  if (destinations[key]) return router.push(destinations[key])
  if (key === 'system') { instructionSections.value = ['system']; return }
  infoKey.value = key === 'date' ? 'date' : 'metadata'
  await nextTick()
  infoPanel.value?.scrollIntoView({ block: 'center' }); infoPanel.value?.focus({ preventScroll: true })
}
import { jobMatchFlow, groupFlowInputs } from './flow-state.mjs'
const stateLabels: Record<string, string> = { enabled: '已启用', mixed: '部分启用', disabled: '未启用' }
const props = defineProps<{ payload: Record<string, any>; savedContext?: Record<string, any> }>()
const flow = computed(() => jobMatchFlow(props.payload, props.savedContext))
const panels = computed(() => [
  { key: 'personal', columns: [{ title: '用户资料与设置', before: false, groups: groupFlowInputs(flow.value.personal.filter(item => !['prompt', 'system'].includes(item.key)), 'personal') }] },
  { key: 'jobs', columns: [{ title: '筛选前岗位字段', before: true, groups: groupFlowInputs(flow.value.beforeBoss, 'before') }, { title: '筛选后送给 AI 的字段', before: false, groups: groupFlowInputs(flow.value.boss, 'after') }] }
])
</script>
<style scoped>
.matching-flow { color: var(--el-text-color-primary); margin-bottom: 16px; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.input-columns { display: grid; grid-template-columns: 1fr 1fr; align-items: start; gap: 10px; }.input-panel { min-width: 0; }.input-column { padding: 8px; border: 1px solid var(--el-border-color-light); border-radius: 10px; background: var(--el-fill-color-extra-light); }.matching-flow .input-column h4 { font-size: 13px; font-weight: 600; margin: 0 0 4px; }
.group-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; }.setting-group { min-width: 0; min-height: 28px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-content: center; gap: 3px 8px; text-align: left; padding: 4px 7px; border: 1px solid var(--el-border-color-light); border-radius: 7px; background: var(--el-bg-color); color: var(--el-text-color-primary); cursor: pointer; font: inherit; line-height: 1.4; }.setting-group:hover { border-color: var(--el-color-primary); box-shadow: 0 2px 8px rgba(0,0,0,.04); }.setting-group:focus-visible, .info-panel:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 3px; }.setting-group.state-enabled { border-color: var(--el-color-success-light-5); background: var(--el-color-success-light-9); }
.setting-group.state-disabled { background: var(--el-fill-color-light); color: var(--el-text-color-secondary); }.group-title { display: flex; align-items: start; justify-content: space-between; gap: 8px; }.group-title strong { font-size: 12px; font-weight: 600; overflow-wrap: anywhere; }.group-arrow { color: var(--el-text-color-placeholder); }.group-status { display: block; margin-top: 0; white-space: nowrap; font-size: 12px; color: var(--el-text-color-secondary); }.setting-group.state-enabled .group-status { color: var(--el-color-success-dark-2); }.member-list { display: flex; flex-wrap: wrap; grid-column: 1 / -1; gap: 1px 6px; margin-top: 0; }.member { color: var(--el-text-color-secondary); font-size: 11px; }.member.enabled { color: var(--el-color-success-dark-2); }
.screening-stage { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--el-text-color-secondary); font-size: 12px; padding: 4px; }
.instructions { margin-top: 8px; padding: 0 10px; border: 1px solid var(--el-border-color-light); border-radius: 10px; }.instruction-text { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.8; font-size: 13px; }.info-panel { border: 1px solid var(--el-border-color-light); border-radius: 10px; padding: 14px; margin-top: 14px; font-size: 13px; line-height: 1.8; }.info-panel p { margin: 8px 0 0; }
.merge-arrow { text-align: center; font-size: 24px; line-height: 24px; color: var(--el-text-color-placeholder); }.result-node { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 10px; padding: 8px; border: 1px solid var(--el-color-success-light-5); border-radius: 10px; background: var(--el-color-success-light-9); font-size: 13px; }.result-node.inactive { border-color: var(--el-border-color-light); background: var(--el-fill-color-light); color: var(--el-text-color-secondary); }.score-details { margin-top: 8px; font-size: 13px; }.score-details dt { margin-top: 8px; font-weight: 600; }.score-details dd { margin: 4px 0 0; }
:deep(.instructions .el-collapse-item__header), :deep(.score-details .el-collapse-item__header) { min-height: 30px; height: 30px; font-size: 12px; } :deep(.el-collapse-item__content) { padding-bottom: 10px; }
@media (max-width: 760px) { .input-columns { grid-template-columns: 1fr; }.input-column { padding: 14px; }.group-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); } }
</style>
