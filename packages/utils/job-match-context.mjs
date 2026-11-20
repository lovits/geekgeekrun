import { activeDescList } from '../geek-auto-start-chat-with-boss/constant.mjs'
import { calculateTotalCombinations, formatStaticCombineFilters, getStaticCombineFilterKey } from '../geek-auto-start-chat-with-boss/combineCalculator.mjs'

export function buildJobMatchContext(boss = {}, common = {}, targets = [], catalog = {}) {
  const use = boss.fieldsForUseCommonConfig || {}
  const detail = use.jobDetail ? common : boss
  const label = (key, value) => (catalog[key] || []).find(item => Number(item.code) === Number(value))?.name || value
  const describeFilters = (filters = {}) => Object.fromEntries(Object.entries(filters).map(([key, values]) => [key, Array.isArray(values) ? values.map(value => label(key, value)) : values]))
  const free = boss.anyCombineRecommendJobFilter || {}
  const fixed = [...new Map((boss.staticCombineRecommendJobFilterConditions || []).map(group => [getStaticCombineFilterKey(group), group])).values()]
  return {
    employmentType: boss.expectEmploymentType === 1902 ? '实习' : boss.expectEmploymentType,
    activityCutoff: boss.markAsNotActiveSelectedTimeRange || 0,
    activityRequirement: boss.markAsNotActiveSelectedTimeRange ? activeDescList[Number(boss.markAsNotActiveSelectedTimeRange) + 1] || '按自动开聊活跃度设置' : '不限活跃度',
    traversalMode: (boss.combineRecommendJobFilterType ?? 1) === 1 ? '自由组合：同栏多选一起勾选，城市和薪资单选项交叉分组；不拆分多选项、不额外生成不限组。同栏满足任一项，不同栏共同生效' : '固定组合逐组遍历，各组是替代组合',
    traversalDetails: { combinationCount: (boss.combineRecommendJobFilterType ?? 1) === 1 ? calculateTotalCombinations(free) : formatStaticCombineFilters(fixed).length },
    pageFilters: describeFilters(boss.anyCombineRecommendJobFilter),
    staticFilterGroups: fixed.map(group => Object.fromEntries(Object.entries(group).map(([key, value]) => [key, label(key + 'List', value)]))),
    cities: (use.city ? common : boss).expectCityList || [],
    salary: { low: (use.salary ? common : boss).expectSalaryLow, high: (use.salary ? common : boss).expectSalaryHigh, calculateWay: (use.salary ? common : boss).expectSalaryCalculateWay || 1, unit: (use.salary ? common : boss).expectSalaryCalculateWay === 2 ? '万元/年' : '千元/月', note: '未设置上下限代表不限薪资' },
    workExperience: boss.expectWorkExpList || [],
    companies: use.expectCompanies ? common.expectCompanies || [] : targets,
    blockedCompaniesRegex: (use.blockCompanyNameRegExpStr ? common : boss).blockCompanyNameRegExpStr || '',
    regex: { experienceName: common.expectWorkExpRegExpStr || '', jobName: detail.expectJobNameRegExpStr || '', positionName: detail.expectJobTypeRegExpStr || '', postDescription: detail.expectJobDescRegExpStr || '' },
    regexAnnotations: { ...detail.regexAnnotations, experienceName: common.regexAnnotations?.experienceName },
    combinationLogic: detail.jobDetailRegExpMatchLogic,
    interpretation: '以上是用户保存的完整筛选意图。正则用于表达偏好；已勾选项同时在程序中执行硬筛。未勾选项只能作为软偏好背景，不可凭关闭的规则一票否决。解析否定前瞻等语义，不把排除词当成期望词。公司名单和组合条件不是岗位资格证明。空城市列表代表全国、不限。',
  }
}
