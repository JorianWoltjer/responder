export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*'
}

// https://github.com/mdn/content/blob/main/files/en-us/web/http/guides/mime_types/common_types/index.md
const COMMON_MEDIA_TYPES = [
  'audio/aac',
  'application/x-abiword',
  'image/apng',
  'application/x-freearc',
  'image/avif',
  'video/x-msvideo',
  'application/vnd.amazon.ebook',
  'application/octet-stream',
  'image/bmp',
  'application/x-bzip',
  'application/x-bzip2',
  'application/x-cdf',
  'application/x-csh',
  'text/css',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-fontobject',
  'application/epub+zip',
  'application/gzip',
  'image/gif',
  'text/html',
  'image/vnd.microsoft.icon',
  'text/calendar',
  'application/java-archive',
  'image/jpeg',
  'text/javascript',
  'application/json',
  'application/ld+json',
  'text/markdown',
  'audio/midi',
  'audio/x-midi',
  'audio/mp4',
  'audio/mpeg',
  'video/mp4',
  'video/mpeg',
  'application/vnd.apple.installer+xml',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.text',
  'audio/ogg',
  'video/ogg',
  'application/ogg',
  'font/otf',
  'image/png',
  'application/pdf',
  'application/x-httpd-php',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.rar',
  'application/rtf',
  'application/x-sh',
  'image/svg+xml',
  'application/x-tar',
  'image/tiff',
  'video/mp2t',
  'font/ttf',
  'text/plain',
  'application/vnd.visio',
  'application/wasm',
  'audio/wav',
  'audio/webm',
  'video/webm',
  'application/manifest+json',
  'image/webp',
  'font/woff',
  'font/woff2',
  'application/xhtml+xml',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/xml',
  'text/xml',
  'application/atom+xml',
  'application/vnd.mozilla.xul+xml',
  'application/zip',
  'video/3gpp',
  'audio/3gpp',
  'video/3gpp2',
  'audio/3gpp2',
  'application/x-7z-compressed'
]

// Literal values and complete, parameterless response directives documented in:
// https://github.com/mdn/content/tree/main/files/en-us/web/http/reference/headers
// An empty list means the header's value is free-form or requires user-specific parameters.
export const HTTP_HEADER_VALUES = {
  'Content-Type': COMMON_MEDIA_TYPES,
  'Content-Length': [],
  Location: [],
  'Set-Cookie': [],
  'Content-Security-Policy': ['sandbox', 'upgrade-insecure-requests'],
  'Content-Security-Policy-Report-Only': [],
  'Permissions-Policy': [],
  'Referrer-Policy': [
    'no-referrer',
    'no-referrer-when-downgrade',
    'origin',
    'origin-when-cross-origin',
    'same-origin',
    'strict-origin',
    'strict-origin-when-cross-origin',
    'unsafe-url'
  ],
  'X-Frame-Options': ['DENY', 'SAMEORIGIN'],
  'Content-Disposition': ['inline', 'attachment'],
  'Access-Control-Allow-Origin': ['*', 'null'],
  // https://github.com/mdn/content/tree/main/files/en-us/web/http/reference/methods
  'Access-Control-Allow-Methods': [
    'GET',
    'QUERY',
    'HEAD',
    'POST',
    'PUT',
    'DELETE',
    'CONNECT',
    'OPTIONS',
    'TRACE',
    'PATCH',
    '*'
  ],
  'Access-Control-Allow-Headers': ['*'],
  'Access-Control-Allow-Credentials': ['true'],
  'Access-Control-Expose-Headers': ['*'],
  'Cross-Origin-Embedder-Policy': ['unsafe-none', 'require-corp', 'credentialless'],
  'Cross-Origin-Opener-Policy': [
    'unsafe-none',
    'same-origin-allow-popups',
    'same-origin',
    'noopener-allow-popups'
  ],
  'Cross-Origin-Resource-Policy': ['same-site', 'same-origin', 'cross-origin'],
  NEL: [],
  Link: [],
  Refresh: [],
  'Cache-Control': [
    'no-cache',
    'must-revalidate',
    'proxy-revalidate',
    'no-store',
    'private',
    'public',
    'must-understand',
    'no-transform',
    'immutable'
  ],
  'Timing-Allow-Origin': ['*'],
  'Report-To': [],
  'Reporting-Endpoints': [],
  'Clear-Site-Data': [
    '"cache"',
    '"clientHints"',
    '"cookies"',
    '"executionContexts"',
    '"storage"',
    '"*"'
  ],
  'Service-Worker-Allowed': [],
  'Origin-Agent-Cluster': ['?1', '?0']
}

