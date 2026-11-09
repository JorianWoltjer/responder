import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getContentTypeForExtension,
  getContentTypeForPath,
  getMimeTypeForExtension
} from './mimeTypes.js'

test('uses mime_guess first-choice mappings', () => {
  assert.equal(getMimeTypeForExtension('html'), 'text/html')
  assert.equal(getMimeTypeForExtension('XML'), 'text/xml')
  assert.equal(getMimeTypeForExtension('mjs'), 'application/javascript')
  assert.equal(getMimeTypeForExtension('unknown-extension'), null)
})

test('matches Rust path extension behavior', () => {
  assert.equal(getContentTypeForPath('directory/payload.json'), 'application/json')
  assert.equal(getContentTypeForPath('archive.tar.gz'), 'application/gzip')
  assert.equal(getContentTypeForPath('json'), null)
  assert.equal(getContentTypeForPath('.html'), null)
  assert.equal(getContentTypeForPath('..html'), 'text/html; charset=utf-8')
  assert.equal(getContentTypeForPath('directory.with.dot/file'), null)
})

test('applies the backend charset rules to inferred content types', () => {
  assert.equal(getContentTypeForExtension('html'), 'text/html; charset=utf-8')
  assert.equal(getContentTypeForExtension('xml'), 'text/xml; charset=utf-8')
  assert.equal(getContentTypeForExtension('config'), 'application/xml; charset=utf-8')
  assert.equal(getContentTypeForExtension('json'), 'application/json')
  assert.equal(getContentTypeForExtension('svg'), 'image/svg+xml')
})
