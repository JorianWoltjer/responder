use std::{borrow::Cow, collections::HashMap, str::FromStr, sync::LazyLock, time::Instant};

use axum::{
    http::{header::InvalidHeaderValue, HeaderMap, HeaderName, HeaderValue, StatusCode},
    response::IntoResponse,
};
use b64::FromBase64;
use serde::{Deserialize, Deserializer, Serialize};
use tokio::time::{sleep, Duration};

use crate::{get_gist_content, Err};

/// Maximum `delay` query parameter in milliseconds (5 minutes).
pub const MAX_DELAY_MS: u64 = 5 * 60 * 1000;

#[derive(Deserialize, Serialize, Debug)]
pub struct Response {
    #[serde(alias = "s", alias = "code", default = "default_status")]
    pub status: u16,
    #[serde(alias = "b", alias = "d", alias = "data", default)]
    body: Option<String>,
    #[serde(
        alias = "body.b64",
        alias = "data.b64",
        alias = "b64",
        alias = "base64",
        default
    )]
    body_b64: Option<String>,
    gist: Option<String>,
    #[serde(alias = "h", default)]
    pub headers: HashMap<String, Vec<String>>,
    #[serde(default, deserialize_with = "deserialize_bool")]
    pub cors: bool,
    #[serde(default, deserialize_with = "deserialize_delay")]
    pub delay: u64,
    #[serde(skip)]
    pub path: Option<String>,
}

fn default_status() -> u16 {
    StatusCode::OK.as_u16()
}

fn deserialize_bool<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    match String::deserialize(deserializer)?.as_str() {
        "false" | "f" | "no" | "n" | "0" => Ok(false),
        _ => Ok(true),
    }
}

fn parse_delay_ms(s: &str) -> Option<u64> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    let (value_str, multiplier) = if let Some(num) = s.strip_suffix('s') {
        (num, 1_000.0)
    } else if let Some(num) = s.strip_suffix('m') {
        (num, 60.0 * 1_000.0)
    } else {
        (s, 1.0)
    };
    if value_str.is_empty() {
        return None;
    }
    let value: f64 = value_str.parse().ok()?;
    if !value.is_finite() || value < 0.0 {
        return None;
    }
    let ms = (value * multiplier).round();
    if ms < 0.0 || ms > u64::MAX as f64 {
        return None;
    }
    Some(ms as u64)
}

fn deserialize_delay<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    parse_delay_ms(&s).ok_or_else(|| serde::de::Error::custom("invalid delay"))
}

fn with_utf8_charset(content_type: &'static str) -> Cow<'static, str> {
    if content_type.starts_with("text/") || content_type == "application/xml" {
        Cow::Owned(format!("{content_type}; charset=utf-8"))
    } else {
        Cow::Borrowed(content_type)
    }
}

fn content_type_from_path(path: &str) -> Option<Cow<'static, str>> {
    mime_guess::from_path(path)
        .first_raw()
        .map(with_utf8_charset)
}

fn set_default_content_type(
    headers: &mut HeaderMap,
    inferred_content_type: Option<&str>,
    body_content_type: Option<&str>,
) -> Result<(), InvalidHeaderValue> {
    if !headers.contains_key("content-type") {
        let content_type = inferred_content_type
            .or(body_content_type)
            .unwrap_or("text/plain");
        headers.insert("content-type", HeaderValue::from_str(content_type)?);
    }

    Ok(())
}

// Mirrored in frontend/src/utils/index.js -> const HEADER_ALIAS
static HEADER_ALIAS: LazyLock<HashMap<&'static str, &'static str>> = LazyLock::new(|| {
    let mut map = HashMap::new();
    map.insert("ct", "content-type");
    map.insert("c", "set-cookie");
    map.insert("sc", "set-cookie");
    map.insert("cookie", "set-cookie");
    map.insert("l", "location");
    map.insert("loc", "location");
    map.insert("csp", "content-security-policy");
    map
});

impl Response {
    pub async fn get_body(&self) -> Result<(Vec<u8>, Option<String>), Err> {
        Ok(if let Some(body) = &self.body {
            (body.clone().into(), None)
        } else if let Some(body_b64) = &self.body_b64 {
            (body_b64.replace(' ', "+").as_str().from_base64()?, None)
        } else if let Some(gist) = &self.gist {
            get_gist_content(gist).await?
        } else {
            (vec![], None)
        })
    }