export const HTTP_HEADERS = Object.keys(HTTP_HEADER_VALUES)

// Examples are taken from the corresponding MDN header page. Multiline examples are
// compacted so they work as input placeholders without changing their header value.
export const HTTP_HEADER_EXAMPLES = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Length': '1234',
  Location: '/index.html',
  'Set-Cookie': 'sessionId=38afes7a8',
  'Content-Security-Policy': 'default-src https:',
  'Content-Security-Policy-Report-Only':
    'default-src https:; report-uri /csp-report-url/; report-to csp-endpoint',
  'Permissions-Policy': 'geolocation=*',
  'Referrer-Policy': 'no-referrer, strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Disposition': 'attachment; filename="cool.html"',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, DELETE',
  'Access-Control-Allow-Headers': 'X-Custom-Header',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Expose-Headers': 'Content-Encoding',
  'Cross-Origin-Embedder-Policy': 'require-corp; report-to="coep-endpoint"',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  NEL: '{ "report_to": "name_of_reporting_group", "max_age": 12345, "include_subdomains": false, "success_fraction": 0.0, "failure_fraction": 1.0 }',
  Link: '<https://example.com>; rel="preconnect"',
  Refresh: '5; url=https://example.com/',
  'Cache-Control': 'max-age=604800',
  'Timing-Allow-Origin': '*',
  'Report-To':
    '{ "group": "csp-endpoints", "max_age": 10886400, "endpoints": [{ "url": "https://example.com/reports" }, { "url": "https://backup.com/reports" }] }',
  'Reporting-Endpoints': 'csp-endpoint="https://example.com/csp-reports"',
  'Clear-Site-Data': '"cookies"',
  'Service-Worker-Allowed': '/',
  'Origin-Agent-Cluster': '?1'
}

const HTTP_HEADER_VALUES_BY_LOWERCASE_NAME = Object.fromEntries(
  Object.entries(HTTP_HEADER_VALUES).map(([name, values]) => [name.toLowerCase(), values])
)
const HTTP_HEADER_EXAMPLES_BY_LOWERCASE_NAME = Object.fromEntries(
  Object.entries(HTTP_HEADER_EXAMPLES).map(([name, example]) => [name.toLowerCase(), example])
)
const HTTP_HEADER_NAME_BY_LOWERCASE_NAME = Object.fromEntries(
  HTTP_HEADERS.map((name) => [name.toLowerCase(), name])
)

export function getHttpHeaderValues(name) {
  return HTTP_HEADER_VALUES_BY_LOWERCASE_NAME[name.trim().toLowerCase()] || []
}

export function getHttpHeaderExample(name) {
  return HTTP_HEADER_EXAMPLES_BY_LOWERCASE_NAME[name.trim().toLowerCase()] || ''
}

export function getHttpHeaderDocsUrl(name) {
  const canonicalName = HTTP_HEADER_NAME_BY_LOWERCASE_NAME[name.trim().toLowerCase()]
  return canonicalName
    ? `https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/${canonicalName}`
    : null
}

export function hasCORS(headers) {
  const entries = Array.from(headers)
  return Object.entries(CORS_HEADERS).every(([name, value]) =>
    entries.some(([headerName, headerValue]) => headerName === name && headerValue === value)
  )
}

// Mirrored in src/response.rs -> HEADER_ALIAS: HashMap
export const HEADER_ALIAS = {
  'content-type': 'ct',
  'content-length': 'cl',
  'set-cookie': 'c',
  location: 'l',
  'content-security-policy': 'csp',
  'cross-origin-opener-policy': 'coop',
  'cross-origin-embedder-policy': 'coep',
  'cross-origin-resource-policy': 'corp'
}
