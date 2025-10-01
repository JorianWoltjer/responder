use axum::handler::HandlerWithoutStateExt;
use responder::index;

#[tokio::main]
async fn main() {
    let listener = tokio::net::TcpListener::bind("0.0.0.0:80").await.unwrap();
    println!("Listening on {}...", listener.local_addr().unwrap());

    axum::serve(listener, tower::make::Shared::new(index.into_service()))
        .await
        .unwrap();
}
