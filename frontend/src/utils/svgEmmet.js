import { extract } from 'emmet'
import { expandAbbreviation } from 'emmet-monaco-es'

// Emmet's SVG profile: https://docs.emmet.io/cheat-sheet/
const SVG_SNIPPETS = {
  svg: 'svg[xmlns=http://www.w3.org/2000/svg]',
  'svg:xml': 'svg[xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink]',
  a: 'a[xlink:href]',
  g: 'g',
  defs: 'defs',
  symbol: 'symbol[id viewBox]',
  use: 'use[xlink:href]',
  image: 'image[xlink:href x y width height]',
  switch: 'switch',
  foreignObject: 'foreignObject[x y width height]',
  rect: 'rect[x y width height]',
  circle: 'circle[cx cy r]',
  ellipse: 'ellipse[cx cy rx ry]',
  line: 'line[x1 y1 x2 y2]',
  polyline: 'polyline[points]',
  polygon: 'polygon[points]',
  path: 'path[d]',
  text: 'text[x y]',
  tspan: 'tspan[x y]',
  textPath: 'textPath[xlink:href]',
  clipPath: 'clipPath[id]',
  mask: 'mask[id]',
  pattern: 'pattern[id x y width height]',
  linearGradient: 'linearGradient[id x1 y1 x2 y2]',
  radialGradient: 'radialGradient[id cx cy r]',
  stop: 'stop[offset]',
  filter: 'filter[x y width height]',
  feBlend: 'feBlend[in in2 mode]',
  feColorMatrix: 'feColorMatrix[in type values]',
  feComponentTransfer: 'feComponentTransfer[in]',
  feComposite: 'feComposite[in in2 operator]',
  feConvolveMatrix: 'feConvolveMatrix[in order kernelMatrix]',
  feDiffuseLighting: 'feDiffuseLighting[in surfaceScale diffuseConstant]',
  feDisplacementMap: 'feDisplacementMap[in in2 scale]',
  feFlood: 'feFlood[flood-color flood-opacity]',
  feGaussianBlur: 'feGaussianBlur[in stdDeviation]',
  feImage: 'feImage[xlink:href x y width height]',
  feMerge: 'feMerge',
  feMergeNode: 'feMergeNode[in]',
  feMorphology: 'feMorphology[in operator radius]',
  feOffset: 'feOffset[in dx dy]',
  feSpecularLighting: 'feSpecularLighting[in surfaceScale specularConstant specularExponent]',
  feTile: 'feTile[in]',
  feTurbulence: 'feTurbulence[type baseFrequency numOctaves]',
  feDistantLight: 'feDistantLight[azimuth elevation]',
  fePointLight: 'fePointLight[x y z]',
  feSpotLight: 'feSpotLight[x y z pointsAtX pointsAtY pointsAtZ]',
  marker: 'marker[id markerWidth markerHeight refX refY orient]',
  view: 'view[id]',
  animate: 'animate[attributeName from to dur]',
  animateTransform: 'animateTransform[attributeName type from to dur]',
  animateMotion: 'animateMotion',
  mpath: 'mpath[xlink:href]',
  set: 'set[attributeName to]',
  desc: 'desc',
  metadata: 'metadata'
}

const SNIPPET_KEYS = Object.keys(SVG_SNIPPETS)
const KEY_BY_LOWER = new Map(SNIPPET_KEYS.map((key) => [key.toLowerCase(), key]))
const ROOT_KEYS = new Set(['svg', 'svg:xml'])

const field = (index, placeholder) => `\${${index}${placeholder ? ':' + placeholder : ''}}`

function expandConfig(syntax) {
  return {
    type: 'markup',
    syntax,
    snippets: SVG_SNIPPETS,
    options: {
      'output.field': field,
      'output.format': false,
      'output.selfClosingStyle': syntax === 'xml' ? 'xml' : 'html'
    }
  }
}

