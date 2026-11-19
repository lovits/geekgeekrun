import test from 'node:test'
import assert from 'node:assert/strict'
import { recommendFromFeedback } from './feedback-recommender.mjs'
import { applyFeedbackScore } from './job-feedback.mjs'
const candidate = text => ({ jobInfo: { jobName: '', postDescription: text } })
const feedback = (jobId, value, description) => ({ jobId, value, description, updatedAt: '2026-11-18' })

test('no marks, unmarked jobs, cancellation and unknown vocabulary have zero effect', () => {
  for (const records of [[], [feedback('a', undefined, 'python')], [feedback('a', 'like', 'python'), feedback('a', 'neutral', 'python')]]) {
    assert.equal(recommendFromFeedback(records, candidate('python')).adjustment, 0)
  }
  assert.equal(recommendFromFeedback([feedback('a', 'like', 'python')], candidate('unrelated')).adjustment, 0)
})
test('Rocchio positive and negative centroid similarities match hand-calculated values', () => {
  const labels = [feedback('a', 'like', 'python'), feedback('b', 'like', 'fastapi'), feedback('c', 'dislike', 'sales')]
  const good = recommendFromFeedback(labels, candidate('python'))
  assert.equal(good.likeSimilarity, 0.7071)
  assert.equal(good.dislikeSimilarity, 0)
  assert.equal(good.adjustment, 7)
  assert.equal(recommendFromFeedback(labels, candidate('sales')).adjustment, -10)
  assert.equal(recommendFromFeedback(labels.map(item => ({ ...item, company: 'same company' })), candidate('python')).affinity, good.affinity)
})
test('changed marks rebuild the profile; neutral examples never become negatives', () => {
  const like = feedback('a', 'like', 'python')
  assert.equal(recommendFromFeedback([like], candidate('python')).adjustment, 10)
  assert.equal(recommendFromFeedback([like, { ...like, value: 'dislike' }], candidate('python')).adjustment, -10)
  assert.equal(recommendFromFeedback([like, { ...like, value: 'neutral' }], candidate('python')).feedbackCount, 0)
})
test('related examples use the same TF-IDF and never turn a rejected job into a match', () => {
  const labels = Array.from({ length: 120 }, (_, i) => feedback(String(i), i % 2 ? 'like' : 'dislike', i % 2 ? 'python agent' : 'sales telephone'))
  const recommendation = recommendFromFeedback(labels, candidate('python agent sales telephone'))
  assert.equal(recommendation.feedbackCount, 100)
  assert.equal(recommendation.feedbackExamples.length, 6)
  const result = applyFeedbackScore({ match: false, score: 49 }, { ...recommendation, adjustment: 10 })
  assert.equal(result.match, false); assert.equal(result.score, 49)
})
