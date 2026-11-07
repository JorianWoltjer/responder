// Builds data/svg-completion.js from published SVG sources:
// - data/svg11/*.mod: W3C SVG 1.1 DTD modules (elements, attributes, enumerations)
// - data/svg-definitions.xml: W3C SVG 2 definitions (attributes added after SVG 1.1)
// - @vscode/web-custom-data CSS properties (keyword values and descriptions)
//
// Module order follows the SVG 1.1 DTD driver. The first parameter-entity
// declaration wins, matching XML rules. SVG Fonts are omitted; SVG 2 removed them.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import cssData from '@vscode/web-custom-data/data/browsers.css-data.json' with { type: 'json' }

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dtdDir = join(root, 'data/svg11')
const modules = [
  'svg-datatypes.mod',
  'svg-qname.mod',
  'svg11-model.mod',
  'svg11-attribs.mod',
  'svg-framework.mod',
  'svg-core-attrib.mod',
  'svg-container-attrib.mod',
  'svg-viewport-attrib.mod',
  'svg-paint-attrib.mod',
  'svg-opacity-attrib.mod',
  'svg-graphics-attrib.mod',
  'svg-docevents-attrib.mod',
  'svg-graphevents-attrib.mod',
  'svg-animevents-attrib.mod',
  'svg-xlink-attrib.mod',
  'svg-extresources-attrib.mod',
  'svg-structure.mod',
  'svg-conditional.mod',
  'svg-image.mod',
  'svg-style.mod',
  'svg-shape.mod',
  'svg-text.mod',
  'svg-marker.mod',
  'svg-profile.mod',
  'svg-gradient.mod',
  'svg-pattern.mod',
  'svg-clip.mod',
  'svg-mask.mod',
  'svg-filter.mod',
  'svg-cursor.mod',
  'svg-hyperlink.mod',
  'svg-view.mod',
  'svg-script.mod',
  'svg-animation.mod',
  'svg-extensibility.mod'
]

const present = new Set(readdirSync(dtdDir))
for (const file of modules) {
  if (!present.has(file)) throw new Error(`Missing SVG DTD module ${file}`)
}

const cssByName = new Map()
for (const property of cssData.properties) {
  if (!cssByName.has(property.name)) cssByName.set(property.name, property)
}

const entities = new Map()
const attlists = []

function expand(value, stack = new Set()) {
  return value.replace(/%([\w.-]+);/g, (token, name) => {
    if (stack.has(name) || !entities.has(name)) return token
    const body = entities.get(name)
    if (name.endsWith('.datatype') && !body.trim().startsWith('(')) return token
    stack.add(name)
    const expanded = expand(body, stack)
    stack.delete(name)
    return expanded
  })
}

function included(keyword) {
  const value = keyword.startsWith('%') ? expand(keyword).trim() : keyword.trim()
  return value === 'INCLUDE'
}

function markedEnd(text, start) {
  let depth = 1
  let index = start
  while (index < text.length) {
    if (text.startsWith('<![', index)) {
      depth++
      index = text.indexOf('[', index + 3) + 1
      continue
    }
    if (text.startsWith(']]>', index)) {
      depth--
      if (depth === 0) return index
      index += 3
      continue
    }
    index++
  }
  throw new Error('Unclosed DTD marked section')
}

function processDtd(text) {
  let index = 0
  while (index < text.length) {
    if (text.startsWith('<![', index)) {
      const open = text.indexOf('[', index + 3)
      const end = markedEnd(text, open + 1)
      if (included(text.slice(index + 3, open).trim())) processDtd(text.slice(open + 1, end))
      index = end + 3
      continue
    }
    if (text.startsWith('<!ENTITY', index)) {
      const match = text.slice(index).match(/^<!ENTITY\s+%\s+([\w.-]+)\s+"([\s\S]*?)"\s*>/)
      if (match) {
        if (!entities.has(match[1])) entities.set(match[1], match[2])
        index += match[0].length
        continue
      }
    }
    if (text.startsWith('<!ATTLIST', index)) {
      const end = text.indexOf('>', index)
      attlists.push(text.slice(index + '<!ATTLIST'.length, end))
      index = end + 1
      continue
    }
    index++
  }
}

for (const file of modules) {
  processDtd(readFileSync(join(dtdDir, file), 'utf8').replace(/<!--[\s\S]*?-->/g, ''))
}

function unique(values) {
  return [...new Set(values)]
}