    async fn try_into_response(self) -> Result<axum::response::Response, Err> {
        let started_at = Instant::now();
        let status = StatusCode::from_u16(self.status)?;

        let (body, content_type) = self.get_body().await?;
        let mut response = axum::response::Response::new(axum::body::Body::from(body));
        *response.status_mut() = status;

        // Add requested headers and resolve aliases
        let headers = response.headers_mut();
        for (key, values) in &self.headers {
            let key = HEADER_ALIAS.get(key.as_str()).copied().unwrap_or(key);
            let key = HeaderName::from_str(key)?;
            for value in values {
                headers.append(key.clone(), HeaderValue::from_str(value)?);
            }
        }
        let inferred_content_type = self.path.as_deref().and_then(content_type_from_path);
        // Set Content-Type from path extension if not set
        set_default_content_type(
            headers,
            inferred_content_type.as_deref(),
            content_type.as_deref(),
        )?;
        // Allow all Cross-Origin Resource Sharing
        if self.cors {
            let any = HeaderValue::from_static("*");
            headers.insert("Access-Control-Allow-Origin", any.clone());
            headers.insert("Access-Control-Allow-Methods", any.clone());
            headers.insert("Access-Control-Allow-Headers", any);
        }

        let elapsed = started_at.elapsed();
        let requested_delay = Duration::from_millis(self.delay);
        if elapsed < requested_delay {
            sleep(requested_delay - elapsed).await;
        }

        Ok(response)
    }
}

