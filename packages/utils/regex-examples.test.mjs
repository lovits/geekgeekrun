import test from 'node:test'
import assert from 'node:assert/strict'
import { regexExamples } from './regex-examples.mjs'
import { buildJobMatchContext } from './job-match-context.mjs'
test('examples update with the expression, including invalid and empty inputs', () => {
 const examples='4天/周 3个月\n周四\n应届'
 assert.deepEqual(regexExamples('应届|\\d+天/周 \\d+个月',examples,'experienceName').items.map(x=>x.matched),[true,false,true])
 assert.deepEqual(regexExamples('周四',examples,'experienceName').items.map(x=>x.matched),[false,true,false])
 assert.deepEqual(regexExamples('^(?![\\s\\S]*(?:春招|秋招|校招))[\\s\\S]*$','后端实习\n秋招开发').items.map(x=>x.matched),[true,false])
 assert.ok(regexExamples('[',examples).error)
 assert.equal(regexExamples('开发','').items.length,0)
})
test('annotations follow the selected regex configuration', () => {
 const boss={regexAnnotations:{jobName:{note:'个人'}},fieldsForUseCommonConfig:{jobDetail:false}},common={regexAnnotations:{experienceName:{note:'经验'},jobName:{note:'公共'}}}
 assert.equal(buildJobMatchContext(boss,common).regexAnnotations.jobName.note,'个人')
 assert.equal(buildJobMatchContext(boss,common).regexAnnotations.experienceName.note,'经验')
 boss.fieldsForUseCommonConfig.jobDetail=true
 assert.equal(buildJobMatchContext(boss,common).regexAnnotations.jobName.note,'公共')
})
