import test from 'node:test'
import assert from 'node:assert/strict'
import { companyLibraryConditions } from './company-library-filters.mjs'

test('company filters support either dimension, both together, or no filtering', () => {
  assert.deepEqual(companyLibraryConditions(), { clauses: [], parameters: {} })
  assert.deepEqual(companyLibraryConditions({ scale: '', industry: '' }), { clauses: [], parameters: {} })
  assert.deepEqual(companyLibraryConditions({ industry: '互联网' }), { clauses: ['company.industryName IN (:industry0)'], parameters: { industry0: '互联网' } })
  assert.deepEqual(companyLibraryConditions({ scale: '[10000,null]' }).parameters, { scaleLow0: 10000, scaleHigh0: null })
  assert.deepEqual(companyLibraryConditions({ scale: '[null,null]' }).parameters, { scaleLow0: null, scaleHigh0: null })
  const both = companyLibraryConditions({ scale: '[500,999]', industry: '制造业' })
  assert.equal(both.clauses.length, 2)
  assert.deepEqual(both.parameters, { scaleLow0: 500, scaleHigh0: 999, industry0: '制造业' })
})

test('filter values remain bound parameters and malformed ranges are rejected', () => {
  const industry = "' OR 1=1 --"
  const result = companyLibraryConditions({ industry })
  assert.equal(result.parameters.industry0, industry)
  assert.ok(result.clauses.every(clause => !clause.includes(industry)))
  for (const scale of ['broken', '[]', '[1]', '[1,2,3]', '["500",999]', '[-1,5]', '[100,50]', '{}']) {
    assert.throws(() => companyLibraryConditions({ scale }), /筛选无效/)
  }
  assert.throws(() => companyLibraryConditions({ industry: {} }), /筛选条件无效/)
})

test('multiple scales are OR alternatives and industries combine as a second condition', () => {
  const result = companyLibraryConditions({ scale: ['[500,999]', '[1000,9999]', '[500,999]'], industry: ['互联网', '人工智能', '互联网'] })
  assert.equal(result.clauses.length, 2)
  assert.match(result.clauses[0], / OR /)
  assert.match(result.clauses[1], /IN \(:industry0, :industry1\)/)
  assert.deepEqual(result.parameters, { scaleLow0: 500, scaleHigh0: 999, scaleLow1: 1000, scaleHigh1: 9999, industry0: '互联网', industry1: '人工智能' })
  assert.deepEqual(companyLibraryConditions({ scale: [], industry: [] }), { clauses: [], parameters: {} })
  assert.throws(() => companyLibraryConditions({ scale: [null] }), /筛选条件无效/)
  assert.throws(() => companyLibraryConditions({ industry: [123] }), /筛选条件无效/)
})
