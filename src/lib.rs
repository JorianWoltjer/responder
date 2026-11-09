use std::{
    collections::HashMap,
    error,
    sync::{Arc, LazyLock},
};

use axum::{
    body::Bytes,
    extract::Request,
    http::StatusCode,
    response::{Html, IntoResponse},
};
use regex::Regex;
use reqwest::{
    header::{CACHE_CONTROL, ETAG, IF_NONE_MATCH},
    StatusCode as ReqwestStatusCode,
};
use response::{Response, MAX_DELAY_MS};
use tokio::sync::RwLock;

pub mod response;

type Err = Box<dyn error::Error>;

static GIST_ID_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(^|\W)([a-f0-9]{32})(\W|$)").expect("gist ID regex is valid")
});
static GIST_FILE_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(/([^/]+)$)").expect("gist file regex is valid"));
static GIST_REVISION_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i)(?:/revisions/|/raw/|/gists/[a-f0-9]{32}/|/[a-f0-9]{32}/)([a-f0-9]{40})(?:/|$)",
    )
    .expect("gist revision regex is valid")
});

#[derive(Clone)]
struct CachedGist {
    etag: Option<String>,
    content: Arc<Vec<u8>>,
    content_type: Option<String>,
}

static GIST_CACHE: LazyLock<RwLock<HashMap<String, CachedGist>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

#[derive(Debug, PartialEq, Eq)]
struct GistReference {
    id: String,
    revision: Option<String>,
    file: Option<String>,
}

fn parse_gist_reference(url: &str) -> Result<GistReference, Err> {
    let captures = GIST_ID_REGEX.captures(url).ok_or("Invalid gist format")?;
    let id = captures.get(2).expect("gist ID capture exists").as_str();
    let revision = GIST_REVISION_REGEX
        .captures(url)
        .and_then(|captures| captures.get(1))
        .map(|revision| revision.as_str().to_string());
    let file = GIST_FILE_REGEX
        .captures(url)
        .and_then(|captures| captures.get(2))
        .map(|file| file.as_str().to_string())
        .filter(|file| file != id && revision.as_deref() != Some(file));

    Ok(GistReference {
        id: id.to_string(),
        revision,
        file,
    })
}

pub async fn index(request: Request) -> Result<axum::response::Response, StatusCode> {
    let path = request.uri().path().to_string();
    let query_string = request.uri().query().unwrap_or_default();

    if query_string.is_empty() {
        match path.as_str() {
            "/favicon.ico" => {
                return Ok(
                    Bytes::from_static(include_bytes!("../frontend/dist/favicon.ico"))
                        .into_response(),
                );
            }
            "" | "/" => {
                return Ok(Html(include_str!("../frontend/dist/index.html")).into_response());
            }
            _ => {}
        }
    }
    let mut response: Response =
        serde_qs::from_str(query_string).map_err(|_| StatusCode::BAD_REQUEST)?;
    if StatusCode::from_u16(response.status).is_err() {
        return Err(StatusCode::BAD_REQUEST);
    }
    if response.delay > MAX_DELAY_MS {
        return Err(StatusCode::BAD_REQUEST);
    }
    response.path.replace(path);

    Ok(response.into_response().await)
}

