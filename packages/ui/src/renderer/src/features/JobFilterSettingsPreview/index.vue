<template>
  <div class="settings-preview">
    <dl v-if="includes('employmentAndTraversal')" class="summary-line"><dt>求职类型</dt><dd>{{ employmentLabel }}</dd><dt>遍历方式</dt><dd>{{ traversalLabel }}</dd><template v-if="context.traversalDetails"><dt>组合数</dt><dd>{{ context.traversalDetails.combinationCount }}</dd></template></dl>
    <dl v-if="includes('activity')" class="summary-line"><dt>BOSS活跃度</dt><dd>{{ context.activityRequirement || '未设置' }}</dd></dl>
    <section v-if="includes('pageFilters')" class="combination-section">
      <h4>{{ isFixed ? '固定组合筛选条件' : '自由组合筛选条件' }}</h4>
      <div class="table-scroll"><table class="filter-table"><thead><tr><th v-if="isFixed">组合</th><th v-for="field in filterFields" :key="field.key">{{ field.label }}</th></tr></thead><tbody><tr v-for="(group, index) in combinationRows" :key="index"><td v-if="isFixed">{{ index + 1 }}</td><td v-for="field in filterFields" :key="field.key">{{ displayFilter(field.key, group[isFixed ? field.key.replace('List', '') : field.key]) }}</td></tr></tbody></table></div>
      <p class="helper">{{ isFixed ? '每行是一组条件，依次查找这些组合。不同组合互为替代。' : '上表是当前所选选项。程序会尝试单项和多项搭配，不要求同一个岗位同时满足全部选项。' }}{{ !isFixed && context.traversalDetails ? context.traversalDetails.skipEmpty ? '已跳过最初的空条件组合。' : '会保留最初不限定这些字段的组合；求职类型仍单独生效。' : '' }}</p>
      <dl v-if="context.cities?.length || context.salary?.low || context.salary?.high || context.workExperience?.length" class="extra-conditions"><template v-if="context.cities?.length"><dt>额外工作地限制</dt><dd>{{ cityNames }}</dd></template><template v-if="context.salary?.low || context.salary?.high"><dt>额外薪资限制</dt><dd>{{ salaryLabel }}</dd></template><template v-if="context.workExperience?.length"><dt>额外经验限制</dt><dd>{{ experienceNames }}</dd></template></dl>
    </section>
    <template v-if="includes('companyRules')">
      <section class="rule-field"><div class="rule-heading"><h4>期望公司 <span class="helper">{{ context.companies?.length || 0 }} 项</span></h4><el-tag v-if="switches?.regex" :type="switches.regex.companies ? 'success' : 'info'" effect="plain" size="small">{{ switches.regex.companies ? '启用' : '停用' }}</el-tag></div><ul v-if="context.companies?.length" class="word-tags"><li v-for="(company, index) in context.companies" :key="index">{{ company }}</li></ul><p v-else>未设置具体名单，不限制期望公司。</p></section>
      <section class="rule-field"><div class="rule-heading"><h4>屏蔽公司</h4><el-tag v-if="switches?.regex" :type="switches.regex.blockedCompanies ? 'success' : 'info'" effect="plain" size="small">{{ switches.regex.blockedCompanies ? '启用' : '停用' }}</el-tag></div><p v-if="blocked.empty">未设置具体屏蔽条件。</p><div v-for="(rule, index) in blocked.rules" :key="index" class="rule-detail"><p class="rule-label">公司名称包含下面任一项时排除</p><ul class="word-tags"><li v-for="(item, itemIndex) in rule.items" :key="itemIndex">{{ item }}</li></ul></div></section>
    </template>
    <template v-if="includes('regexRules')">
      <section v-for="field in ruleFields" :key="field.key" class="rule-field"><div class="rule-heading"><h4>{{ field.label }}</h4><el-tag v-if="switches?.regex" :type="switches.regex[field.key] ? 'success' : 'info'" effect="plain" size="small">{{ switches.regex[field.key] ? '启用' : '停用' }}</el-tag></div><div v-for="(rule, index) in field.description.rules" :key="index" class="rule-detail"><p class="rule-label">{{ rule.label }}</p><p v-if="rule.note" class="helper">{{ rule.note }}</p><ul class="word-tags"><li v-for="(item, itemIndex) in rule.items" :key="itemIndex">{{ item }}</li></ul></div><p v-if="!field.description.complete" class="helper">这项自定义规则仍需在编辑页核对；预览不会改变它。</p></section>
      <p class="helper combination-note">{{ context.combinationLogic === 2 ? '已启用且填写了具体内容的字段中，任一字段通过即可。' : '已启用且填写了具体内容的字段必须全部通过。' }} 停用的规则不独立执行；是否提供给模型，见模型输入设置。</p>
    </template>
    <div v-if="editableLinks" class="preview-actions"><el-button size="small" @click="$router.push('/main-layout/GeekAutoStartChatWithBoss')">编辑自动开聊条件</el-button><el-button size="small" @click="openRegex">编辑公共职位筛选</el-button></div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter()
