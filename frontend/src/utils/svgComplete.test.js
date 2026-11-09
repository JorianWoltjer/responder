import assert from 'node:assert/strict'
import test from 'node:test'

import { XHTML_NAMESPACE, svgAutocompleteItems, xmlNamespaceAt } from './svgComplete.js'

function complete(source, options = { language: 'xml' }) {
  return svgAutocompleteItems(source, source.length, options)
}

test('detects the XHTML namespace at text content', () => {
  const source = `<svg xmlns="http://www.w3.org/2000/svg">
<foreignObject><html xmlns="${XHTML_NAMESPACE}">
  .test`
  assert.equal(xmlNamespaceAt(source), XHTML_NAMESPACE)
})

test('does not offer SVG completion in the XHTML namespace', () => {
  const suggestions = complete(`<html xmlns="${XHTML_NAMESPACE}"><di`)
  assert.deepEqual(suggestions, [])
})

test('returns to SVG completion after the XHTML namespace closes', () => {
  const suggestions = complete(
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><html xmlns="http://www.w3.org/1999/xhtml"><div /></html></foreignObject><re'
  )
  assert.ok(suggestions.some((item) => item.label === 'rect' && item.detail === 'SVG'))
  assert.ok(!suggestions.some((item) => item.detail === 'HTML'))
})

test('does not treat SVG-looking comments or scripts as SVG context', () => {
  assert.deepEqual(complete('<!-- <svg> --><re', { language: 'html' }), [])
  assert.deepEqual(complete('<script>const value = "<svg>"; re', { language: 'html' }), [])
})

test('offers SVG completion inside HTML SVG but HTML integration points are excluded', () => {
  assert.ok(complete('<main><svg><re', { language: 'html' }).some((item) => item.label === 'rect'))
  assert.deepEqual(
    complete('<svg><foreignObject><di', { language: 'html' }).filter(
      (item) => item.label !== 'svg'
    ),
    []
  )
})
