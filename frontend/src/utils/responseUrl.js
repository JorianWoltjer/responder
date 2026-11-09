import { CORS_HEADERS, HEADER_ALIAS, hasCORS } from './index.js'
import { getContentTypeForPath } from './mimeTypes.js'

export function encodeQueryComponent(value) {
  const bytes = new TextEncoder().encode(value)
  return Array.from(bytes, (byte) => {
    const alphanumeric =
      (byte >= 0x30 && byte <= 0x39) ||
      (byte >= 0x41 && byte <= 0x5a) ||
      (byte >= 0x61 && byte <= 0x7a)
    return alphanumeric
      ? String.fromCharCode(byte)
      : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
  }).join('')
}

export function buildResponsePath({
  body,
  filename = '',
  status = 200,
  delay = 0,
  headers = new Map(),
  origin = 'https://example.com'
}) {
  const url = new URL(origin)
  url.pathname = filename || ''
  const query = []
  const addParameter = (name, value) => query.push(`${name}=${encodeQueryComponent(String(value))}`)

  if (body) addParameter('body', body)

  if (status !== 200) addParameter('status', status)
  if (delay > 0) addParameter('delay', delay)

  const compactHeaders = new Map(headers)
  if (hasCORS(headers)) {
    addParameter('cors', 'true')
    Object.keys(CORS_HEADERS).forEach((name) => compactHeaders.delete(name))
  }

  for (let [name, value] of compactHeaders) {
    if (!name.trim()) continue

    if (name.toLowerCase() === 'content-type') {
      if (getContentTypeForPath(filename) === value) continue
    }

    name = HEADER_ALIAS[name.toLowerCase()] ?? name
    addParameter(`h[${encodeQueryComponent(name)}]`, value)
  }

  return `${url.pathname}?${query.join('&')}`
}
