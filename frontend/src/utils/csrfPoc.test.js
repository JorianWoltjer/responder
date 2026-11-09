import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCsrfFormHtml,
  buildJsonTextPlainFields,
  parseHttpRequest,
  parseMultipartBody
} from './csrfPoc.js'

test('keeps POST query parameters in the action', () => {
  const parsed = parseHttpRequest(
    'POST /change?mode=admin HTTP/1.1\r\n' +
      'Host: example.com\r\n' +
      'Content-Type: application/x-www-form-urlencoded\r\n\r\n' +
      'name=test'
  )

  assert.equal(parsed.action, 'https://example.com/change?mode=admin')
  assert.deepEqual(parsed.fields, [{ name: 'name', value: 'test' }])
})

test('preserves multipart encoding when there are no files', () => {
  const parsed = parseHttpRequest(
    'POST /change HTTP/1.1\r\n' +
      'Host: example.com\r\n' +
      'Content-Type: multipart/form-data; boundary=x\r\n\r\n' +
      '--x\r\n' +
      'Content-Disposition: form-data; name="role"\r\n\r\n' +
      'admin\r\n' +
      '--x--\r\n'
  )

  assert.equal(parsed.enctype, 'multipart/form-data')
  assert.match(buildCsrfFormHtml(parsed), /enctype="multipart\/form-data"/)
})

test('parses multipart delimiters only on boundary lines', () => {
  const parsed = parseMultipartBody(
    '--boundary\r\n' +
      'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n' +
      'Content-Type: text/plain\r\n\r\n' +
      'before--boundary-after\r\n' +
      '--boundary--\r\n',
    'boundary'
  )

  assert.equal(parsed.files[0].content, 'before--boundary-after')
})

test('recreates file bytes and escapes inline script strings', () => {
  const parsed = parseHttpRequest(
    'POST /upload HTTP/1.1\r\n' +
      'Host: example.com\r\n' +
      'Content-Type: multipart/form-data; boundary=x\r\n\r\n' +
      '--x\r\n' +
      'Content-Disposition: form-data; name="file"; filename="</script>.txt"\r\n' +
      'Content-Type: text/plain\r\n\r\n' +
      'a\r\nb\u0000</script>\r\n' +
      '--x--\r\n'
  )
  const html = buildCsrfFormHtml(parsed)

  assert.match(html, /new File\(\["a\\r\\nb\\u0000<\\\/script>"\]/)
  assert.match(html, /"<\\\/script>\.txt"/)
  assert.doesNotMatch(html, /const file0[^\n]*"<\/script>/)
  assert.match(html, /new DataTransfer\(\)/)
  assert.match(html, /form\.elements\["file"\]\.files/)
})

test('uses an untyped Blob for JSON without Content-Type', () => {
  const parsed = parseHttpRequest('POST /change?q=1 HTTP/1.1\r\nHost: example.com\r\n\r\n[1,2]')
  const html = buildCsrfFormHtml(parsed)

  assert.equal(parsed.jsonMode, 'no-content-type')
  assert.match(html, /fetch\("https:\/\/example\.com\/change\?q=1"/)
  assert.match(html, /body: new Blob\(\["\[1,2\]"\]\)/)
  assert.doesNotMatch(html, /type:|Content-Type/)
})

test('supports non-object JSON when the form separator can preserve it', () => {
  const parsed = parseHttpRequest(
    'POST /change HTTP/1.1\r\n' +
      'Host: example.com\r\n' +
      'Content-Type: application/json\r\n\r\n' +
      '["a=b"]'
  )
  const html = buildCsrfFormHtml(parsed)

  assert.deepEqual(buildJsonTextPlainFields('["a=b"]'), { name: '["a', value: 'b"]' })
  assert.match(html, /enctype="text\/plain"/)
  assert.doesNotMatch(html, /new Blob/)
})

test('rejects non-object JSON that a text/plain form cannot preserve', () => {
  const parsed = parseHttpRequest(
    'POST /change HTTP/1.1\r\n' +
      'Host: example.com\r\n' +
      'Content-Type: application/json\r\n\r\n' +
      'null'
  )

  assert.throws(() => buildCsrfFormHtml(parsed), /Cannot create a text\/plain form/)
})

test('rejects methods that cannot be generated', () => {
  assert.throws(
    () => parseHttpRequest('PUT /change HTTP/1.1\r\nHost: example.com\r\n\r\n'),
    /Unsupported method PUT/
  )
})
