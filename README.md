# Responder

[r.jtw.sh](https://r.jtw.sh/)

**Easily create and share Proof of Concepts in HTML, JavaScript, etc. with custom headers, all via query parameters**

[<img width="775px" src="https://github.com/JorianWoltjer/responder/assets/26067369/48d2f5f4-afc0-4116-8673-a6abd639bad0" alt="Screenshot of default main web UI">](https://r.jtw.sh/)

Ever wanted to create an easy-to-share Proof of Concept, but realized your exploit need a special header here, another special status code there, and oh yeah, you forgot *Cross-Origin Resource Sharing* again. No more!  
With Responder, you have a super quick **web UI** that generates a permanent URL that will always respond correctly. **Query parameters** tell it what body to use, what headers to set, and what status code to use. This way, nothing is stored and nothing can be lost, you just share the URL. With the quick preview options, you can even use this **while developing** your exploit.

## Features

* **Respond on any path**: Every pathname will lead to the same parser and respond in the expected way. By setting a filename extension like `.html`, it automatically guesses the `Content-Type` header if it wasn't overwritten manually.
* **Set body data**: Use the `?body=` parameter to set an content body, or use the shorthand `?body.b64=` to decode from raw Base64 instead.
* **Set exact response headers**: Use the `?h[Header-Name]=` parameter multiple times to set any amount of headers for the response. There are some shorthands like `?h[ct]=` for `Content-Type`, or `?h[l]` for Location. Lastly, the `?cors` paramter alone will set all wildcard [Cross-Origin Resource Sharing](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) headers to make sure cross-site requests can read the content.
* **Status code**: Use the `?status=` parameter to set the [response status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
* **Delayed responses**: Use the `?delay=` parameter to delay the response by a number of milliseconds. Invalid delay values return `400 Bad Request`.
* **Gist fetching**: For large bodies that won't fit in a URL, you can [create a gist](https://gist.github.com/) and put the URL in the `?gist=` parameter. This will fetch the gists raw content and return it as the body, with any custom headers/status you set.

## FAQ

1. **How can I shorten the URL?**: If your target supports it, you could simply redirect/rewrite from your short domain to a crafted URL on this tool. Otherwise, you can always fall back to a simple page yourself like with PHP.
2. **How do I see exactly what headers my response is giving?**: Send a request to the url with `curl -D - 'https://r.jtw.sh/...'`, or use a proxy like Burp Suite to view the raw traffic.
3. **What's the best way to test same-site/cross-origin features?**: Same-site rules by the browser are applied across subdomains, so just point another subdomain like https://r2.jtw.sh to the same IP. For a whole other domain, you can put a trailing `.` after your domain and it will resolve to the same server, while being seen as a different site completely, like <https://r.jtw.sh.>.

If you have any other questions, feel free to ask in an [Issue](https://github.com/JorianWoltjer/responder/issues).

## Privacy & Self-Hosting

> [!WARNING]  
> Because this tool is hosted on my own domain, I will technically be able to view any traffic going to and from my server. Keep this in mind when creating PoC's for real-world scenarios and consider self-hosting it on a server you control.

The docker image is updated at [docker.io/j0r1an/responder](https://hub.docker.com/r/j0r1an/responder), and can be **run** using the following command:

```bash
docker run --rm -p 8000:80 j0r1an/responder:latest
```

<!-- Push:
docker build -t j0r1an/responder:latest .
docker push j0r1an/responder:latest
 -->

---

If you instead want to **build from source code** yourself, clone this Github repository (optionally configure the listening port in [`docker-compose.yml`](docker-compose.yml#L5)), then run the following command:

```bash
docker compose up --build -d
```

The application will be available on http://localhost:8000. Since the main use case is making it publicly accessible your site, it is recommended to put this behind a **reverse proxy** like the following Nginx configuration:

```conf
server {
    listen 80;
    server_name r.jtw.sh r2.jtw.sh *.r.jtw.sh;

    location / {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

**Be careful on which domain you publicly host this tool**. The domain must not host any other applications that rely only on SameSite for CSRF protection ([read more](https://book.jorianwoltjer.com/web/cross-site-request-forgery-csrf)). This application is vulnerable to XSS by design, so it may be abused to send same-site requests with authentication.
