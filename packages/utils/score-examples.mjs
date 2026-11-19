export function recentScoreExamples(records) {
  return records.map((record, index) => ({ record, index }))
    .sort((a, b) => (Date.parse(b.record.evaluatedAt) || 0) - (Date.parse(a.record.evaluatedAt) || 0) || b.index - a.index)
    .slice(0, 5).map(item => item.record)
}
