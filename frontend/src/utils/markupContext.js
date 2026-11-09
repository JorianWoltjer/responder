export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
export const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

const HTML_VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])
const HTML_RAW_TEXT_ELEMENTS = new Set(['script', 'style'])
const SVG_HTML_INTEGRATION_POINTS = new Set(['desc', 'foreignobject', 'title'])
const modelCache = new WeakMap()

function localName(name) {
  const colon = name.indexOf(':')
  return (colon < 0 ? name : name.slice(colon + 1)).toLowerCase()
}

function tagEnd(text, start, limit) {
  let quote = ''
  let bracketDepth = 0
  for (let index = start + 1; index < limit; index++) {
    const char = text[index]
    if (quote) {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '[') bracketDepth++
    else if (char === ']' && bracketDepth) bracketDepth--
    else if (char === '>' && !bracketDepth) return index
  }
  return -1
}

function withNamespaceDeclarations(inherited, source) {
  const namespaces = new Map(inherited)
  const declarations = /(?:^|\s)xmlns(?::([A-Za-z_][\w.-]*))?\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  for (const match of source.matchAll(declarations)) {
    namespaces.set(match[1] ?? '', match[2] ?? match[3])
  }
  return namespaces
}

function declaredNamespace(name, namespaces) {
  const colon = name.indexOf(':')
  return namespaces.get(colon < 0 ? '' : name.slice(0, colon))
}

function contentNamespace(stack, language) {
  const parent = stack.at(-1)
  if (!parent) return language === 'html' ? XHTML_NAMESPACE : undefined
  if (
    language === 'html' &&
    parent.namespace === SVG_NAMESPACE &&
    SVG_HTML_INTEGRATION_POINTS.has(parent.localName)
  ) {
    return XHTML_NAMESPACE
  }
  return parent.namespace
}

function elementNamespace(name, namespaces, parentNamespace, language) {
  const declared = declaredNamespace(name, namespaces)
  const element = localName(name)
  if (language === 'html') {
    if (element === 'svg') return SVG_NAMESPACE
    return parentNamespace
  }

  if (declared !== undefined) return declared
  if (element === 'svg' || parentNamespace === SVG_NAMESPACE) return SVG_NAMESPACE
  return parentNamespace
}

function sameTag(left, right, language) {
  return language === 'html' ? left.toLowerCase() === right.toLowerCase() : left === right
}

function popTag(stack, name, language) {
  const index = stack.findLastIndex((entry) => sameTag(entry.name, name, language))
  if (index >= 0) stack.length = index
}

function textContext(stack, language, position = 'text') {
  return {
    position,
    namespace: contentNamespace(stack, language),
    parentNamespace: contentNamespace(stack, language),
    tag: stack.at(-1)?.name,
    parentTag: stack.at(-1)?.name,
    tagContext: null
  }
}

