<template>
  <section class="matching-flow" aria-label="岗位匹配流程图">
    <header><div class="legend"><span class="on">● 已启用</span><span>● 未启用</span></div></header>
    <div class="input-columns">
      <div v-for="panel in panels" :key="panel.key" class="input-panel">
        <template v-for="(column, index) in panel.columns" :key="column.title">
          <div v-if="index" class="screening-stage"><span aria-hidden="true">↓</span><button type="button" @click="openSetting('regexRules')">程序／正则筛选 ↗</button><span aria-hidden="true">↓</span></div>
          <section class="input-column">
            <h4>{{ column.title }}</h4>
            <div v-for="enabled in [true, false]" :key="String(enabled)" class="input-group" :aria-label="column.title + (enabled ? '已启用' : '未启用')">
              <div class="group-heading">{{ enabled ? column.before ? '已启用 · 用于前置筛选' : '已启用 · 送入模型' : column.before ? '未启用 · 不作前置筛选' : '未启用 · 不送模型' }}</div>
              <button type="button" v-for="item in column.items.filter(value => value.enabled === enabled)" :key="item.key" class="input-node" :class="{ enabled: item.enabled }" :data-stage="column.before ? 'before' : 'model'" :data-input="item.key" :data-enabled="item.enabled" :title="item.note" @click="openSetting(item.key, column.before)">
                <span class="state-dot" /><span>{{ item.label }}{{ ' ↗' }}</span>
              </button>
              <p v-if="!column.items.some(value => value.enabled === enabled)" class="empty-group">无</p>
            </div>
          </section>
        </template>
      </div>
    </div>
    <section class="instructions" aria-label="我的命令与固定审核规则">
      <el-collapse v-model="instructionSections">
        <el-collapse-item name="command"><template #title><strong>我的命令 · 匹配提示词</strong><el-button data-input="prompt" link type="primary" style="margin-left: 12px" @click.stop="openSetting('prompt')">编辑 ↗</el-button></template><div class="instruction-text">{{ payload.userPrompt || '未填写' }}</div></el-collapse-item>
        <el-collapse-item name="system"><template #title><strong>固定审核规则与输出格式</strong><span class="readonly-label">程序内置 · 查看原文</span></template><div class="instruction-text" data-detail="system-rules">{{ payload.systemInstructions || '当前预览未提供系统规则原文' }}</div></el-collapse-item>
      </el-collapse>
    </section>
    <section v-if="info" ref="infoPanel" tabindex="-1" class="info-panel" data-detail="source-info"><header><strong>{{ info.title }}</strong><el-button link @click="infoKey = ''">收起</el-button></header><p>{{ info.text }}</p></section>
    <div class="merge-arrow" :class="{ on: flow.aiEnabled }" aria-hidden="true">↓</div>
    <div class="result-node" :class="{ inactive: !flow.aiEnabled }"><strong>{{ flow.aiEnabled ? 'AI 匹配结果' : 'AI 未启用' }}</strong><span v-if="flow.aiEnabled">评分 · 结论 · 原因 · 差异</span></div>
    <el-collapse class="score-details"><el-collapse-item title="查看评分标准与输出字段" name="score"><div data-detail="score-rules">
      <p>以下是结果格式说明，预览不会生成实际岗位分数。</p>
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
  feedback: { path: '/main-layout/AiJobMatch', query: { focus: 'feedback' } },
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
  salary: { title: '岗位薪资原文 · 当前不发送模型', text: '当前模型接口不发送岗位薪资原文。薪资页面筛选条件可在自动开聊的薪资栏配置，与这个原文字段分开。' }
}[infoKey.value]))
async function openSetting(key: string, before = false) {
  const autoFields = ['city', 'salary', 'experience', 'degree', 'industry', 'scale', 'employmentType', 'bossActivity']
  if (before && ['jobName', 'postDescription', 'positionName'].includes(key)) return router.push({ path: '/main-layout/CommonJobConditionConfig', query: { focus: key } })
  if (before && autoFields.includes(key)) return router.push({ path: '/main-layout/GeekAutoStartChatWithBoss', query: { focus: key === 'bossActivity' ? 'activity' : key === 'employmentType' ? 'employmentType' : key + 'List' } })
  if (!before && ['jobName', 'postDescription'].includes(key)) return router.push({ path: '/main-layout/AiJobMatch', query: { focus: 'ai-' + key } })
  if (!before && key === 'bossActivity') return router.push({ path: '/main-layout/AiJobMatch', query: { focus: 'input-activity' } })
  if (destinations[key]) return router.push(destinations[key])
  if (key === 'system') { instructionSections.value = ['system']; return }
  infoKey.value = key === 'date' ? 'date' : key === 'salary' ? 'salary' : 'metadata'
  await nextTick()
  infoPanel.value?.scrollIntoView({ block: 'center' }); infoPanel.value?.focus({ preventScroll: true })
}
import { jobMatchFlow } from './flow-state.mjs'
const props = defineProps<{ payload: Record<string, any>; savedContext?: Record<string, any> }>()
const flow = computed(() => jobMatchFlow(props.payload, props.savedContext))
const panels = computed(() => [
  { key: 'personal', columns: [{ title: '我的输入', before: false, items: flow.value.personal.filter(item => !['prompt', 'system'].includes(item.key)) }] },
  { key: 'jobs', columns: [{ title: '筛选前岗位字段', before: true, items: flow.value.beforeBoss }, { title: '筛选后送给 AI 的字段', before: false, items: flow.value.boss }] }
])
</script>
<style scoped>
.matching-flow { margin-bottom: 16px; background: var(--el-bg-color); }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; } h3 { font-size: 16px; margin: 0; font-weight: 600; } h4 { font-size: 14px; margin: 0 0 14px; } .legend { display: flex; gap: 12px; color: var(--el-text-color-placeholder); font-size: 12px; white-space: nowrap; }.on { color: var(--el-color-success); }
.screening-stage { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 10px; padding: 10px; margin-bottom: 14px; border-radius: 6px; background: var(--el-fill-color-light); font-size: 12px; }.screening-stage button { border: 0; background: transparent; padding: 0; font: inherit; color: var(--el-color-primary); cursor: pointer; }.screening-stage button:hover { text-decoration: underline; }
.info-panel { border: 1px solid var(--el-border-color-light); padding: 12px; border-radius: 8px; margin-top: 12px; font-size: 13px; line-height: 1.8; }.info-panel p { margin: 0; }
.instructions { margin-top: 16px; border: 1px solid var(--el-border-color-light); border-radius: 8px; padding: 0 12px; }.readonly-label { margin-left: 12px; font-size: 12px; color: var(--el-text-color-secondary); }.instruction-text { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.8; font-size: 13px; }.score-details { margin-top: 8px; font-size: 13px; }.score-details p { color: var(--el-text-color-secondary); }.score-details dt { font-weight: 600; margin-top: 8px; }.score-details dd { margin: 4px 0 0; }.screening-stage { flex-direction: column; gap: 4px; margin: 6px 0; padding: 0; background: transparent; }
.input-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }.input-column { min-width: 0; padding: 16px; border: 1px solid var(--el-border-color-lighter); border-radius: 10px; background: var(--el-fill-color-extra-light); }.input-group { display: flex; flex-wrap: wrap; gap: 5px; }.input-group + .input-group { margin-top: 12px; }.group-heading { flex-basis: 100%; font-size: 11px; color: var(--el-text-color-secondary); margin-bottom: 6px; }
.input-node { display: flex; align-items: center; gap: 8px; padding: 4px 7px; margin-top: 0; border: 1px solid var(--el-border-color-light); background: var(--el-fill-color-light); color: var(--el-text-color-secondary); border-radius: 6px; font-size: 12px; line-height: 1.6; }.input-node > span:nth-child(2) { min-width: 0; overflow-wrap: anywhere; }.input-node small { display: none; }.state-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--el-text-color-placeholder); flex-shrink: 0; }.input-node.enabled { background: var(--el-color-success-light-9); border-color: var(--el-color-success-light-5); color: var(--el-color-success-dark-2); }.enabled .state-dot { background: var(--el-color-success); }.empty-group { font-size: 12px; color: var(--el-text-color-placeholder); margin: 0; }
.merge-arrow { text-align: center; font-size: 28px; line-height: 40px; color: var(--el-text-color-placeholder); }.result-node { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 16px; border: 1px solid var(--el-color-success-light-5); border-radius: 8px; padding: 12px; background: var(--el-color-success-light-9); font-size: 13px; }.result-node.inactive { background: var(--el-fill-color-light); border-color: var(--el-border-color-light); color: var(--el-text-color-secondary); }button.input-node { cursor: pointer; font-family: inherit; }button.input-node:hover { text-decoration: underline; }button.input-node:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
@media (max-width: 700px) { .input-columns { grid-template-columns: 1fr; }header { align-items: flex-start; flex-wrap: wrap; } }
</style>
