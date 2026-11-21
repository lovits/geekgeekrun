import test from 'node:test'
import assert from 'node:assert/strict'
import { companyLibraryConditions } from './company-library-filters.mjs'

test('company filters support either dimension, both together, or no filtering', () => {
  assert.deepEqual(companyLibraryConditions(), { clauses: [], parameters: {} })
  assert.deepEqual(companyLibraryConditions({ scale: '', industry: '' }), { clauses: [], parameters: {} })
  assert.deepEqual(companyLibraryConditions({ industry: '互联网' }), { clauses: ['company.industryName = :industry'], parameters: { industry: '互联网' } })
  assert.deepEqual(companyLibraryConditions({ scale: '[10000,null]' }).parameters, { scaleLow: 10000, scaleHigh: null })
  assert.deepEqual(companyLibraryConditions({ scale: '[null,null]' }).parameters, { scaleLow: null, scaleHigh: null })
  const both = companyLibraryConditions({ scale: '[500,999]', industry: '制造业' })
  assert.equal(both.clauses.length, 3)
  assert.deepEqual(both.parameters, { scaleLow: 500, scaleHigh: 999, industry: '制造业' })
})

test('filter values remain bound parameters and malformed ranges are rejected', () => {
  const industry = "' OR 1=1 --"
  const result = companyLibraryConditions({ industry })
  assert.equal(result.parameters.industry, industry)
  assert.ok(result.clauses.every(clause => !clause.includes(industry)))
  for (const scale of ['broken', '[]', '[1]', '[1,2,3]', '["500",999]', '[-1,5]', '[100,50]', '{}']) {
    assert.throws(() => companyLibraryConditions({ scale }), /筛选无效/)
  }
  assert.throws(() => companyLibraryConditions({ industry: {} }), /筛选条件无效/)
})
