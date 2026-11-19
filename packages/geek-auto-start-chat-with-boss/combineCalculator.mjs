function selectedValues(filters, key) {
  return [...new Set((Array.isArray(filters[key]) ? filters[key] : []).filter(value => value != null && value !== '' && value !== 0 && value !== '0'))]
}

export function* combineFiltersWithConstraintsGenerator(selectedFilters = {}) {
  const cities = selectedValues(selectedFilters, 'cityList')
  const salaries = selectedValues(selectedFilters, 'salaryList')
  const multiple = Object.fromEntries(['experienceList', 'degreeList', 'scaleList', 'industryList'].map(key => [key, selectedValues(selectedFilters, key)]))
  if (multiple.industryList.length > 3) throw new Error('BOSS 公司行业最多同时勾选三项，请减少行业选项；不会拆分或忽略已选行业')
  // BOSS city and salary are single-select; every multi-select column stays intact.
  for (const city of cities.length ? cities.map(value => [value]) : [[]]) {
    for (const salary of salaries.length ? salaries.map(value => [value]) : [[]]) {
      yield { cityList: [...city], salaryList: [...salary], ...Object.fromEntries(Object.entries(multiple).map(([key, values]) => [key, [...values]])) }
    }
  }
}

export function calculateTotalCombinations(selectedFilters = {}) {
  return Math.max(1, selectedValues(selectedFilters, 'cityList').length) * Math.max(1, selectedValues(selectedFilters, 'salaryList').length)
}

export function checkAnyCombineBossRecommendFilterHasCondition(value) {
  if (!Object.keys(value ?? {}).length) {
    return false
  }
  return Object.keys(value).some((k) => {
    return !!value[k]?.length
  })
}

export function getStaticCombineFilterKey(condition) {
  const kAsO = {}
  for (const key of Object.keys(condition ?? []).sort()) {
    if (condition[key] === null || condition[key] === undefined) {
      continue
    }
    kAsO[key] = condition[key]
  }
  return JSON.stringify(kAsO)
}

export function formatStaticCombineFilters(rawStaticCombineRecommendJobFilterConditions) {
  rawStaticCombineRecommendJobFilterConditions = JSON.parse(JSON.stringify(rawStaticCombineRecommendJobFilterConditions))
  const map = new Map()
  for (const condition of rawStaticCombineRecommendJobFilterConditions ?? []) {    
    const key = getStaticCombineFilterKey(condition)
    map.set(key, condition)
  }
  const conditions = Array.from(map.values())
  const result = conditions.map((condition) => {
    return {
      cityList: condition.city ? [condition.city] : [],
      salaryList: condition.salary ? [condition.salary] : [],
      experienceList: condition.experience ? [condition.experience] : [],
      degreeList: condition.degree ? [condition.degree] : [],
      scaleList: condition.scale ? [condition.scale] : [],
      industryList: condition.industry ? [condition.industry] : []
    }
  })
  if (!result.length) {
    result.push({
      cityList: [],
      salaryList: [],
      experienceList: [],
      degreeList: [],
      scaleList: [],
      industryList: []
    })
  }
  return result
}
