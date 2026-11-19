export function jobMatchFlow(payload = {}, context = {}) {
  const aiEnabled = Boolean(payload.selectedFields?.length)
  const sources = payload.inputSources || {}
  const item = (key, label, selected, note = '') => ({ key, label, selected: Boolean(selected), enabled: aiEnabled && Boolean(selected), note })
  const personal = [
    ['resume', '简历内容'], ['preferences', '手写求职偏好'], ['feedback', '喜欢／不喜欢反馈'],
    ['employmentAndTraversal', '求职类型与组合方式'], ['regexRules', '公共正则条件'],
    ['pageFilters', '城市、薪资、经验、学历、行业、规模'], ['companyRules', '期望公司与屏蔽规则'], ['activity', '期望 BOSS 活跃度']
  ].map(([key, label]) => item(key, label, sources[key]))
  personal.push(item('prompt', '匹配提示词', true), item('system', '固定审核规则与输出格式', true), item('date', '当前日期（程序提供）', true), item('switches', '筛选范围与开关状态', true))
  const boss = [
    item('jobName', '岗位名称', payload.selectedFields?.includes('jobName')),
    item('postDescription', '完整岗位描述', payload.selectedFields?.includes('postDescription')),
    item('companyCity', '公司、工作城市', true),
    item('facts', '职位类型、经验要求、有效状态', true, '抓取到的数据随岗位提供'),
    item('bossActivity', 'BOSS 实际活跃状态', sources.activity),
    item('salary', '岗位薪资原文', false, '当前匹配接口不发送该字段；用户填写的薪资条件属于左侧资料')
  ]
  const regex = payload.switches?.regex || {}
  const groups = String(context.traversalMode).startsWith('固定') ? context.staticFilterGroups || [] : [context.pageFilters || {}]
  const chosen = key => groups.some(group => {
    const value = group[String(context.traversalMode).startsWith('固定') ? key.replace('List', '') : key]
    return (Array.isArray(value) ? value : [value]).some(it => it != null && it !== '' && it !== 0 && it !== '不限')
  })
  const beforeBoss = [
    ['jobName', '岗位名称', regex.jobName], ['postDescription', '完整岗位描述', regex.postDescription],
    ['positionName', '职位分类', regex.positionName], ['companyRules', '公司名称', regex.companies || regex.blockedCompanies],
    ['city', '工作城市', chosen('cityList') || context.cities?.length],
    ['salary', '薪资', chosen('salaryList') || context.salary?.low || context.salary?.high],
    ['experience', '工作经验', chosen('experienceList') || context.workExperience?.length],
    ['degree', '学历', chosen('degreeList')], ['industry', '行业', chosen('industryList')], ['scale', '公司规模', chosen('scaleList')],
    ['employmentType', '求职类型', context.employmentType], ['bossActivity', 'BOSS 活跃度', context.activityCutoff]
  ].map(([key, label, enabled]) => ({ key, label, selected: Boolean(enabled), enabled: Boolean(enabled), note: '此处表示是否用于程序前置筛选，与是否发送给 AI 分开设置' }))
  return { aiEnabled, personal, boss, beforeBoss }
}