impl Response {
    pub async fn into_response(self) -> axum::response::Response {
        match self
            .try_into_response()
            .await
            .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()).into_response())
        {
            Ok(response) | Err(response) => response,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inferred_content_types_use_frontend_charset_rules() {
        assert_eq!(
            content_type_from_path("payload.html").as_deref(),
            Some("text/html; charset=utf-8")
        );
        assert_eq!(
            content_type_from_path("payload.xml").as_deref(),
            Some("text/xml; charset=utf-8")
        );
        assert_eq!(
            content_type_from_path("app.config").as_deref(),
            Some("application/xml; charset=utf-8")
        );
        assert_eq!(
            content_type_from_path("payload.json").as_deref(),
            Some("application/json")
        );
        assert_eq!(
            content_type_from_path("image.svg").as_deref(),
            Some("image/svg+xml")
        );
    }

    #[test]
    fn invalid_default_content_type_returns_error() {
        let mut headers = HeaderMap::new();

        let result = set_default_content_type(&mut headers, None, Some("invalid\nvalue"));

        assert!(result.is_err());
    }

    #[test]
    fn explicit_content_type_skips_invalid_default() {
        let mut headers = HeaderMap::new();
        headers.insert("content-type", HeaderValue::from_static("text/html"));

        let result = set_default_content_type(&mut headers, None, Some("invalid\nvalue"));

        assert!(result.is_ok());
        assert_eq!(headers.get("content-type").unwrap(), "text/html");
    }

    #[tokio::test]
    async fn invalid_status_is_handled_without_panicking() {
        let response: Response = serde_qs::from_str("status=0").unwrap();

        let response = response.into_response().await;

        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[tokio::test]
    async fn explicit_content_type_overrides_inferred_charset() {
        let mut response: Response = serde_qs::from_str("h[ct]=text/html").unwrap();
        response.path = Some("payload.html".to_string());

        let response = response.into_response().await;

        assert_eq!(response.headers().get("content-type").unwrap(), "text/html");
    }

    #[tokio::test]
    async fn deserialize() {
        let query_string = "status=200&body=Hello%2C%20world%21&headers[content-type]=text/plain";

        let response: Response = serde_qs::from_str(query_string).unwrap();

        assert_eq!(response.body, Some("Hello, world!".to_string()));
        assert_eq!(response.get_body().await.unwrap().0, b"Hello, world!");
        let axum_response = response.into_response().await;

        assert_eq!(axum_response.status(), StatusCode::OK);
        let headers = axum_response.headers();
        assert_eq!(headers.get("content-type").unwrap(), "text/plain");
    }

    #[tokio::test]
    async fn deserialize_multiple() {
        let query_string =
            "status=404&body=Hello%2C%20world%21&headers[Content-Type]=text/plain&headers[content-length]=42";

        let response: Response = serde_qs::from_str(query_string).unwrap();

        assert_eq!(response.body, Some("Hello, world!".to_string()));
        assert_eq!(response.get_body().await.unwrap().0, b"Hello, world!");
        let axum_response = response.into_response().await;

        assert_eq!(axum_response.status(), StatusCode::NOT_FOUND);
        let headers = axum_response.headers();
        assert_eq!(headers.get("content-type").unwrap(), "text/plain");
        assert_eq!(headers.get("content-length").unwrap(), "42");
    }

    #[tokio::test]
    async fn deserialize_duplicate_headers() {
        let response: Response =
            serde_qs::from_str("h[set-cookie]=a%3D1&h[set-cookie]=b%3D2").unwrap();
        let response = response.into_response().await;

        let cookies: Vec<_> = response
            .headers()
            .get_all("set-cookie")
            .iter()
            .map(|value| value.to_str().unwrap())
            .collect();
        assert_eq!(cookies, ["a=1", "b=2"]);
    }

    #[tokio::test]
    async fn deserialize_default() {
        let query_string = "";

        let response: Response = serde_qs::from_str(query_string).unwrap();

        assert_eq!(response.body, None);
        assert_eq!(response.get_body().await.unwrap().0, b"");
        let axum_response = response.into_response().await;

        assert_eq!(axum_response.status(), StatusCode::OK);
        let headers = axum_response.headers();
        assert_eq!(headers.get("content-type").unwrap(), "text/plain");
    }

    #[tokio::test]
    async fn deserialize_alias() {
        let query_string = "s=500&b=Hello%2C%20world%21&h[content-type]=text/plain";

        let response: Response = serde_qs::from_str(query_string).unwrap();

        assert_eq!(response.body, Some("Hello, world!".to_string()));
        assert_eq!(response.get_body().await.unwrap().0, b"Hello, world!");
        let axum_response = response.into_response().await;

        assert_eq!(axum_response.status(), StatusCode::INTERNAL_SERVER_ERROR);
        let headers = axum_response.headers();
        assert_eq!(headers.get("content-type").unwrap(), "text/plain");
    }

    #[tokio::test]
    async fn deserialize_header_alias() {
        let query_string = "h[l]=file:///etc/passwd&h[ct]=text/html&h[c]=cookie%3D42";

        let response: Response = serde_qs::from_str(query_string).unwrap();
        let axum_response = response.into_response().await;

        let headers = axum_response.headers();
        assert_eq!(headers.get("location").unwrap(), "file:///etc/passwd");
        assert_eq!(headers.get("content-type").unwrap(), "text/html");
        assert_eq!(headers.get("set-cookie").unwrap(), "cookie=42");
    }

    #[tokio::test]
    async fn deserialize_cors() {
        async fn assert_cors(query_string: &str, enabled: bool) {
            let response = serde_qs::from_str::<Response>(query_string)
                .unwrap()
                .into_response()
                .await;
            let headers = response.headers();
            if enabled {
                assert_eq!(headers.get("access-control-allow-origin").unwrap(), "*");
            } else {
                assert!(headers.get("access-control-allow-origin").is_none());
            }
        }

        assert_cors("b=body", false).await;
        assert_cors("b=body&cors=true", true).await;
        assert_cors("b=body&cors=false", false).await;
        assert_cors("b=body&cors=n", false).await;
        assert_cors("b=body&cors=", true).await;
        assert_cors("b=body&cors", true).await;
    }

    #[tokio::test]
    async fn deserialize_b64() {
        let query_string = "body.b64=SGVsbG8sIHdvcmxkIQ%3D"; // invalid padding, should be '=='

        let response: Response = serde_qs::from_str(query_string).unwrap();

        assert_eq!(response.body_b64, Some("SGVsbG8sIHdvcmxkIQ=".to_string()));
        assert_eq!(response.get_body().await.unwrap().0, b"Hello, world!");
    }

    #[test]
    fn deserialize_delay() {
        let query_string = "delay=250";

        let response: Response = serde_qs::from_str(query_string).unwrap();

        assert_eq!(response.delay, 250);
    }

    #[test]
    fn deserialize_default_delay() {
        let response: Response = serde_qs::from_str("").unwrap();

        assert_eq!(response.delay, 0);
    }

    #[test]
    fn deserialize_delay_with_suffix() {
        assert_eq!(
            serde_qs::from_str::<Response>("delay=5s").unwrap().delay,
            5_000
        );
        assert_eq!(
            serde_qs::from_str::<Response>("delay=2m").unwrap().delay,
            120_000
        );
        assert_eq!(
            serde_qs::from_str::<Response>("delay=5m").unwrap().delay,
            MAX_DELAY_MS
        );
        assert_eq!(
            serde_qs::from_str::<Response>("delay=0.1s").unwrap().delay,
            100
        );
        assert_eq!(
            serde_qs::from_str::<Response>("delay=1.5s").unwrap().delay,
            1_500
        );
        assert_eq!(
            serde_qs::from_str::<Response>("delay=0.5m").unwrap().delay,
            30_000
        );
    }

    #[test]
    fn deserialize_invalid_delay() {
        assert!(serde_qs::from_str::<Response>("delay=abc").is_err());
        assert!(serde_qs::from_str::<Response>("delay=-1").is_err());
        assert!(serde_qs::from_str::<Response>("delay=-0.1s").is_err());
        assert!(serde_qs::from_str::<Response>("delay=5x").is_err());
        assert!(serde_qs::from_str::<Response>("delay=s").is_err());
        assert!(serde_qs::from_str::<Response>("delay=m").is_err());
    }

    #[test]
    fn max_delay_constant() {
        assert_eq!(MAX_DELAY_MS, 300_000);
    }

    #[tokio::test]
    async fn response_honors_delay() {
        let response: Response = serde_qs::from_str("body=Hello&delay=50").unwrap();
        let started_at = Instant::now();

        let _ = response.into_response().await;

        assert!(started_at.elapsed() >= Duration::from_millis(50));
    }
}
