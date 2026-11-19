import assert from 'node:assert/strict'
import { test } from 'node:test'
import { combineFiltersWithConstraintsGenerator, calculateTotalCombinations, formatStaticCombineFilters } from './combineCalculator.mjs'

test('multi-select columns stay together in a single group without extra unlimited groups', () => {
  const selected = { cityList: ['上海'], experienceList: [108, 102, 101], degreeList: [203, 204], scaleList: [304, 305, 306], industryList: [100020, 100021] }
  const groups = [...combineFiltersWithConstraintsGenerator(selected)]
  assert.deepEqual(groups, [{ ...selected, salaryList: [] }])
  assert.equal(calculateTotalCombinations(selected), 1)
})

test('only single-select city and salary options produce cross-product groups', () => {
  const selected = { cityList: ['上海', '北京'], salaryList: [402, 403, 404], experienceList: [108, 102], degreeList: [203, 204], scaleList: [304, 305, 306], industryList: [100020] }
  const groups = [...combineFiltersWithConstraintsGenerator(selected)]
  assert.deepEqual(groups.map(group => [group.cityList[0], group.salaryList[0]]), [['上海',402], ['上海',403], ['上海',404], ['北京',402], ['北京',403], ['北京',404]])
  assert.equal(calculateTotalCombinations(selected), 6)
  for (const group of groups) {
    for (const key of ['experienceList', 'degreeList', 'scaleList', 'industryList']) assert.deepEqual(group[key], selected[key])
    assert.equal(group.cityList.length, 1)
    assert.equal(group.salaryList.length, 1)
  }
  groups[0].scaleList.pop()
  assert.equal(groups[1].scaleList.length, 3)
  assert.equal(selected.scaleList.length, 3)
})

test('empty or legacy unlimited values never add a query beside selected values', () => {
  for (const selected of [undefined, {}, { cityList: [], salaryList: [], scaleList: [] }]) {
    assert.equal([...combineFiltersWithConstraintsGenerator(selected)].length, 1)
    assert.equal(calculateTotalCombinations(selected), 1)
  }
  const selected = { cityList: ['上海', '上海'], salaryList: [0, 403, 403, null, ''], scaleList: [0, 304, 305, 304] }
  const [group] = [...combineFiltersWithConstraintsGenerator(selected)]
  assert.deepEqual(group.cityList, ['上海'])
  assert.deepEqual(group.salaryList, [403])
  assert.deepEqual(group.scaleList, [304, 305])
  assert.equal(calculateTotalCombinations(selected), 1)
})

test('unsupported industry counts stop instead of dropping selections or splitting them', () => {
  assert.throws(() => [...combineFiltersWithConstraintsGenerator({ industryList: [1,2,3,4] })], /最多同时勾选三项/)
})

test('fixed groups remain separate and deduplicated', () => {
  const groups = formatStaticCombineFilters([{ scale: 304 }, { scale: 305 }, { scale: 304 }])
  assert.deepEqual(groups.map(group => group.scaleList), [[304], [305]])
})
