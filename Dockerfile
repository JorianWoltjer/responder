FROM rust:latest AS rust-source
WORKDIR /app

COPY Cargo.* ./
COPY src src
COPY tools tools

FROM rust-source AS mime-map-builder
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo run --locked --quiet -p generate-mime-map -- /tmp/mimeTypes.js

FROM node:alpine AS frontend-builder
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
COPY --from=mime-map-builder /tmp/mimeTypes.js ./src/generated/mimeTypes.js
RUN npm run build

FROM rust-source AS rust-builder
COPY --from=frontend-builder /app/dist ./frontend/dist

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo install --path .

FROM debian:trixie-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=rust-builder /usr/local/cargo/bin/responder /responder

USER 65534:65534

CMD ["/responder"]
