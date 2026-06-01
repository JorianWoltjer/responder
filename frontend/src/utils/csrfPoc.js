// v1: urlencoded, multipart, and JSON bodies, query params — no cookie fields.

export function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function collectParams(searchParams) {
  const fields = []
  for (const [name, value] of searchParams) {
    fields.push({ name, value })
  }
  return fields
}

function parseContentTypeParam(contentType, paramName) {
  const quoted = contentType.match(new RegExp(`${paramName}\\s*=\\s*"([^"]+)"`, 'i'))
  if (quoted) return quoted[1]
  const unquoted = contentType.match(new RegExp(`${paramName}\\s*=\\s*([^;\\s]+)`, 'i'))
  return unquoted ? unquoted[1] : null
}

function parseDispositionParam(disposition, paramName) {
  const quoted = disposition.match(new RegExp(`${paramName}\\s*=\\s*"([^"]*)"`, 'i'))
  if (quoted) return quoted[1]
  const unquoted = disposition.match(new RegExp(`${paramName}\\s*=\\s*([^;\\s]+)`, 'i'))
  return unquoted ? unquoted[1] : null
}

export function parseMultipartBody(body, boundary) {
  const fields = []
  const files = []
  const delimiter = `--${boundary}`

  for (const part of body.split(delimiter)) {
    const trimmed = part.replace(/^\r?\n/, '').replace(/\r?\n$/, '')
    if (!trimmed || trimmed === '--') continue

    const separator = trimmed.search(/\r?\n\r?\n/)
    if (separator < 0) continue

    const headerBlock = trimmed.slice(0, separator)
    let partBody = trimmed.slice(separator).replace(/^\r?\n\r?\n/, '')
    if (partBody.endsWith('\r\n')) {
      partBody = partBody.slice(0, -2)
    } else if (partBody.endsWith('\n')) {
      partBody = partBody.slice(0, -1)
    }

    const partHeaders = {}
    for (const line of headerBlock.split(/\r?\n/)) {
      const colon = line.indexOf(':')
      if (colon > 0) {
        partHeaders[line.slice(0, colon).trim().toLowerCase()] = line
          .slice(colon + 1)
          .trim()
      }
    }

    const disposition = partHeaders['content-disposition'] || ''
    const name = parseDispositionParam(disposition, 'name')
    if (name == null) continue

    const filename = parseDispositionParam(disposition, 'filename')
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

function canUseJsString(content) {
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 0) return false
  }
  return true
}

function formatFileContent(content) {
  if (canUseJsString(content)) {
    return JSON.stringify(content)
  }
  const bytes = [...content].map((char) => char.charCodeAt(0))
  return `new Uint8Array([${bytes.join(', ')}])`
}

function escapeHtmlSingleQuotedAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/'/g, '&#39;')
}

export function buildJsonTextPlainFields(jsonBody) {
  let obj
  try {
    obj = JSON.parse(jsonBody)
  } catch {
    throw new Error('Invalid JSON body')
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('JSON body must be an object')
  }

  const serialized = JSON.stringify({ ...obj, dummy: '' })
  if (!serialized.endsWith('""}')) {
    throw new Error('Could not split JSON body')
  }

  return {
    name: serialized.slice(0, -2),
    value: '"}'
  }
}

function tryParseJsonBody(body) {
  const trimmed = body.trim()
  if (!trimmed) return null
  try {
    const obj = JSON.parse(trimmed)
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      return null
    }
    return trimmed
  } catch {
    return null
  }
}

function parseTextPlainBody(body) {
  const fields = []
  for (const line of body.split('\n')) {
    if (!line) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    fields.push({ name: line.slice(0, eq), value: line.slice(eq + 1) })
  }
  return fields
}

function buildTextPlainFormHtml(method, action, fields) {
  const lines = [
    `<form id=form action="${escapeHtmlAttr(action)}" method="${escapeHtmlAttr(method)}" enctype="text/plain">`
  ]
  for (const { name, value } of fields) {
    lines.push(
      `  <input type="text" name='${escapeHtmlSingleQuotedAttr(name)}' value='${escapeHtmlSingleQuotedAttr(value)}'>`
    )
  }
  lines.push(`  <button type="submit">Submit</button>`, '</form>', '<script>form.submit();</script>')
  return lines.join('\n')
}