pub async fn get_gist_content(url: &str) -> Result<(Vec<u8>, Option<String>), Err> {
    let gist = parse_gist_reference(url)?;
    let cache_key = format!(
        "{}:{}:{}",
        gist.id,
        gist.revision.as_deref().unwrap_or_default(),
        gist.file.as_deref().unwrap_or_default()
    );
    let cached = GIST_CACHE.read().await.get(&cache_key).cloned();

    let client = reqwest::Client::new();
    let mut api_url = format!("https://api.github.com/gists/{}", gist.id);
    if let Some(revision) = &gist.revision {
        api_url.push('/');
        api_url.push_str(revision);
    }
    let mut request = client
        .get(api_url)
        .header("User-Agent", "responder")
        .header(CACHE_CONTROL, "no-cache");
    if let Some(etag) = cached.as_ref().and_then(|cached| cached.etag.as_deref()) {
        request = request.header(IF_NONE_MATCH, etag);
    }

    let response = request.send().await?;
    if response.status() == ReqwestStatusCode::NOT_MODIFIED {
        let cached = cached.ok_or("GitHub returned 304 without a cached gist")?;
        return Ok((cached.content.as_ref().clone(), cached.content_type));
    }
    let response = response.error_for_status()?;
    let etag = response
        .headers()
        .get(ETAG)
        .and_then(|etag| etag.to_str().ok())
        .map(str::to_string);
    let files = response.json::<serde_json::Value>().await?;
    let files = files
        .get("files")
        .ok_or("files key found")?
        .as_object()
        .ok_or("Files not an object")?;

    let file = match gist.file {
        Some(file) if files.contains_key(&file) => files.get(&file).ok_or("No file found")?,
        _ => files.values().next().ok_or("No files found")?,
    };
    let content = file
        .get("content")
        .ok_or("No content found")?
        .as_str()
        .ok_or("Content not a string")?;
    let content_type = file
        .get("type")
        .and_then(|t| t.as_str().map(|s| s.to_string()));

    let content = content.as_bytes().to_vec();
    GIST_CACHE.write().await.insert(
        cache_key,
        CachedGist {
            etag,
            content: Arc::new(content.clone()),
            content_type: content_type.clone(),
        },
    );

    Ok((content, content_type))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn invalid_query_returns_bad_request() {
        let request = Request::builder()
            .uri("/?delay=abc")
            .body(axum::body::Body::empty())
            .unwrap();

        let response = index(request).await.unwrap_err();

        assert_eq!(response, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn invalid_status_returns_bad_request() {
        for uri in [
            "/?status=0",
            "/?status=99",
            "/?status=1000",
            "/?status=65535",
        ] {
            let request = Request::builder()
                .uri(uri)
                .body(axum::body::Body::empty())
                .unwrap();

            let response = index(request).await.unwrap_err();

            assert_eq!(response, StatusCode::BAD_REQUEST);
        }
    }

    #[tokio::test]
    async fn delay_over_max_returns_bad_request() {
        for uri in ["/?delay=300001", "/?delay=6m"] {
            let request = Request::builder()
                .uri(uri)
                .body(axum::body::Body::empty())
                .unwrap();

            let response = index(request).await.unwrap_err();

            assert_eq!(response, StatusCode::BAD_REQUEST);
        }
    }

    #[tokio::test]
    async fn inferred_content_type_uses_default_charset() {
        for (path, expected) in [
            ("/payload.html?body=test", "text/html; charset=utf-8"),
            ("/payload.xml?body=test", "text/xml; charset=utf-8"),
            ("/app.config?body=test", "application/xml; charset=utf-8"),
            ("/payload.json?body=test", "application/json"),
            ("/image.svg?body=test", "image/svg+xml"),
        ] {
            let request = Request::builder()
                .uri(path)
                .body(axum::body::Body::empty())
                .unwrap();

            let response = index(request).await.unwrap();

            assert_eq!(response.headers().get("content-type").unwrap(), expected);
        }
    }

    #[test]
    fn parses_revision_pinned_gist_urls() {
        let id = "0123456789abcdef0123456789abcdef";
        let revision = "0123456789abcdef0123456789abcdef01234567";

        assert_eq!(
            parse_gist_reference(&format!(
                "https://gist.github.com/user/{id}/revisions/{revision}"
            ))
            .unwrap(),
            GistReference {
                id: id.to_string(),
                revision: Some(revision.to_string()),
                file: None,
            }
        );
        assert_eq!(
            parse_gist_reference(&format!(
                "https://gist.githubusercontent.com/user/{id}/raw/{revision}/payload.html"
            ))
            .unwrap(),
            GistReference {
                id: id.to_string(),
                revision: Some(revision.to_string()),
                file: Some("payload.html".to_string()),
            }
        );
    }
}