import { describeRegex } from './describe-regex.mjs'
import cityData from '@geekgeekrun/geek-auto-start-chat-with-boss/cityGroup.mjs'
import catalog from '@geekgeekrun/geek-auto-start-chat-with-boss/internal-config/job-filter-conditions-20241002.json'
const props = withDefaults(defineProps<{ context: Record<string, any>; sections?: string[]; editableLinks?: boolean; switches?: Record<string, any> }>(), { editableLinks: true })
const includes = (key: string) => !props.sections || props.sections.includes(key)
const filterFields = [{ key: 'cityList', label: '城市' }, { key: 'salaryList', label: '薪资待遇' }, { key: 'experienceList', label: '工作经验' }, { key: 'degreeList', label: '学历' }, { key: 'industryList', label: '公司行业' }, { key: 'scaleList', label: '公司规模' }]
const isFixed = computed(() => String(props.context.traversalMode).startsWith('固定'))
const traversalLabel = computed(() => isFixed.value ? '固定组合逐组查找' : '自由组合逐组查找')
const combinationRows = computed(() => isFixed.value ? props.context.staticFilterGroups?.length ? props.context.staticFilterGroups : [{}] : [props.context.pageFilters || {}])
const blocked = computed(() => describeRegex(props.context.blockedCompaniesRegex || ''))
const ruleFields = computed(() => [{ key: 'jobName', label: '岗位名称' }, { key: 'positionName', label: '职位类型关键词' }, { key: 'postDescription', label: '岗位描述' }].filter(field => props.context.regex?.[field.key]?.trim()).map(field => ({ ...field, description: describeRegex(props.context.regex[field.key]) })))
const cities = (cityData?.zpData?.cityGroup || []).flatMap(group => group.cityList || [])
const display = (value: any) => Array.isArray(value) ? value.length ? value.join('、') : '不限' : value == null || value === '' ? '不限' : String(value)
const displayFilter = (key: string, value: any) => {
  const values = Array.isArray(value) ? value : value == null ? [] : [value]
  return display(values.map(item => key === 'cityList' ? cities.find(city => Number(city.code) === Number(item))?.name || item : (catalog[key] || []).find(option => Number(option.code) === Number(item))?.name || item))
}
const employmentLabel = computed(() => catalog.jobTypeList.find(item => Number(item.code) === Number(props.context.employmentType))?.name || props.context.employmentType || '不限')
const cityNames = computed(() => displayFilter('cityList', props.context.cities))
const experienceNames = computed(() => displayFilter('experienceList', props.context.workExperience))
const salaryLabel = computed(() => `${props.context.salary?.low || '不限'} — ${props.context.salary?.high || '不限'}`)
function openRegex() { router.push('/main-layout/CommonJobConditionConfig') }
</script>
<style scoped>
.settings-preview { min-width: 0; color: var(--el-text-color-primary); }
h4 { font-size: 14px; font-weight: 600; margin: 0; } p { margin: 0; font-size: 14px; line-height: 1.75; overflow-wrap: anywhere; }
.summary-line, .extra-conditions { display: flex; align-items: baseline; flex-wrap: wrap; gap: 5px 10px; margin: 0 0 14px; font-size: 13px; }.summary-line dt, .extra-conditions dt { color: var(--el-text-color-secondary); }.summary-line dd, .extra-conditions dd { margin: 0 20px 0 0; }
.combination-section { margin: 12px 0 18px; }.combination-section h4 { margin-bottom: 10px; }.table-scroll { overflow-x: auto; }.filter-table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }.filter-table th, .filter-table td { border: 1px solid var(--el-border-color-light); padding: 9px 10px; text-align: left; line-height: 1.6; overflow-wrap: anywhere; vertical-align: top; }.filter-table th { background: var(--el-fill-color-lighter); font-weight: 500; }
.helper { color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.7; margin-top: 6px; }.extra-conditions { margin: 10px 0 0; }
.rule-field { padding: 15px 0; border-top: 1px solid var(--el-border-color-light); }.rule-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }.rule-detail + .rule-detail { margin-top: 12px; }.rule-label { font-size: 13px; color: var(--el-text-color-regular); margin-bottom: 6px; }
.word-tags { display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 6px 0 0; list-style: none; }.word-tags li { width: auto; max-width: 100%; box-sizing: border-box; padding: 3px 8px; border: 1px solid var(--el-border-color-lighter); border-radius: 5px; background: var(--el-fill-color-lighter); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.combination-note { border-top: 1px solid var(--el-border-color-light); padding-top: 10px; }.preview-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }.preview-actions .el-button + .el-button { margin-left: 0; }
@media (max-width: 640px) { .filter-table { min-width: 560px; } }
</style>
