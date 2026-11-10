import { CORS_HEADERS, HEADER_ALIAS, HTTP_HEADERS, hasCORS } from './index.js'
import { getContentTypeForPath } from './mimeTypes.js'

const MAX_DELAY_MS = 5 * 60 * 1000
const HEADER_NAMES = new Map(HTTP_HEADERS.map((name) => [name.toLowerCase(), name]))
const HEADER_NAMES_BY_ALIAS = new Map(
  Object.entries(HEADER_ALIAS).map(([name, alias]) => [alias, name])
)

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

function parseStatus(value) {
  if (value === undefined) return 200
  if (!/^\d+$/.test(value)) throw new Error('The response status must be a whole number.')

  const status = Number(value)
  if (status < 100 || status > 699)
    throw new Error('The response status must be between 100 and 699.')
  return status
}

function parseDelay(value) {
  if (value === undefined) return 0

  const trimmed = value.trim()
  const number = Number(trimmed)
  if (!trimmed || !Number.isFinite(number) || number < 0) {
    throw new Error('The response delay is invalid.')
  }

  const delay = Math.round(number)
  if (delay > MAX_DELAY_MS) throw new Error('The response delay cannot exceed 5 minutes.')
  return delay
}

function canonicalHeaderName(name) {
  const lowercaseName = name.toLowerCase()
  const expandedName = HEADER_NAMES_BY_ALIAS.get(name) ?? lowercaseName
  return HEADER_NAMES.get(expandedName) ?? name
}

function parseHeaders(searchParams) {
  const headers = []

  for (const [parameter, value] of searchParams) {
    const match = /^h\[([^\]]+)\]$/.exec(parameter)
    if (!match || !match[1].trim()) continue
    headers.push([canonicalHeaderName(match[1]), value])
  }

  const corsEnabled = searchParams.get('cors') === 'true'
  if (!corsEnabled) return headers

  const corsHeaderNames = new Set(Object.keys(CORS_HEADERS).map((name) => name.toLowerCase()))
  return [
    ...Object.entries(CORS_HEADERS),
    ...headers.filter(([name]) => !corsHeaderNames.has(name.toLowerCase()))
  ]
}

function parseFilename(pathname) {
  try {
    return decodeURIComponent(pathname).replace(/^\/+/, '')
  } catch {
    throw new Error('The response URL contains an invalid path.')
  }
}

/**
 * Read a generated response URL back into the values represented by the editor UI.
 */
export function parseResponseUrl(value, origin = 'https://example.com') {
  let url
  try {
    url = new URL(String(value).trim(), origin)
  } catch {
    throw new Error('Enter a valid response URL.')
  }

  const searchParams = url.searchParams
  const body = searchParams.has('body') ? searchParams.get('body') : undefined
  const gist = searchParams.has('gist') ? searchParams.get('gist') : undefined

  return {
    filename: parseFilename(url.pathname),
    body: body ?? '',
    gist: body === undefined ? gist : undefined,
    status: parseStatus(searchParams.has('status') ? searchParams.get('status') : undefined),
    delay: parseDelay(searchParams.has('delay') ? searchParams.get('delay') : undefined),
    headers: parseHeaders(searchParams)
  }
}

export function buildResponsePath({
  body,
  gist,
  filename = '',
  status = 200,
  delay = 0,
  headers = [],
  origin = 'https://example.com'
}) {
  const url = new URL(origin)
  url.pathname = filename || ''
  const query = []
  const addParameter = (name, value) => query.push(`${name}=${encodeQueryComponent(String(value))}`)

  if (gist !== undefined) addParameter('gist', String(gist).trim())
  else if (body) addParameter('body', body)

  if (status !== 200) addParameter('status', status)
  if (delay > 0) addParameter('delay', delay)

  let compactHeaders = Array.from(headers)
  if (hasCORS(headers)) {
    addParameter('cors', 'true')
    compactHeaders = compactHeaders.filter(([name]) => !Object.hasOwn(CORS_HEADERS, name))
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
