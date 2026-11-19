export function updateCheckDue(lastAttempt, now = Date.now(), force = false) {
  const previous = Date.parse(lastAttempt || '')
  return force || !Number.isFinite(previous) || now - previous >= 86400000 || now < previous
}