function keywords(property) {
  return (property?.values ?? [])
    .map((value) => value.name)
    .filter((name) => /^(?:[A-Za-z_][\w-]*|\d+)$/.test(name))
}

function keywordUnion(syntax) {
  if (!syntax) return null
  const parts = syntax.split('|').map((part) => part.trim())
  if (parts.length < 2) return null
  if (!parts.every((part) => /^(?:[A-Za-z_][\w-]*|\d+)$/.test(part))) return null
  return parts
}

function paintValues(name) {
  const property = cssByName.get(name)
  const syntax = property?.syntax ?? ''
  const isPaint =
    property?.restrictions?.includes('color') || syntax === '<paint>' || syntax.includes('<color>')
  if (!isPaint) return []
  const values = [...keywords(property), 'currentColor', 'transparent', 'inherit']
  if (syntax === '<paint>' || keywords(property).includes('none')) values.unshift('none')
  return unique(values)
}

function valuesFor(name, datatype, enumeration) {
  if (enumeration)
    return unique(enumeration.filter((value) => /^(?:[A-Za-z_][\w-]*|\d+)$/.test(value)))
  const union = keywordUnion(cssByName.get(name)?.syntax)
  if (union) return unique([...union, 'inherit'])
  if (datatype && /Paint\.datatype|SVGColor\.datatype|Color\.datatype/.test(datatype)) {
    return paintValues(name)
  }
  return paintValues(name)
}

const elements = new Map()

function ensure(name) {
  let element = elements.get(name)
  if (!element) {
    element = { attrs: [], values: new Map() }
    elements.set(name, element)
  }
  return element
}

function addAttr(element, name, values) {
  if (!/^[:A-Za-z_][\w:.-]*$/.test(name) || name.startsWith('on')) return
  if (!element.attrs.includes(name)) element.attrs.push(name)
  if (values?.length && !element.values.has(name)) element.values.set(name, values)
}

const attributePattern =
  /([:\w.-]+)\s+(?:\(([^)]*)\)|(%[\w.-]+;|[A-Z]+))\s*(?:#FIXED\s+(?:'[^']*'|"[^"]*"|\S+)|#IMPLIED|#REQUIRED|'[^']*'|"[^"]*")/g

for (const body of attlists) {
  const expanded = expand(body).trim()
  const name = expanded.match(/^[:A-Za-z_][\w:.-]*/)?.[0]
  if (!name) continue
  const element = ensure(name)
  for (const attr of expanded.matchAll(attributePattern)) {
    const enumeration = attr[2]
      ?.split('|')
      .map((value) => value.trim())
      .filter(Boolean)
    addAttr(element, attr[1], valuesFor(attr[1], attr[3], enumeration))
  }
}

const definitions = readFileSync(join(root, 'data/svg-definitions.xml'), 'utf8')
const categories = new Map()
for (const match of definitions.matchAll(
  /<attributecategory\b([^>]*)>([\s\S]*?)<\/attributecategory>/g
)) {
  const name = match[1].match(/name='([^']*)'/)?.[1]
  if (!name) continue
  const names = []
  const presentation = match[1].match(/presentationattributes='([^']*)'/)?.[1]
  if (presentation) names.push(...presentation.split(',').map((item) => item.trim()))
  for (const attr of match[2].matchAll(/<attribute\b[^>]*\bname='([^']+)'/g)) names.push(attr[1])
  categories.set(name, names.filter(Boolean))
}

const skippedCategories = new Set([
  'aria',
  'document event',
  'window event',
  'global event',
  'document element event',
  'graphical event'
])

for (const match of definitions.matchAll(/<element\b([^>]*)>([\s\S]*?)<\/element>/g)) {
  const open = match[1]
  const name = open.match(/name='([^']*)'/)?.[1]
  if (!name || name === 'unknown') continue
  const element = ensure(name)
  const names = []
  for (const category of (open.match(/attributecategories='([^']*)'/)?.[1] ?? '').split(',')) {
    const categoryName = category.trim()
    if (!categoryName || skippedCategories.has(categoryName)) continue
    names.push(...(categories.get(categoryName) ?? []))
  }
  for (const field of ['geometryproperties', 'attributes']) {
    names.push(
      ...(open.match(new RegExp(`${field}='([^']*)'`))?.[1] ?? '')
        .split(',')
        .map((item) => item.trim())
    )
  }
  for (const attr of match[2].matchAll(/<attribute\b[^>]*\bname='([^']+)'/g)) names.push(attr[1])
  for (const attr of names) addAttr(element, attr, valuesFor(attr))
}

