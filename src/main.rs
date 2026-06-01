use std::env;
use axum::handler::HandlerWithoutStateExt;
use responder::index;

#[tokio::main]
async fn main() {
    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "80".to_string());
    let bind_address = format!("{host}:{port}");

    let listener = tokio::net::TcpListener::bind(&bind_address)
        .await
        .unwrap();
    println!("Listening on {}...", listener.local_addr().unwrap());

    axum::serve(listener, tower::make::Shared::new(index.into_service()))
        .await
        .unwrap();
}
