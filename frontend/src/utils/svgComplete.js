import svgData from '../../data/svg-completion.js'
import {
  SVG_NAMESPACE,
  XHTML_NAMESPACE,
  markupContextAt,
  markupModelContextAt
} from './markupContext.js'

export { SVG_NAMESPACE, XHTML_NAMESPACE }

const basedElements = new Set(svgData.based)
const ELEMENT_BY_LOWER = new Map(
  Object.keys(svgData.elements).map((name) => [name.toLowerCase(), name])
)

function startsWith(name, prefix) {
  return name.toLowerCase().startsWith(prefix.toLowerCase())
}

export function xmlNamespaceAt(text, offset = text.length) {
  return markupContextAt(text, offset, { language: 'xml' }).namespace
}

export function svgTagContext(text, offset, { language = 'html' } = {}) {
  return markupContextAt(text, offset, { language }).tagContext
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

function svgAutocompleteItemsForContext(text, offset, markup, language) {
  const context = markup.tagContext
  if (!context) return []

  const inside = markup.parentNamespace === SVG_NAMESPACE
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

  if (markup.namespace !== SVG_NAMESPACE) return []
  const tag = ELEMENT_BY_LOWER.get(context.tag.toLowerCase())
  if (!tag) return []

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

export function svgAutocompleteItems(text, offset, { language = 'html' } = {}) {
  const markup = markupContextAt(text, offset, { language })
  return svgAutocompleteItemsForContext(text, offset, markup, language)
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
          const markup = markupModelContextAt(model, position, { language })
          const items = svgAutocompleteItemsForContext(model.getValue(), offset, markup, language)
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
