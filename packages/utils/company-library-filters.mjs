export function companyLibraryConditions({ scale = [], industry = [] } = {}) {
  const clauses = [], parameters = {}
  const list = value => {
    const values = typeof value === 'string' ? [value] : value
    if (!Array.isArray(values) || !values.every(item => typeof item === 'string' && item.length <= 500)) throw new Error('公司筛选条件无效')
    return [...new Set(values.filter(Boolean))]
  }
  const scales = list(scale), industries = list(industry)
  if (scales.length) {
    const alternatives = scales.map((value, index) => {
      let range
      try { range = JSON.parse(value) } catch { throw new Error('公司规模筛选无效') }
      if (!Array.isArray(range) || range.length !== 2 || !range.every(n => n === null || (Number.isSafeInteger(n) && n >= 0)) || (range[0] !== null && range[1] !== null && range[0] > range[1])) throw new Error('公司规模筛选无效')
      parameters[`scaleLow${index}`] = range[0]
      parameters[`scaleHigh${index}`] = range[1]
      return `(company.scaleLow IS :scaleLow${index} AND company.scaleHigh IS :scaleHigh${index})`
    })
    clauses.push('(' + alternatives.join(' OR ') + ')')
  }
  if (industries.length) {
    industries.forEach((value, index) => { parameters[`industry${index}`] = value })
    clauses.push(`company.industryName IN (${industries.map((_, index) => `:industry${index}`).join(', ')})`)
  }
  return { clauses, parameters }
}