const descriptions = {}
for (const element of elements.values()) {
  for (const name of element.attrs) {
    if (descriptions[name]) continue
    const description = cssByName.get(name)?.description
    if (!description) continue
    const text = description
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    const sentence = text.split(/(?<=\.)\s/)[0]
    descriptions[name] = sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence
  }
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b))
}

const basedNames = [...elements.keys()].filter((name) => {
  const attrs = elements.get(name).attrs
  return attrs.includes('stroke') && attrs.includes('font-family')
})
const base = basedNames.reduce(
  (shared, name) => {
    const attrs = new Set(elements.get(name).attrs)
    return new Set([...shared].filter((attr) => attrs.has(attr)))
  },
  new Set(elements.get(basedNames[0]).attrs)
)
const based = new Set(basedNames)

const completion = {
  base: sorted(base),
  based: sorted(based),
  elements: {},
  values: {},
  overrides: {},
  descriptions
}

for (const name of sorted(elements.keys())) {
  const attrs = elements.get(name).attrs
  completion.elements[name] = sorted(
    based.has(name) ? attrs.filter((attr) => !base.has(attr)) : attrs
  )
}

const valuesByAttr = new Map()
for (const [name, element] of elements) {
  for (const [attr, list] of element.values) {
    if (!valuesByAttr.has(attr)) valuesByAttr.set(attr, new Map())
    const key = sorted(list).join('\n')
    const group = valuesByAttr.get(attr)
    if (!group.has(key)) group.set(key, [])
    group.get(key).push(name)
  }
}

for (const [attr, group] of valuesByAttr) {
  const [majorityKey, majorityTags] = [...group.entries()].sort(
    (a, b) => b[1].length - a[1].length
  )[0]
  completion.values[attr] = majorityKey.split('\n')
  const majority = new Set(majorityTags)
  for (const [key, tags] of group) {
    if (key === majorityKey) continue
    for (const tag of tags) completion.overrides[`${tag}.${attr}`] = key.split('\n')
  }
  for (const [tag, element] of elements) {
    if (element.attrs.includes(attr) && !element.values.has(attr) && !majority.has(tag)) {
      completion.overrides[`${tag}.${attr}`] = []
    }
  }
}

const rect = elements.get('rect')
const animate = elements.get('animate')
const failures = []
function expect(condition, message) {
  if (!condition) failures.push(message)
}
expect(
  rect?.attrs.includes('fill') && rect.attrs.includes('x') && rect.attrs.includes('rx'),
  'rect attributes'
)
expect(!rect?.attrs.includes('d'), 'rect should not have d')
for (const value of ['none', 'currentColor', 'transparent', 'inherit']) {
  expect(rect?.values.get('fill')?.includes(value), `rect fill ${value}`)
}
expect(!rect?.values.get('fill')?.includes('freeze'), 'rect fill is paint')
expect(
  animate?.values.get('fill')?.includes('freeze') && animate.values.get('fill')?.includes('remove'),
  'animate fill'
)
expect(!animate?.values.get('fill')?.includes('none'), 'animate fill is not paint')
expect(elements.get('path')?.attrs.includes('d'), 'path d')
expect(
  elements.get('svg')?.attrs.includes('xmlns') && elements.get('svg')?.attrs.includes('viewBox'),
  'svg root'
)
expect(elements.get('feBlend')?.attrs.includes('mode'), 'feBlend')
expect(
  elements.get('feColorMatrix')?.values.get('type')?.includes('saturate'),
  'feColorMatrix type'
)
expect(elements.get('polygon')?.attrs.includes('points'), 'polygon points')
expect(
  elements.get('linearGradient')?.values.get('gradientUnits')?.includes('objectBoundingBox'),
  'gradientUnits'
)
expect(!elements.has('font') && !elements.has('glyph') && !elements.has('div'), 'excluded elements')
if (failures.length) throw new Error(failures.join('\n'))

const out = join(root, 'data/svg-completion.js')
writeFileSync(
  out,
  `// Generated by npm run svg-data from the SVG 1.1 DTD, the SVG 2 definitions, and VS Code CSS data.\n// Do not edit by hand.\nexport default ${JSON.stringify(completion, null, 2)}\n`
)
console.log(
  `Wrote ${elements.size} elements, ${Object.keys(descriptions).length} descriptions to ${out}`
)