export function parseHttpRequest(raw) {
  const text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) {
    throw new Error('Request is empty')
  }

  const lines = text.split('\n')
  const requestMatch = lines[0].trim().match(/^(\w+)\s+(\S+)\s+HTTP\/[\d.]+$/i)
  if (!requestMatch) {
    throw new Error('Invalid request line')
  }

  const method = requestMatch[1].toUpperCase()
  const target = requestMatch[2]

  let i = 1
  const headers = {}
  while (i < lines.length && lines[i].trim() !== '') {
    const colon = lines[i].indexOf(':')
    if (colon > 0) {
      const name = lines[i].slice(0, colon).trim().toLowerCase()
      headers[name] = lines[i].slice(colon + 1).trim()
    }
    i++
  }
  if (i < lines.length) i++

  const body = lines.slice(i).join('\n')

  let scheme = 'https'
  let host
  let pathname
  let queryParams

  if (/^https?:\/\//i.test(target)) {
    const url = new URL(target)
    scheme = url.protocol.replace(':', '')
    host = url.host
    pathname = url.pathname || '/'
    queryParams = url.searchParams
  } else {
    const qIndex = target.indexOf('?')
    pathname = qIndex >= 0 ? target.slice(0, qIndex) : target
    if (!pathname.startsWith('/')) pathname = '/' + pathname
    const qs = qIndex >= 0 ? target.slice(qIndex + 1) : ''
    queryParams = new URLSearchParams(qs)
    host = headers.host
    if (headers['x-forwarded-proto'] === 'http') {
      scheme = 'http'
    }
  }

  const fields = collectParams(queryParams)
  const files = []
  let jsonBody
  let enctype

  const contentType = headers['content-type'] || ''
  const trimmedBody = body.trim()

  if (contentType.includes('multipart/form-data') && trimmedBody) {
    const boundary = parseContentTypeParam(contentType, 'boundary')
    if (!boundary) {
      throw new Error('Missing multipart boundary')
    }
    const parsed = parseMultipartBody(body, boundary)
    fields.push(...parsed.fields)
    files.push(...parsed.files)
  } else if (trimmedBody) {
    jsonBody = tryParseJsonBody(body)
    if (jsonBody) {
      enctype = 'text/plain'
    } else if (contentType.includes('text/plain')) {
      fields.push(...parseTextPlainBody(body))
      enctype = 'text/plain'
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      fields.push(...collectParams(new URLSearchParams(trimmedBody)))
    }
  }

  const action = host ? `${scheme}://${host}${pathname}` : pathname

  return { method, action, fields, files, jsonBody, enctype }
}

export function buildCsrfFormHtml({ method, action, fields, files = [], jsonBody, enctype }) {
  if (jsonBody) {
    const { name, value } = buildJsonTextPlainFields(jsonBody)
    return buildTextPlainFormHtml(method, action, [{ name, value }])
  }

  if (enctype === 'text/plain') {
    return buildTextPlainFormHtml(method, action, fields)
  }

  const hasFiles = files.length > 0
  const formAttrs = [
    'id="form"',
    `action="${escapeHtmlAttr(action)}"`,
    `method="${escapeHtmlAttr(method)}"`
  ]
  if (hasFiles) {
    formAttrs.push('enctype="multipart/form-data"')
  }

  const lines = [`<form ${formAttrs.join(' ')}>`]
  for (const { name, value } of fields) {
    lines.push(
      `  <input type="hidden" name="${escapeHtmlAttr(name)}" value="${escapeHtmlAttr(value)}">`
    )
  }
  for (const { name } of files) {
    lines.push(`  <input type="file" name="${escapeHtmlAttr(name)}">`)
  }
  if (!hasFiles) {
    lines.push(`  <button type="submit">Submit</button>`)
  }
  lines.push('</form>', '<script>')

  if (hasFiles) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      lines.push(`  const content${i} = ${formatFileContent(file.content)};`)
      lines.push(
        `  let file${i} = new File([content${i}], ${JSON.stringify(file.filename)}, { type: ${JSON.stringify(file.contentType)} });`
      )
      lines.push(`  let transfer${i} = new DataTransfer();`)
      lines.push(`  transfer${i}.items.add(file${i});`)
      lines.push(
        `  form.elements[${JSON.stringify(file.name)}].files = transfer${i}.files;`
      )
    }
  }

  lines.push('  form.submit()', '</script>')
  return lines.join('\n')
}
