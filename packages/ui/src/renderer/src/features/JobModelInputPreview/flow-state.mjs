export function jobMatchFlow(payload = {}) {
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
  return { aiEnabled, personal, boss }
}
