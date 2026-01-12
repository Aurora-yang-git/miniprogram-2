function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Convert a plain string into safe RichText HTML.
 * Supports a tiny subset:
 * - `**bold**` => <b>bold</b>
 * - `\n` => <br/>
 */
function toRichTextHtml(input) {
  const raw = String(input || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!raw) return ''

  let out = ''
  let i = 0
  while (i < raw.length) {
    const start = raw.indexOf('**', i)
    if (start === -1) {
      out += escapeHtml(raw.slice(i))
      break
    }
    out += escapeHtml(raw.slice(i, start))
    const end = raw.indexOf('**', start + 2)
    if (end === -1) {
      // Unmatched marker: treat rest as literal.
      out += escapeHtml(raw.slice(start))
      break
    }
    out += `<b>${escapeHtml(raw.slice(start + 2, end))}</b>`
    i = end + 2
  }

  out = out.replace(/\n/g, '<br/>')
  return `<span>${out}</span>`
}

export { toRichTextHtml }



