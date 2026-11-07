import svgData from '../../data/svg-completion.js'

const basedElements = new Set(svgData.based)
const ELEMENT_BY_LOWER = new Map(
  Object.keys(svgData.elements).map((name) => [name.toLowerCase(), name])
)

function inComment(text, index) {
  const open = text.lastIndexOf('<!--', index)
  if (open === -1) return false
  return text.lastIndexOf('-->', index) < open
}

function inSvg(before) {
  const opens = before.match(/<svg\b/gi)?.length ?? 0
  const closes = before.match(/<\/svg\b/gi)?.length ?? 0
  return opens > closes
}

function startsWith(name, prefix) {
  return name.toLowerCase().startsWith(prefix.toLowerCase())
}

export function svgTagContext(text, offset) {
  if (inComment(text, offset)) return null

  let quote = ''
  let index = -1
  for (let i = 0; i < offset; i++) {
    const char = text[i]
    if (!quote && text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4)
      if (end === -1 || end + 3 > offset) return null
      i = end + 2
      continue
    }
    if (quote) {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '<') index = i
    else if (char === '>') index = -1
  }
  if (index < 0 || text[index] !== '<') return null
  if ('/!?'.includes(text[index + 1])) return null

  const match = text.slice(index, offset).match(/^<([:\w.-]*)([\s\S]*)$/)
  if (!match) return null
  const [, typedName, rest] = match
  const before = text.slice(0, index)

  if (!/[\s/>]/.test(rest)) {
    return { kind: 'tag', tag: typedName, prefix: typedName, replaceStart: index + 1, before }
  }

  const valueMatch = rest.match(/([:\w.-]+)\s*=\s*(['"])([^'"]*)$/)
  if (valueMatch) {
    return {
      kind: 'value',
      tag: typedName,
      attr: valueMatch[1],
      prefix: valueMatch[3],
      quote: valueMatch[2],
      replaceStart: offset - valueMatch[3].length,
      before
    }
  }

  if (/[:=\w.-]+\s*=\s*$/.test(rest)) {
    const attr = rest.match(/([:\w.-]+)\s*=\s*$/)[1]
    return {
      kind: 'value',
      tag: typedName,
      attr,
      prefix: '',
      quote: '',
      replaceStart: offset,
      before
    }
  }

  const prefix = rest.match(/([:\w.-]*)$/)?.[1] ?? ''
  const used = new Set(
    [...rest.matchAll(/(?:^|[\s/>])([:\w.-]+)\s*=/g)].map((item) => item[1].toLowerCase())
  )
  return {
    kind: 'attr',
    tag: typedName,
    prefix,
    replaceStart: offset - prefix.length,
    before,
    used
  }
}

function attributeNames(tag, language) {
  const names = svgData.elements[tag]
  if (!names) return []
  const all = basedElements.has(tag) ? [...svgData.base, ...names] : names
  if (language === 'xml') return all
  return all.filter(
    (name) => name !== 'id' && name !== 'class' && name !== 'style' && !name.startsWith('xml:')
  )
}

function valueNames(tag, attr) {
  const key = `${tag}.${attr}`
  if (Object.hasOwn(svgData.overrides, key)) return svgData.overrides[key]
  return svgData.values[attr] ?? []
}

export function svgAutocompleteItems(text, offset, { language = 'html' } = {}) {
  const context = svgTagContext(text, offset)
  if (!context) return []

  const inside = inSvg(context.before)
  if (context.kind === 'tag') {
    return Object.keys(svgData.elements)
      .filter((name) => (inside || name === 'svg') && startsWith(name, context.prefix))
      .map((name) => ({
        label: name,
        insertText: name,
        kind: 'element',
        detail: 'SVG',
        replaceStart: context.replaceStart
      }))
  }

  const tag = ELEMENT_BY_LOWER.get(context.tag.toLowerCase())
  if (!tag || (!inside && tag !== 'svg')) return []

  if (context.kind === 'value') {
    const attr = attributeNames(tag, language).find(
      (name) => name.toLowerCase() === context.attr.toLowerCase()
    )
    if (!attr) return []
    return valueNames(tag, attr)
      .filter((value) => startsWith(value, context.prefix))
      .map((value) => ({
        label: value,
        insertText: context.quote ? value : `"${value}"`,
        kind: 'value',
        detail: svgData.descriptions[attr] ?? 'SVG',
        replaceStart: context.replaceStart
      }))
  }

  return attributeNames(tag, language)
    .filter((name) => !context.used.has(name.toLowerCase()) && startsWith(name, context.prefix))
    .map((name) => {
      const hasEquals = /^\s*=/.test(text.slice(offset))
      return {
        label: name,
        insertText: hasEquals ? name : `${name}="$1"`,
        kind: 'attribute',
        detail: svgData.descriptions[name] ?? 'SVG',
        snippet: !hasEquals,
        replaceStart: context.replaceStart
      }
    })
}

let registration

export function registerSvgAutocomplete(monaco) {
  if (!monaco || registration?.monaco === monaco) return
  registration?.dispose()

  const disposables = []
  for (const language of ['html', 'xml']) {
    disposables.push(
      monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: ['<', ' ', '=', '"', "'"],
        provideCompletionItems(model, position) {
          const offset = model.getOffsetAt(position)
          const items = svgAutocompleteItems(model.getValue(), offset, { language })
          if (!items.length) return

          return {
            suggestions: items.map((item) => ({
              label: item.label,
              kind:
                item.kind === 'element'
                  ? monaco.languages.CompletionItemKind.Class
                  : item.kind === 'value'
                    ? monaco.languages.CompletionItemKind.Value
                    : monaco.languages.CompletionItemKind.Property,
              insertText: item.insertText,
              insertTextRules: item.snippet
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
              range: monaco.Range.fromPositions(model.getPositionAt(item.replaceStart), position),
              detail: item.detail,
              sortText: `0${item.label}`
            }))
          }
        }
      })
    )
  }

  registration = {
    monaco,
    dispose() {
      disposables.forEach((disposable) => disposable.dispose())
    }
  }
}