function elementNames(abbreviation) {
  const names = []
  let quote = ''
  let depth = 0

  for (let i = 0; i < abbreviation.length; i++) {
    const char = abbreviation[i]
    if (quote) {
      if (char === '\\') {
        i++
        continue
      }
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '[' || char === '{') {
      depth++
      continue
    }
    if ((char === ']' || char === '}') && depth) {
      depth--
      continue
    }
    if (depth || !/[\w:-]/.test(char)) continue

    const start = i
    while (i + 1 < abbreviation.length && /[\w:-]/.test(abbreviation[i + 1])) i++
    names.push({ text: abbreviation.slice(start, i + 1), start, end: i + 1 })
  }

  return names
}

function allowed(key, insideSvg) {
  if (!key) return false
  return insideSvg || ROOT_KEYS.has(key)
}

function expandSnippet(abbreviation, syntax) {
  try {
    return expandAbbreviation(abbreviation, expandConfig(syntax)) || undefined
  } catch {
    return undefined
  }
}

export function svgEmmetExpansions(abbreviation, { syntax = 'html', insideSvg = false } = {}) {
  const names = elementNames(abbreviation)
  if (!names.length) return []

  const last = names[names.length - 1]
  const prior = names.slice(0, -1)
  if (prior.some((name) => !allowed(KEY_BY_LOWER.get(name.text.toLowerCase()), insideSvg))) {
    return []
  }

  const typed = last.text.toLowerCase()
  const matches = SNIPPET_KEYS.filter(
    (key) => key.toLowerCase().startsWith(typed) && allowed(key, insideSvg)
  ).sort((a, b) => a.length - b.length || a.localeCompare(b))

  return matches.flatMap((key) => {
    const rewritten =
      abbreviation.slice(0, last.start) + key + abbreviation.slice(last.end)
    const insertText = expandSnippet(rewritten, syntax)
    if (!insertText) return []
    return [
      {
        label: rewritten,
        filterText: last.text,
        insertText,
        exact: key.toLowerCase() === typed
      }
    ]
  })
}

function insideSvg(model, position) {
  const before = model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column
  })
  const opens = before.match(/<svg\b/gi)?.length ?? 0
  const closes = before.match(/<\/svg\b/gi)?.length ?? 0
  return opens > closes
}

function isMarkupText(monaco, model, position) {
  const line = model.getLineContent(position.lineNumber)
  const tokens = monaco.editor.tokenize(line, model.getLanguageId())[0] ?? []
  let index = -1
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (position.column - 1 > tokens[i].offset) {
      index = i
      break
    }
  }
  if (index < 0) return false
  if (tokens[index].type !== '') return false
  if (index === 0) return true
  const previous = tokens[index - 1].type
  return previous === 'delimiter.html' || previous === 'delimiter.xml'
}

function provideSvgCompletions(monaco, model, position, language) {
  if (!isMarkupText(monaco, model, position)) return

  const line = model.getLineContent(position.lineNumber)
  const extracted = extract(line, position.column - 1)
  if (!extracted?.abbreviation) return

  const syntax = language === 'xml' ? 'xml' : 'html'
  const expansions = svgEmmetExpansions(extracted.abbreviation, {
    syntax,
    insideSvg: insideSvg(model, position)
  })
  if (!expansions.length) return

  const range = new monaco.Range(
    position.lineNumber,
    extracted.location + 1,
    position.lineNumber,
    extracted.location + extracted.abbreviation.length + 1
  )

  return {
    suggestions: expansions.map((item, index) => ({
      label: item.label,
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: item.insertText,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      filterText: item.filterText,
      detail: 'Emmet SVG',
      sortText: `${item.exact ? 0 : 1}${String(index).padStart(3, '0')}`
    }))
  }
}

let registration

export function registerSvgEmmet(monaco) {
  if (!monaco || registration?.monaco === monaco) return
  registration?.dispose()

  const disposables = []

  for (const language of ['html', 'xml']) {
    disposables.push(
      monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: ['.', '>', '+', '*', ':', '#'],
        provideCompletionItems(model, position) {
          return provideSvgCompletions(monaco, model, position, language)
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