function parseCurrentTag(source, start, stack, language) {
  const match = source.match(/^<\s*([:\w.-]*)/)
  if (!match) return textContext(stack, language, 'tag')

  const tag = match[1]
  const rest = source.slice(match[0].length)
  const inheritedNamespaces = stack.at(-1)?.namespaces ?? new Map()
  const namespaces = withNamespaceDeclarations(inheritedNamespaces, source)
  const parentNamespace = contentNamespace(stack, language)
  const namespace = elementNamespace(tag, namespaces, parentNamespace, language)
  const base = { namespace, parentNamespace, tag, parentTag: stack.at(-1)?.name }

  if (!tag || !/[\s/>]/.test(rest)) {
    return {
      ...base,
      position: 'tag',
      tagContext: {
        kind: 'tag',
        tag,
        prefix: tag,
        replaceStart: start + match[0].length - tag.length
      }
    }
  }

  const valueMatch = rest.match(/([:\w.-]+)\s*=\s*(['"])([^'"]*)$/)
  if (valueMatch) {
    return {
      ...base,
      position: 'value',
      tagContext: {
        kind: 'value',
        tag,
        attr: valueMatch[1],
        prefix: valueMatch[3],
        quote: valueMatch[2],
        replaceStart: start + source.length - valueMatch[3].length
      }
    }
  }

  if (/[:=\w.-]+\s*=\s*$/.test(rest)) {
    const attr = rest.match(/([:\w.-]+)\s*=\s*$/)[1]
    return {
      ...base,
      position: 'value',
      tagContext: {
        kind: 'value',
        tag,
        attr,
        prefix: '',
        quote: '',
        replaceStart: start + source.length
      }
    }
  }

  const prefix = rest.match(/([:\w.-]*)$/)?.[1] ?? ''
  const used = new Set(
    [...rest.matchAll(/(?:^|[\s/>])([:\w.-]+)\s*=/g)].map((item) => item[1].toLowerCase())
  )
  return {
    ...base,
    position: 'attribute',
    tagContext: {
      kind: 'attr',
      tag,
      prefix,
      replaceStart: start + source.length - prefix.length,
      used
    }
  }
}

function rawTextClose(text, start, tag, limit) {
  const expression = new RegExp(`<\\/\\s*${tag}(?=[\\s>])`, 'gi')
  expression.lastIndex = start
  const match = expression.exec(text)
  return match && match.index < limit ? match.index : -1
}

export function markupContextAt(text, offset = text.length, { language = 'html' } = {}) {
  const limit = Math.max(0, Math.min(offset, text.length))
  const stack = []
  let index = 0

  while (index < limit) {
    const parent = stack.at(-1)
    if (
      language === 'html' &&
      parent?.namespace === XHTML_NAMESPACE &&
      HTML_RAW_TEXT_ELEMENTS.has(parent.localName)
    ) {
      const close = rawTextClose(text, index, parent.localName, limit)
      if (close < 0) return textContext(stack, language, 'embedded')
      index = close
    }

    const open = text.indexOf('<', index)
    if (open < 0 || open >= limit) break

    if (text.startsWith('<!--', open)) {
      const end = text.indexOf('-->', open + 4)
      if (end < 0 || end + 3 > limit) return textContext(stack, language, 'comment')
      index = end + 3
      continue
    }
    if (text.startsWith('<![CDATA[', open)) {
      const end = text.indexOf(']]>', open + 9)
      if (end < 0 || end + 3 > limit) return textContext(stack, language, 'cdata')
      index = end + 3
      continue
    }
    if (text.startsWith('<?', open)) {
      const end = text.indexOf('?>', open + 2)
      if (end < 0 || end + 2 > limit) return textContext(stack, language, 'declaration')
      index = end + 2
      continue
    }
    if (text.startsWith('<!', open)) {
      const end = tagEnd(text, open, limit)
      if (end < 0) return textContext(stack, language, 'declaration')
      index = end + 1
      continue
    }

    if (/^<\s*\//.test(text.slice(open, limit))) {
      const end = tagEnd(text, open, limit)
      if (end < 0) return textContext(stack, language, 'closing-tag')
      const closing = text.slice(open, end + 1).match(/^<\s*\/\s*([:\w.-]+)/)
      if (closing) popTag(stack, closing[1], language)
      index = end + 1
      continue
    }

    const end = tagEnd(text, open, limit)
    if (end < 0) return parseCurrentTag(text.slice(open, limit), open, stack, language)

    const source = text.slice(open, end + 1)
    const opening = source.match(/^<\s*([:\w.-]+)/)
    if (opening) {
      const name = opening[1]
      const inheritedNamespaces = stack.at(-1)?.namespaces ?? new Map()
      const namespaces = withNamespaceDeclarations(inheritedNamespaces, source)
      const parentNamespace = contentNamespace(stack, language)
      const namespace = elementNamespace(name, namespaces, parentNamespace, language)
      const element = localName(name)
      const selfClosing =
        /\/\s*>$/.test(source) && (language === 'xml' || namespace === SVG_NAMESPACE)
      const htmlVoid =
        language === 'html' && namespace === XHTML_NAMESPACE && HTML_VOID_ELEMENTS.has(element)
      if (!selfClosing && !htmlVoid) {
        stack.push({ name, localName: element, namespace, namespaces })
      }
    }
    index = end + 1
  }

  return textContext(stack, language)
}

export function markupModelContextAt(model, position, { language = model.getLanguageId() } = {}) {
  const version = model.getVersionId()
  let cached = modelCache.get(model)
  if (!cached || cached.version !== version) {
    cached = { version, text: model.getValue(), contexts: new Map() }
    modelCache.set(model, cached)
  }

  const offset = model.getOffsetAt(position)
  const key = `${language}:${offset}`
  if (!cached.contexts.has(key)) {
    cached.contexts.set(key, markupContextAt(cached.text, offset, { language }))
  }
  return cached.contexts.get(key)
}
