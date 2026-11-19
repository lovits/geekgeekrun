<template>
  <section class="matching-flow" aria-label="岗位匹配流程图">
    <header><h3>模型怎样匹配岗位</h3><div class="legend"><span class="on">● 已启用</span><span>● 未启用</span></div></header>
    <div class="input-columns">
      <section v-for="column in columns" :key="column.title" class="input-column">
        <h4>{{ column.title }}</h4>
        <div v-for="enabled in [true, false]" :key="String(enabled)" class="input-group" :aria-label="column.title + (enabled ? '已启用' : '未启用')">
          <div class="group-heading">{{ enabled ? '已启用 · 进入模型' : '未启用 · 不进入模型' }}</div>
          <div v-for="item in column.items.filter(value => value.enabled === enabled)" :key="item.key" class="input-node" :class="{ enabled: item.enabled }" :data-input="item.key" :data-enabled="item.enabled" :title="item.note">
            <span class="state-dot" /><span>{{ item.label }}</span><small>{{ item.enabled ? '已启用' : item.selected && !flow.aiEnabled ? 'AI未启用' : '未启用' }}</small>
          </div>
          <p v-if="!column.items.some(value => value.enabled === enabled)" class="empty-group">无</p>
        </div>
      </section>
    </div>
    <div class="merge-arrow" :class="{ on: flow.aiEnabled }" aria-hidden="true">↓</div>
    <div class="process-row" :class="{ inactive: !flow.aiEnabled }">
      <div class="process-node"><span class="step">1</span><strong>组合模型输入</strong><p>仅合并上方绿色资料<br />加上匹配提示词与审核规则</p></div>
      <span class="process-arrow" aria-hidden="true">→</span>
      <div class="process-node"><span class="step">2</span><strong>{{ flow.aiEnabled ? 'AI 理解并匹配' : 'AI 匹配未启用' }}</strong><p>{{ flow.aiEnabled ? '理解已提供的条件，比较岗位职责、技能与资格' : '未开启 AI 检查字段，不调用模型' }}</p></div>
      <span class="process-arrow" aria-hidden="true">→</span>
      <div class="process-node"><span class="step">3</span><strong>输出匹配结果</strong><p>{{ flow.aiEnabled ? '基础评分、匹配结论、依据与差异；启用反馈时程序再调整评分' : '不产生 AI 分数；仍按已启用的程序规则筛选' }}</p></div>
    </div>
    <footer>程序规则独立执行，AI 结果参与最终判断；预览本身不会评分或开聊。绿色表示配置已启用，不代表数据已经填写或抓取完整。</footer>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { jobMatchFlow } from './flow-state.mjs'
const props = defineProps<{ payload: Record<string, any> }>()
const flow = computed(() => jobMatchFlow(props.payload))
const columns = computed(() => [{ title: '你的资料与设置', items: flow.value.personal }, { title: 'BOSS 提供的岗位信息', items: flow.value.boss }])
</script>
<style scoped>
.matching-flow { margin-bottom: 16px; background: var(--el-bg-color); }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; } h3 { font-size: 16px; margin: 0; font-weight: 600; } h4 { font-size: 14px; margin: 0 0 14px; } .legend { display: flex; gap: 12px; color: var(--el-text-color-placeholder); font-size: 12px; white-space: nowrap; }.on { color: var(--el-color-success); }
.input-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }.input-column { min-width: 0; padding: 16px; border: 1px solid var(--el-border-color-lighter); border-radius: 10px; background: var(--el-fill-color-extra-light); }.input-group { display: flex; flex-wrap: wrap; gap: 5px; }.input-group + .input-group { margin-top: 12px; }.group-heading { flex-basis: 100%; font-size: 11px; color: var(--el-text-color-secondary); margin-bottom: 6px; }
.input-node { display: flex; align-items: center; gap: 8px; padding: 4px 7px; margin-top: 0; border: 1px solid var(--el-border-color-light); background: var(--el-fill-color-light); color: var(--el-text-color-secondary); border-radius: 6px; font-size: 12px; line-height: 1.6; }.input-node > span:nth-child(2) { min-width: 0; overflow-wrap: anywhere; }.input-node small { display: none; }.state-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--el-text-color-placeholder); flex-shrink: 0; }.input-node.enabled { background: var(--el-color-success-light-9); border-color: var(--el-color-success-light-5); color: var(--el-color-success-dark-2); }.enabled .state-dot { background: var(--el-color-success); }.empty-group { font-size: 12px; color: var(--el-text-color-placeholder); margin: 0; }
.merge-arrow { text-align: center; font-size: 28px; line-height: 40px; color: var(--el-text-color-placeholder); }.process-row { display: grid; grid-template-columns: 1fr 24px 1fr 24px 1fr; align-items: stretch; }.process-node { min-width: 0; border: 1px solid var(--el-color-success-light-5); border-radius: 8px; padding: 12px; background: var(--el-color-success-light-9); }.step { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--el-color-success); color: white; font-size: 11px; margin-right: 7px; }.process-node strong { font-size: 13px; }.process-node p { font-size: 12px; color: var(--el-text-color-regular); line-height: 1.7; margin: 8px 0 0; }.process-arrow { align-self: center; text-align: center; color: var(--el-text-color-placeholder); }.inactive .process-node { background: var(--el-fill-color-light); border-color: var(--el-border-color-light); }.inactive .step { background: var(--el-text-color-placeholder); }footer { margin-top: 12px; font-size: 11px; color: var(--el-text-color-secondary); line-height: 1.7; }
@media (max-width: 700px) { .input-columns { grid-template-columns: 1fr; }.process-row { grid-template-columns: 1fr; gap: 6px; }.process-arrow { transform: rotate(90deg); }header { align-items: flex-start; flex-wrap: wrap; } }
</style>
