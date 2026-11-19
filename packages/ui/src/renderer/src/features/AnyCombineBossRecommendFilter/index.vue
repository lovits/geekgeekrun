<template>
  <div class="job-combo-filter">
    <el-table :data="[modelValue]" border size="small" table-layout="fixed" class="filter-table">
      <el-table-column label="城市" min-width="128">
        <template #default>
          <CityChooser v-model="modelValue.cityList" gt-show-scene="any-combine-boss-recommend-filter">
            <template #default="{ showDialog }"><div class="city-control"><span>{{ modelValue.cityList?.length ? '已选 ' + modelValue.cityList.length + ' 城' : '全国' }}</span><el-button size="small" @click="showDialog">选择</el-button></div></template>
          </CityChooser>
        </template>
      </el-table-column>
      <el-table-column v-if="$slots['employment-type']" label="求职类型" min-width="120"><template #default><slot name="employment-type" /></template></el-table-column>
      <el-table-column v-for="field in fields" :key="field.key" :label="field.label" :min-width="field.key === 'scaleList' ? 140 : 128">
        <template #default>
          <el-select v-model="modelValue[field.key]" :multiple-limit="field.key === 'industryList' ? 3 : 0" multiple clearable :placeholder="'不限'" :aria-label="field.label" popper-class="job-combo-filter-options">
            <template #tag><span v-if="modelValue[field.key]?.length" class="selection-summary">已选 {{ modelValue[field.key]?.length || 0 }} 项</span></template>
            <template v-if="field.key === 'industryList'"><el-option-group v-for="group in industryGroups" :key="group.code" :label="group.name"><el-option v-for="item in group.subLevelModelList" :key="item.code" :label="item.name" :value="item.code" /></el-option-group></template>
            <template v-else><el-option v-for="option in field.options" :key="option.code" :label="option.name" :value="option.code" /></template>
          </el-select>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="selectedGroups.length" class="selected-groups" aria-label="当前已选条件">
      <div v-for="group in selectedGroups" :key="group.key" class="selected-group"><span class="group-label">{{ group.label }}</span><div class="selected-values"><el-tag v-for="item in group.items" :key="item.code" size="small" effect="plain" closable @close="removeValue(group.key, item.code)">{{ item.name }}</el-tag></div></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import conditions from '@geekgeekrun/geek-auto-start-chat-with-boss/internal-config/job-filter-conditions-20241002.json'
import industryGroups from '@geekgeekrun/geek-auto-start-chat-with-boss/internal-config/job-filter-industry-filter-exemption-20241002.json'
import cityData from '@geekgeekrun/geek-auto-start-chat-with-boss/cityGroup.mjs'
import CityChooser from '@renderer/page/MainLayout/GeekAutoStartChatWithBoss/components/CityChooser.vue'
type FilterKey = 'cityList' | 'salaryList' | 'experienceList' | 'degreeList' | 'industryList' | 'scaleList'
const props = defineProps<{ modelValue: Partial<Record<FilterKey, number[]>> }>()
const fields: { key: FilterKey; label: string; options: { code: number; name: string }[] }[] = [
  { key: 'salaryList', label: '薪资待遇', options: conditions.salaryList },
  { key: 'experienceList', label: '工作经验', options: conditions.experienceList },
  { key: 'degreeList', label: '学历要求', options: conditions.degreeList },
  { key: 'industryList', label: '公司行业', options: industryGroups.flatMap(group => group.subLevelModelList) },
  { key: 'scaleList', label: '公司规模', options: conditions.scaleList }
].map(field => ({ ...field, key: field.key as FilterKey, options: field.options.filter(option => option.code !== 0) }))
const cities = (cityData?.zpData?.cityGroup || []).flatMap(group => group.cityList || [])
const selectedGroups = computed(() => [{ key: 'cityList' as FilterKey, label: '城市', options: cities }, ...fields].map(field => ({
  key: field.key, label: field.label, items: (props.modelValue[field.key] || []).map(code => ({ code, name: field.options.find(option => option.code === code)?.name || String(code) }))
})).filter(group => group.items.length))
function removeValue(key: FilterKey, code: number) { props.modelValue[key] = (props.modelValue[key] || []).filter(value => value !== code) }
</script>
<style lang="scss" scoped>
.job-combo-filter { width: 100%; min-width: 0; }
.filter-table { width: 100%; border-radius: 8px; }
.filter-table :deep(th.el-table__cell) { background: var(--el-fill-color-lighter); color: var(--el-text-color-primary); font-weight: 500; }
.filter-table :deep(.el-table__cell) { vertical-align: middle; padding: 12px 0; }
.filter-table :deep(.cell) { padding: 0 10px; line-height: 20px; }
.filter-table :deep(.el-select) { display: block; width: 100%; min-width: 0; }
.filter-table :deep(.el-select__wrapper) { min-height: 32px; box-sizing: border-box; }
.selection-summary { white-space: nowrap; color: var(--el-text-color-regular); font-size: 12px; }
.city-control { display: flex; align-items: center; justify-content: space-between; gap: 4px; height: 32px; padding: 0 6px; border: 1px solid var(--el-border-color); border-radius: 4px; box-sizing: border-box; font-size: 12px; white-space: nowrap; }
.city-control .el-button { padding: 4px 6px; height: 24px; }
.selected-groups { padding: 10px 12px; margin-top: 8px; border-radius: 6px; background: var(--el-fill-color-lighter); display: grid; gap: 8px; }
.selected-group { display: flex; align-items: flex-start; gap: 12px; font-size: 12px; }
.group-label { flex: 0 0 58px; line-height: 24px; color: var(--el-text-color-regular); }
.selected-values { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.selected-values :deep(.el-tag) { height: auto; min-height: 24px; white-space: normal; line-height: 1.5; padding: 2px 8px; }
</style>
