// Mirrored in src/lib.rs -> GIST_ID_REGEX.
export const GIST_ID_REGEX = /(^|\W)([a-f0-9]{32})(\W|$)/i
// Mirrored in src/lib.rs -> GIST_FILE_REGEX.
export const GIST_FILE_REGEX = /(\/([^/]+)$)/
// Mirrored in src/lib.rs -> GIST_REVISION_REGEX.
export const GIST_REVISION_REGEX =
  /(?:\/revisions\/|\/raw\/|\/gists\/[a-f0-9]{32}\/|\/[a-f0-9]{32}\/)([a-f0-9]{40})(?:\/|$)/i

export function parseGistReference(value) {
  if (String(value).includes('#')) return null

  const idMatch = GIST_ID_REGEX.exec(value)
  if (!idMatch) return null

  const id = idMatch[2]
  const revision = GIST_REVISION_REGEX.exec(value)?.[1] ?? null
  const fileMatch = GIST_FILE_REGEX.exec(value)?.[2]
  const file = fileMatch && fileMatch !== id && fileMatch !== revision ? fileMatch : null

  return { id, revision, file }
}

export function isValidGistReference(value) {
  return parseGistReference(value) !== null
}
