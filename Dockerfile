FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
COPY frontend/scripts ./scripts
RUN npm ci
COPY frontend ./
RUN npm run build

FROM golang:alpine AS dev
RUN go install github.com/air-verse/air@latest
WORKDIR /app/backend
CMD ["air"]

FROM golang:1.21-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend ./
RUN go build -ldflags "-s -w" -o /app/bin/dev-server ./cmd/dev-server

FROM alpine:latest
RUN apk add --no-cache nodejs npm git
WORKDIR /app
COPY --from=backend-builder /app/bin/dev-server ./dev-server
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
EXPOSE 8443
VOLUME /data
ENV HOME=/data
CMD ["./dev-server", "--port", "8443", "--host", "0.0.0.0", "--root", "/data", "--static-dir", "/app/frontend/dist"]
