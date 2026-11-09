import assert from 'node:assert/strict'
import test from 'node:test'

import { xhtmlEmmetExpansion } from './svgEmmet.js'

const XHTML = 'http://www.w3.org/1999/xhtml'

function expand(abbreviation, source = `<html xmlns="${XHTML}">`) {
  return xhtmlEmmetExpansion(source, source.length, abbreviation)
}

test('uses HTML Emmet expansion for a class abbreviation in XHTML', () => {
  const source = `<svg xmlns="http://www.w3.org/2000/svg">
<foreignObject><html xmlns="${XHTML}">
  .test`
  assert.equal(expand('.test', source), '<div class="test">${0}</div>')
})

test('uses HTML formatting for nested abbreviations', () => {
  assert.equal(expand('ul>li*2'), '<ul>\n\t<li>${1}</li>\n\t<li>${0}</li>\n</ul>')
})

test('does not use HTML Emmet outside XHTML', () => {
  const source = '<svg xmlns="http://www.w3.org/2000/svg">.test'
  assert.equal(expand('.test', source), undefined)
})

test('does not use HTML Emmet in XML comments or CDATA', () => {
  const comment = `<svg xmlns="http://www.w3.org/2000/svg"><!-- <html xmlns="${XHTML}">.test`
  const cdata = `<html xmlns="${XHTML}"><![CDATA[.test`
  assert.equal(expand('.test', comment), undefined)
  assert.equal(expand('.test', cdata), undefined)
})
