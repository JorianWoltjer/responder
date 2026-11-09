import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HTTP_HEADERS,
  HTTP_HEADER_EXAMPLES,
  HTTP_HEADER_VALUES,
  getHttpHeaderDocsUrl,
  getHttpHeaderExample,
  getHttpHeaderValues
} from './index.js'

test('defines value suggestions for every suggested response header', () => {
  assert.deepEqual(HTTP_HEADERS, Object.keys(HTTP_HEADER_VALUES))
})

test('defines an example for every suggested response header', () => {
  assert.deepEqual(Object.keys(HTTP_HEADER_EXAMPLES), HTTP_HEADERS)
  assert.ok(Object.values(HTTP_HEADER_EXAMPLES).every((example) => example.length > 0))
})

test('gets header values case-insensitively', () => {
  assert.deepEqual(getHttpHeaderValues('referrer-policy'), [
    'no-referrer',
    'no-referrer-when-downgrade',
    'origin',
    'origin-when-cross-origin',
    'same-origin',
    'strict-origin',
    'strict-origin-when-cross-origin',
    'unsafe-url'
  ])
  assert.deepEqual(getHttpHeaderValues('  X-FRAME-OPTIONS  '), ['DENY', 'SAMEORIGIN'])
})

test('keeps predefined content types free of parameters', () => {
  const textContentTypes = getHttpHeaderValues('Content-Type').filter((value) =>
    value.startsWith('text/')
  )
  assert.ok(textContentTypes.length > 0)
  assert.ok(textContentTypes.every((value) => !value.includes(';')))
})

test('returns no suggestions for free-form and unknown headers', () => {
  assert.deepEqual(getHttpHeaderValues('Location'), [])
  assert.deepEqual(getHttpHeaderValues('X-Custom-Header'), [])
})

test('gets header examples case-insensitively', () => {
  assert.equal(getHttpHeaderExample(' content-disposition '), 'attachment; filename="cool.html"')
  assert.equal(getHttpHeaderExample('X-Custom-Header'), '')
})

test('builds canonical MDN links for recognized headers', () => {
  assert.equal(
    getHttpHeaderDocsUrl('  content-type '),
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Type'
  )
  assert.equal(
    getHttpHeaderDocsUrl('LINK'),
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Link'
  )
  assert.equal(getHttpHeaderDocsUrl('X-Custom-Header'), null)
})
