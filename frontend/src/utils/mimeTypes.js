import { MIME_TYPES_BY_EXTENSION } from '../generated/mimeTypes.js'

export function getMimeTypeForExtension(extension) {
  return MIME_TYPES_BY_EXTENSION.get(String(extension).toLowerCase()) ?? null
}

export function withUtf8Charset(contentType) {
  return contentType?.startsWith('text/') || contentType === 'application/xml'
    ? `${contentType}; charset=utf-8`
    : contentType
}

export function getContentTypeForExtension(extension) {
  return withUtf8Charset(getMimeTypeForExtension(extension))
}

export function getContentTypeForPath(path) {
  const filename = String(path).slice(String(path).lastIndexOf('/') + 1)
  const dot = filename.lastIndexOf('.')
  if (dot < 1) return null
  return getContentTypeForExtension(filename.slice(dot + 1))
}
