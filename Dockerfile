FROM node:alpine AS frontend-builder
WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

FROM rust:latest AS rust-builder
WORKDIR /app

COPY Cargo.* .
COPY src src
COPY --from=frontend-builder /app/dist ./frontend/dist

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo install --path .

FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=rust-builder /usr/local/cargo/bin/responder /responder

CMD ["/responder"]
