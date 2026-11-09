import assert from 'node:assert/strict'
import test from 'node:test'

import { buildResponsePath, encodeQueryComponent } from './responseUrl.js'

test('builds a compact response URL', () => {
  const path = buildResponsePath({
    body: '<h1>Hello</h1>',
    filename: 'poc.html',
    status: 302,
    delay: 250,
    headers: new Map([
      ['Content-Type', 'text/html'],
      ['Location', 'https://example.com/next']
    ])
  })

  assert.equal(
    path,
    '/poc.html?body=%3Ch1%3EHello%3C%2Fh1%3E&status=302&delay=250&h[l]=https%3A%2F%2Fexample%2Ecom%2Fnext'
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
