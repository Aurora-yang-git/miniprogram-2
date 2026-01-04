function formatRelativeTime(ts, now = Date.now()) {
  const t = typeof ts === 'number' ? ts : 0
  if (!t) return ''
  const diff = Math.max(0, now - t)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < 2 * minute) return 'Just now'
  if (diff < hour) return `${Math.floor(diff / minute)} min ago`
  if (diff < day) return `${Math.floor(diff / hour)} hours ago`

  const days = Math.floor(diff / day)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export { formatRelativeTime }



