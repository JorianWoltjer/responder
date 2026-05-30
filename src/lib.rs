use std::error;

use axum::{
    body::Bytes,
    extract::Request,
    http::StatusCode,
    response::{Html, IntoResponse},
};
use regex::Regex;
use response::Response;

pub mod response;

type Err = Box<dyn error::Error>;

const GIST_ID_REGEX: &str = r"(^|\W)([a-f0-9]{32})(\W|$)";
const GIST_FILE_REGEX: &str = r"(\/([^/]+)$)";

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
    response.path.replace(path);

    Ok(response.into_response().await)
}

pub async fn get_gist_content(url: &str) -> Result<(Vec<u8>, Option<String>), Err> {
    let re_id = Regex::new(GIST_ID_REGEX)?;
    let re_file = Regex::new(GIST_FILE_REGEX)?;
    let captures = re_id.captures(url).ok_or("Invalid gist format")?;
    let id = captures.get(2).unwrap().as_str().to_string();
    let captures = re_file.captures(url);
    let file = captures.map(|cap| cap.get(2).unwrap().as_str().to_string());

    let client = reqwest::Client::new();
    let files = client
        .get(format!("https://api.github.com/gists/{id}"))
        .header("User-Agent", "reqwest")
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    let files = files
        .get("files")
        .ok_or("files key found")?
        .as_object()
        .ok_or("Files not an object")?;

    let file = match file {
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

    Ok((content.as_bytes().to_vec(), content_type))
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
}
