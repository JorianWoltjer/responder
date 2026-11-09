import assert from 'node:assert/strict'
import test from 'node:test'

import { isValidGistReference, parseGistReference } from './gist.js'

test('accepts gist references recognized by the backend regex', () => {
  const id = '0123456789abcdef0123456789abcdef'

  assert.equal(isValidGistReference(id), true)
  assert.equal(isValidGistReference(`https://gist.github.com/user/${id}`), true)
  assert.equal(
    isValidGistReference(`https://gist.githubusercontent.com/user/${id}/raw/file.html`),
    true
  )
  assert.equal(isValidGistReference(id.toUpperCase()), true)
})

test('rejects references without a bounded 32-character hexadecimal gist ID', () => {
  assert.equal(isValidGistReference(''), false)
  assert.equal(isValidGistReference('https://gist.github.com/user/not-a-gist'), false)
  assert.equal(isValidGistReference('0123456789abcdef0123456789abcde'), false)
  assert.equal(isValidGistReference('0123456789abcdef0123456789abcdef0'), false)
  assert.equal(isValidGistReference('_0123456789abcdef0123456789abcdef_'), false)
})

test('rejects gist UI file fragments', () => {
  const id = '0123456789abcdef0123456789abcdef'

  assert.equal(isValidGistReference(`https://gist.github.com/user/${id}#file-payload-html`), false)
  assert.equal(
    isValidGistReference(`https://gist.github.com/user/${id}#file-payload-html-L10`),
    false
  )
  assert.equal(parseGistReference(`${id}#file-payload-html`), null)
})

test('extracts the same gist parts as the backend', () => {
  const id = '0123456789abcdef0123456789abcdef'
  const revision = '0123456789abcdef0123456789abcdef01234567'

  assert.deepEqual(parseGistReference(id), { id, revision: null, file: null })
  assert.deepEqual(parseGistReference(`https://gist.github.com/user/${id}/revisions/${revision}`), {
    id,
    revision,
    file: null
  })
  assert.deepEqual(
    parseGistReference(
      `https://gist.githubusercontent.com/user/${id}/raw/${revision}/payload.html`
    ),
    { id, revision, file: 'payload.html' }
  )
})

test('does not mistake a trailing gist ID or revision for a file', () => {
  const id = '0123456789abcdef0123456789abcdef'
  const revision = '0123456789abcdef0123456789abcdef01234567'

  assert.equal(parseGistReference(`https://gist.github.com/user/${id}`).file, null)
  assert.equal(parseGistReference(`https://api.github.com/gists/${id}/${revision}`).file, null)
})
