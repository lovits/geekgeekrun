import test from 'node:test'
import assert from 'node:assert/strict'
import { formatJobSalary } from './job-salary.mjs'

test('salary rendering preserves daily/monthly text and never prints missing numeric fields', () => {
  assert.equal(formatJobSalary({ salaryDesc: '200-300元/天', salaryLow: null, salaryHigh: null }), '200-300元/天')
  for (const job of [{}, { salaryLow: null, salaryHigh: null }, { salaryLow: 10 }]) assert.equal(formatJobSalary(job), '未记录')
  assert.equal(formatJobSalary({ salaryLow: 10, salaryHigh: 20, salaryMonth: 13 }), '10-20k* 13薪')
})
