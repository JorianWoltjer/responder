import assert from 'node:assert/strict'
import test from 'node:test'

import { buildResponsePath, encodeQueryComponent, parseResponseUrl } from './responseUrl.js'

test('builds a compact response URL', () => {
  const path = buildResponsePath({
    body: '<h1>Hello</h1>',
    filename: 'poc.html',
    status: 302,
    delay: 250,
    headers: new Map([
      ['Content-Type', 'text/html; charset=utf-8'],
      ['Content-Length', '14'],
      ['Location', 'https://example.com/next']
    ])
  })

  assert.equal(
    path,
    '/poc.html?body=%3Ch1%3EHello%3C%2Fh1%3E&status=302&delay=250&h[cl]=14&h[l]=https%3A%2F%2Fexample%2Ecom%2Fnext'
  )
})

test('collapses complete wildcard CORS headers', () => {
  const path = buildResponsePath({
    body: 'ok',
    headers: new Map([
      ['Access-Control-Allow-Origin', '*'],
      ['Access-Control-Allow-Methods', '*'],
      ['Access-Control-Allow-Headers', '*']
    ])
  })

  assert.equal(path, '/?body=ok&cors=true')
})

test('preserves duplicate response headers', () => {
  const path = buildResponsePath({
    body: 'ok',
    headers: [
      ['Set-Cookie', 'a=1'],
      ['Set-Cookie', 'b=2']
    ]
  })

  assert.equal(path, '/?body=ok&h[c]=a%3D1&h[c]=b%3D2')
})

test('uses cross-origin policy header aliases', () => {
  const path = buildResponsePath({
    headers: [
      ['Cross-Origin-Opener-Policy', 'same-origin'],
      ['Cross-Origin-Embedder-Policy', 'require-corp'],
      ['Cross-Origin-Resource-Policy', 'cross-origin']
    ]
  })

  assert.equal(path, '/?h[coop]=same%2Dorigin&h[coep]=require%2Dcorp&h[corp]=cross%2Dorigin')
})

test('uses a gist URL instead of an inline body', () => {
  const path = buildResponsePath({
    body: '<h1>This should not be included</h1>',
    gist: '  https://gist.github.com/user/0123456789abcdef0123456789abcdef  ',
    filename: 'poc.html'
  })

  assert.equal(
    path,
    '/poc.html?gist=https%3A%2F%2Fgist%2Egithub%2Ecom%2Fuser%2F0123456789abcdef0123456789abcdef'
  )
})

test('uses gist mode even when the gist URL is empty', () => {
  assert.equal(buildResponsePath({ body: 'editor contents', gist: '' }), '/?gist=')
})

test('percent-encodes every non-alphanumeric query byte', () => {
  assert.equal(
    encodeQueryComponent("AZaz09 -_.!~*'() /🌍"),
    'AZaz09%20%2D%5F%2E%21%7E%2A%27%28%29%20%2F%F0%9F%8C%8D'
  )
  assert.equal(buildResponsePath({ body: 'Hello, 🌍' }), '/?body=Hello%2C%20%F0%9F%8C%8D')
})

test('keeps custom content types and an explicit empty response query', () => {
  assert.equal(
    buildResponsePath({
      body: '',
      filename: 'payload.txt',
      headers: new Map([['Content-Type', 'application/octet-stream']])
    }),
    '/payload.txt?h[ct]=application%2Foctet%2Dstream'
  )
  assert.equal(buildResponsePath({ body: '', headers: new Map() }), '/?')
})

test('only omits content types inferred identically by mime_guess', () => {
  assert.equal(
    buildResponsePath({
      body: 'xml',
      filename: 'payload.xml',
      headers: new Map([['Content-Type', 'text/xml; charset=utf-8']])
    }),
    '/payload.xml?body=xml'
  )
  assert.equal(
    buildResponsePath({
      body: 'xml',
      filename: 'payload.xml',
      headers: new Map([['Content-Type', 'text/xml']])
    }),
    '/payload.xml?body=xml&h[ct]=text%2Fxml'
  )
  assert.equal(
    buildResponsePath({
      body: 'xml',
      filename: 'app.config',
      headers: new Map([['Content-Type', 'application/xml; charset=utf-8']])
    }),
    '/app.config?body=xml'
  )
  assert.equal(
    buildResponsePath({
      body: 'json',
      filename: 'json',
      headers: new Map([['Content-Type', 'application/json']])
    }),
    '/json?body=json&h[ct]=application%2Fjson'
  )
})

test('parses a generated response URL into UI configuration', () => {
  assert.deepEqual(
    parseResponseUrl(
      '/folder/poc.html?body=%3Ch1%3EHello%3C%2Fh1%3E&status=302&delay=250&h[ct]=text%2Fhtml&h[c]=a%3D1&h[c]=b%3D2'
    ),
    {
      filename: 'folder/poc.html',
      body: '<h1>Hello</h1>',
      gist: undefined,
      status: 302,
      delay: 250,
      headers: [
        ['Content-Type', 'text/html'],
        ['Set-Cookie', 'a=1'],
        ['Set-Cookie', 'b=2']
      ]
    }
  )
})

test('parses the canonical parameters emitted by the frontend', () => {
  assert.deepEqual(
    parseResponseUrl(
      'https://r.example/payload.txt?body=Hello%2C%20world%21&status=201&delay=250&h[x-test]=yes&h[access-control-allow-origin]=https%3A%2F%2Fexample.com&cors=true'
    ),
    {
      filename: 'payload.txt',
      body: 'Hello, world!',
      gist: undefined,
      status: 201,
      delay: 250,
      headers: [
        ['Access-Control-Allow-Origin', '*'],
        ['Access-Control-Allow-Methods', '*'],
        ['Access-Control-Allow-Headers', '*'],
        ['x-test', 'yes']
      ]
    }
  )
})

test('selects gist mode only when no inline body parameter takes precedence', () => {
  assert.deepEqual(parseResponseUrl('/payload?gist=https%3A%2F%2Fgist.github.com%2Fu%2Fid'), {
    filename: 'payload',
    body: '',
    gist: 'https://gist.github.com/u/id',
    status: 200,
    delay: 0,
    headers: []
  })

  const inline = parseResponseUrl('/payload?gist=ignored&body=inline')
  assert.equal(inline.body, 'inline')
  assert.equal(inline.gist, undefined)
})

test('ignores backend-only parameter variants', () => {
  assert.deepEqual(
    parseResponseUrl('/payload?s=201&b=body&body.b64=SGVsbG8%3D&headers[x-test]=yes&cors'),
    {
      filename: 'payload',
      body: '',
      gist: undefined,
      status: 200,
      delay: 0,
      headers: []
    }
  )
})

test('rejects values outside the frontend controls', () => {
  assert.throws(() => parseResponseUrl('/?status=nope'), /whole number/)
  assert.throws(() => parseResponseUrl('/?status=700'), /between 100 and 699/)
  assert.throws(() => parseResponseUrl('/?delay=1s'), /invalid/)
  assert.throws(() => parseResponseUrl('/?delay=300001'), /5 minutes/)
})
