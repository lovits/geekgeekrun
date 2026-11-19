// TF-IDF + Rocchio class-centroid feedback, independently implemented in JS.
// Sources: https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.NearestCentroid.html
//          https://nlp.stanford.edu/IR-book/html/htmledition/the-rocchio71-algorithm-1.html
const ignored = new Set(['的', '及', '和', '与', '工作', '岗位', '要求', '负责', '相关', '能力', '熟悉', '实习', '实习生', 'intern', 'the', 'and', 'with', 'for'])
const textOf = item => `${item.jobName || ''} ${item.jobName || ''} ${item.description || ''}`

function terms(text) {
  const counts = new Map()
  const normalized = String(text || '').normalize('NFKC').toLowerCase().slice(0, 14000)
    .replace(/golang/g, 'go').replace(/智能体/g, ' agent ').replace(/服务端/g, '后端').replace(/全站/g, '全栈')
  for (const part of normalized.match(/[a-z][a-z0-9+#.]*|[\u4e00-\u9fff]+/g) || []) {
    const tokens = /[a-z]/.test(part) ? [part.replace(/\.$/, '')] : Array.from({ length: Math.max(0, part.length - 1) }, (_, index) => part.slice(index, index + 2))
    for (const token of tokens) if (!ignored.has(token)) counts.set(token, (counts.get(token) || 0) + 1)
  }
  return counts
}
function normalize(vector) {
  let squared = 0
  for (const weight of vector.values()) squared += weight * weight
  const norm = Math.sqrt(squared)
  return norm ? new Map([...vector].map(([term, weight]) => [term, weight / norm])) : vector
}
function dot(a, b) {
  let value = 0
  for (const [term, weight] of a) value += weight * (b.get(term) || 0)
  return value
}
function centroid(vectors) {
  const sum = new Map()
  for (const vector of vectors) for (const [term, weight] of vector) sum.set(term, (sum.get(term) || 0) + weight / vectors.length)
  return normalize(sum)
}

export function recommendFromFeedback(records, candidate, limit = 6) {
  // Neutral/unmarked jobs never become training examples. Rebuild from current
  // labels so a cancelled or changed mark leaves no stale weight behind.
  const byId = new Map()
  for (const item of records) {
    if (!item.jobId) continue
    if (['like', 'dislike'].includes(item.value)) byId.set(item.jobId, item)
    else byId.delete(item.jobId)
  }
  const labels = [...byId.values()].sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || ''))).slice(-100)
  const documentTerms = labels.map(item => terms(textOf(item)))
  const frequencies = new Map()
  for (const document of documentTerms) for (const term of document.keys()) frequencies.set(term, (frequencies.get(term) || 0) + 1)
  const vectorize = counts => normalize(new Map([...counts].filter(([term]) => frequencies.has(term)).map(([term, count]) => [term, (1 + Math.log(count)) * (Math.log((1 + labels.length) / (1 + frequencies.get(term))) + 1)])))
  const vectors = documentTerms.map(vectorize)
  const target = vectorize(terms(textOf({ jobName: candidate?.jobInfo?.jobName, description: candidate?.jobInfo?.postDescription })))
  const positives = vectors.filter((_, index) => labels[index].value === 'like')
  const negatives = vectors.filter((_, index) => labels[index].value === 'dislike')
  const likeSimilarity = dot(centroid(positives), target)
  const dislikeSimilarity = dot(centroid(negatives), target)
  const affinity = Math.max(-1, Math.min(1, likeSimilarity - dislikeSimilarity))
  const ranked = labels.map((item, index) => ({ ...item, similarity: dot(vectors[index], target) })).sort((a, b) => b.similarity - a.similarity || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
  const feedbackExamples = ['like', 'dislike'].flatMap(value => ranked.filter(item => item.value === value && item.similarity > 0).slice(0, Math.ceil(limit / 2)))
    .slice(0, limit).map(({ jobId, value, company, jobName, description, similarity }) => ({ jobId, value, company, jobName, description: String(description || '').slice(0, 2500), similarity: Number(similarity.toFixed(3)) }))
  return { algorithm: 'rocchio-tfidf-v1', feedbackCount: labels.length, likeCount: positives.length, dislikeCount: negatives.length, likeSimilarity: Number(likeSimilarity.toFixed(4)), dislikeSimilarity: Number(dislikeSimilarity.toFixed(4)), affinity: Number(affinity.toFixed(4)), adjustment: Math.round(10 * affinity), feedbackExamples }
}
