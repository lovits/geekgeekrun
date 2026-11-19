<template>
  <div class="company-editor">
    <div class="company-tags" :aria-label="label + '名单'">
      <el-tag v-for="(item, index) in entries" :key="index" closable effect="plain" tabindex="0" @close="remove(index)" @keydown.delete.prevent="remove(index)" @keydown.backspace.prevent="remove(index)">{{ item.label }}</el-tag>
      <span v-if="!entries.length" class="empty">尚未添加公司</span>
    </div>
    <div class="add-company">
      <el-input v-model="newCompany" :aria-label="'添加' + label" placeholder="输入公司名称" clearable @keyup.enter="add" />
      <el-button :aria-label="'添加' + label + '标签'" :disabled="!newCompany.trim()" @click="add">＋ 添加</el-button>
      <span class="count">{{ entries.length }} 项</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { companyEntries, addCompany, removeCompany } from './company-list.mjs'
const props = withDefaults(defineProps<{ modelValue: string; label: string; regex?: boolean }>(), { regex: false })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const newCompany = ref('')
const entries = computed(() => companyEntries(props.modelValue, props.regex))
function add() { emit('update:modelValue', addCompany(props.modelValue, newCompany.value, props.regex)); newCompany.value = '' }
function remove(index: number) { emit('update:modelValue', removeCompany(props.modelValue, index, props.regex)) }
</script>
<style scoped>
.company-editor { width: 100%; min-width: 0; }.company-tags { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 8px; max-height: 240px; overflow-y: auto; padding: 12px; border: 1px solid var(--el-border-color); border-radius: 8px; box-sizing: border-box; }.company-tags :deep(.el-tag) { height: auto; min-height: 26px; white-space: normal; overflow-wrap: anywhere; max-width: 100%; }.company-tags :deep(.el-tag__content) { min-width: 0; }.company-tags :deep(.el-tag__close) { flex-shrink: 0; opacity: 0; pointer-events: none; transition: opacity .12s; }.company-tags :deep(.el-tag:hover .el-tag__close), .company-tags :deep(.el-tag:focus-visible .el-tag__close) { opacity: 1; pointer-events: auto; }.add-company { display: flex; gap: 8px; align-items: center; margin-top: 10px; }.add-company .el-input { width: 240px; max-width: 65%; }.empty,.count { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
