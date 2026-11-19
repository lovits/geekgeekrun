<template>
  <section class="matching-flow" aria-label="岗位匹配流程图">
    <header><div class="legend"><span class="on">● 已启用</span><span>● 未启用</span></div></header>
    <div class="input-columns">
      <section v-for="column in columns" :key="column.title" class="input-column">
        <h4>{{ column.title }}</h4>
        <div v-for="enabled in [true, false]" :key="String(enabled)" class="input-group" :aria-label="column.title + (enabled ? '已启用' : '未启用')">
          <div class="group-heading">{{ enabled ? '已启用' : '未启用' }}</div>
          <component :is="item.key === 'prompt' ? 'button' : 'div'" v-for="item in column.items.filter(value => value.enabled === enabled)" :key="item.key" class="input-node" :class="{ enabled: item.enabled }" :data-input="item.key" :data-enabled="item.enabled" :title="item.note" @click="item.key === 'prompt' && openPrompt()">
            <span class="state-dot" /><span>{{ item.label }}{{ item.key === 'prompt' ? ' ↗' : '' }}</span><small>{{ item.enabled ? '已启用' : item.selected && !flow.aiEnabled ? 'AI未启用' : '未启用' }}</small>
          </component>
          <p v-if="!column.items.some(value => value.enabled === enabled)" class="empty-group">无</p>
        </div>
      </section>
    </div>
    <div class="merge-arrow" :class="{ on: flow.aiEnabled }" aria-hidden="true">↓</div>
    <div class="result-node" :class="{ inactive: !flow.aiEnabled }"><strong>{{ flow.aiEnabled ? '匹配结果' : 'AI 未启用' }}</strong><span v-if="flow.aiEnabled">评分 · 结论 · 原因</span></div>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter()
function openPrompt() { router.push({ path: '/main-layout/AiJobMatch', query: { focus: 'prompt' } }) }
import { jobMatchFlow } from './flow-state.mjs'
const props = defineProps<{ payload: Record<string, any> }>()
const flow = computed(() => jobMatchFlow(props.payload))
const columns = computed(() => [{ title: '输入资料', items: flow.value.personal }, { title: 'BOSS 岗位信息', items: flow.value.boss }])
</script>
<style scoped>
.matching-flow { margin-bottom: 16px; background: var(--el-bg-color); }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; } h3 { font-size: 16px; margin: 0; font-weight: 600; } h4 { font-size: 14px; margin: 0 0 14px; } .legend { display: flex; gap: 12px; color: var(--el-text-color-placeholder); font-size: 12px; white-space: nowrap; }.on { color: var(--el-color-success); }
.input-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }.input-column { min-width: 0; padding: 16px; border: 1px solid var(--el-border-color-lighter); border-radius: 10px; background: var(--el-fill-color-extra-light); }.input-group { display: flex; flex-wrap: wrap; gap: 5px; }.input-group + .input-group { margin-top: 12px; }.group-heading { flex-basis: 100%; font-size: 11px; color: var(--el-text-color-secondary); margin-bottom: 6px; }
.input-node { display: flex; align-items: center; gap: 8px; padding: 4px 7px; margin-top: 0; border: 1px solid var(--el-border-color-light); background: var(--el-fill-color-light); color: var(--el-text-color-secondary); border-radius: 6px; font-size: 12px; line-height: 1.6; }.input-node > span:nth-child(2) { min-width: 0; overflow-wrap: anywhere; }.input-node small { display: none; }.state-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--el-text-color-placeholder); flex-shrink: 0; }.input-node.enabled { background: var(--el-color-success-light-9); border-color: var(--el-color-success-light-5); color: var(--el-color-success-dark-2); }.enabled .state-dot { background: var(--el-color-success); }.empty-group { font-size: 12px; color: var(--el-text-color-placeholder); margin: 0; }
.merge-arrow { text-align: center; font-size: 28px; line-height: 40px; color: var(--el-text-color-placeholder); }.result-node { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 16px; border: 1px solid var(--el-color-success-light-5); border-radius: 8px; padding: 12px; background: var(--el-color-success-light-9); font-size: 13px; }.result-node.inactive { background: var(--el-fill-color-light); border-color: var(--el-border-color-light); color: var(--el-text-color-secondary); }button.input-node { cursor: pointer; font-family: inherit; }button.input-node:hover { text-decoration: underline; }button.input-node:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
@media (max-width: 700px) { .input-columns { grid-template-columns: 1fr; }header { align-items: flex-start; flex-wrap: wrap; } }
</style>
