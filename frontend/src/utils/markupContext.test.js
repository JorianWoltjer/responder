import assert from 'node:assert/strict'
import test from 'node:test'

import {
  SVG_NAMESPACE,
  XHTML_NAMESPACE,
  markupContextAt,
  markupModelContextAt
} from './markupContext.js'

test('switches namespaces across HTML, SVG, and foreignObject content', () => {
  const html = '<main><svg><foreignObject><div>text'
  assert.equal(markupContextAt(html).namespace, XHTML_NAMESPACE)

  const svg = `${html}</div></foreignObject><rect`
  const context = markupContextAt(svg)
  assert.equal(context.position, 'tag')
  assert.equal(context.parentNamespace, SVG_NAMESPACE)
  assert.equal(context.tagContext.prefix, 'rect')
})

test('uses HTML content semantics at every SVG integration point', () => {
  for (const integrationPoint of ['desc', 'foreignObject', 'title']) {
    const source = `<svg><${integrationPoint}><span`
    assert.equal(markupContextAt(source).parentNamespace, XHTML_NAMESPACE)
  }
})

test('tracks explicit and prefixed XML namespaces', () => {
  const source = `<svg:svg xmlns:svg="${SVG_NAMESPACE}">
  <svg:foreignObject><xhtml:div xmlns:xhtml="${XHTML_NAMESPACE}">text`
  assert.equal(
    markupContextAt(source, source.length, { language: 'xml' }).namespace,
    XHTML_NAMESPACE
  )
})

test('ignores markup-like text in comments, CDATA, and HTML raw text', () => {
  const comment = '<!-- <svg><rect> -->text'
  assert.equal(markupContextAt(comment).namespace, XHTML_NAMESPACE)

  const cdata = `<svg xmlns="${SVG_NAMESPACE}"><![CDATA[</svg><html>]]><rect`
  assert.equal(
    markupContextAt(cdata, cdata.length, { language: 'xml' }).parentNamespace,
    SVG_NAMESPACE
  )

  const script = '<script>const value = "<svg><rect>"'
  const scriptContext = markupContextAt(script)
  assert.equal(scriptContext.position, 'embedded')
  assert.equal(scriptContext.namespace, XHTML_NAMESPACE)
})

test('does not keep self-closing SVG elements on the namespace stack', () => {
  const source = '<main><svg /></main><re'
  const context = markupContextAt(source)
  assert.equal(context.parentNamespace, XHTML_NAMESPACE)
})

test('does not apply XML namespace declarations or self-closing semantics to HTML elements', () => {
  const declared = `<div xmlns="${SVG_NAMESPACE}"><span`
  assert.equal(markupContextAt(declared).parentNamespace, XHTML_NAMESPACE)

  const selfClosing = '<main><div/><span'
  assert.equal(markupContextAt(selfClosing).parentTag, 'div')
})

test('describes incomplete multiline attribute values', () => {
  const source = `<svg>
  <rect
    fill="re`
  const context = markupContextAt(source)
  assert.equal(context.namespace, SVG_NAMESPACE)
  assert.equal(context.position, 'value')
  assert.deepEqual(context.tagContext, {
    kind: 'value',
    tag: 'rect',
    attr: 'fill',
    prefix: 're',
    quote: '"',
    replaceStart: source.length - 2
  })
})

test('caches model contexts until the model version changes', () => {
  const model = {
    version: 1,
    value: '<svg><rect',
    getVersionId() {
      return this.version
    },
    getValue() {
      return this.value
    },
    getLanguageId() {
      return 'html'
    },
    getOffsetAt(position) {
      return position.offset
    }
  }
  const position = { offset: model.value.length }
  const first = markupModelContextAt(model, position)
  const second = markupModelContextAt(model, position)
  assert.equal(first, second)

  model.version++
  model.value = '<main><rect'
  position.offset = model.value.length
  const updated = markupModelContextAt(model, position)
  assert.notEqual(updated, first)
  assert.equal(updated.parentNamespace, XHTML_NAMESPACE)
})
