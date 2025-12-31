# Terminal Sessions

This document explains how terminal sessions (server-side PTYs) are created, attached-to, and cleaned up in MLCRemote. It also describes a recommended TTL (reconnect window) enhancement to allow short-lived client disconnects without killing sessions immediately.

## Session creation

- The frontend prefers persistent sessions. When a `TerminalTab` mounts it issues a request to:

```
GET /api/terminal/new?shell=<shell>&cwd=<cwd>&token=<auth_token>
```

The server responds with JSON `{ "id": "s..." }` where the `id` is a session identifier.

The frontend then opens a WebSocket attaching to that session:

```
ws://<host>/ws/terminal?session=<id>&token=<auth_token>
```

If creating a persistent session fails, the frontend falls back to creating an ephemeral PTY by connecting directly to the WebSocket with query parameters:

```
ws://<host>/ws/terminal?shell=<shell>&cwd=<cwd>&token=<auth_token>
```

Ephemeral sessions are created and owned by the single WS connection and are closed when the connection closes.

## Attaching to an existing session

Any client that has a valid `session` id can attach to an existing persistent session by opening a WebSocket with `?session=<id>&token=<auth_token>`. Multiple clients can attach concurrently and will share the same PTY output.

On the server the session is tracked in an in-memory map and keeps a set of attached WebSocket connections. While at least one connection is attached, the session remains active and the PTY child process runs.

## Current cleanup behavior

- Ephemeral sessions: automatically closed when the WebSocket connection terminates (this was the original behavior).
- Persistent sessions: previously the last connection was detached but the session remained in the server's `sessions` map until explicit shutdown. This could leave orphaned shells running after clients reload or navigate away.

To address this we implemented a change so that when a persistent session's last WebSocket detaches, the server calls the session's `close()` method and removes it from the `sessions` map. This means:

- By default, persistent sessions are terminated when the last attached client disconnects.
- Re-attaching to a session after disconnect will fail unless the session id is still present (e.g., if a TTL was configured — see below).

## TTL (Reconnect Window) proposal

Motivation: Some users may briefly reload, switch tabs, or experience transient network issues and want to re-attach to the same shell. Immediately tearing down the PTY on last-disconnect prevents seamless reconnection.

Proposed behavior:

- When the last WS detaches, instead of immediately closing the session, mark it as `detached` and start a timer (TTL, e.g. 5 minutes).
- If a client attempts to re-attach with the same `session` id during the TTL window, cancel the timer and re-attach the WS to the existing session.
- If the TTL expires with no re-attachments, call `close()` and remove the session from the `sessions` map.

Implementation notes:

- Store a `detachedAt time.Time` and `ttl time.Duration` field on the `terminalSession` struct or keep a separate map of `timers` keyed by session id.
- When `removeConn` leaves no attached conns, set `detachedAt = time.Now()` and schedule a `time.AfterFunc(ttl, func(){ ... })` that checks if the session still has zero attached conns and then closes/removes it.
- If an attach request finds `detachedAt` within TTL, cancel the scheduled function (store its `*time.Timer`) and attach normally.
- Provide a server configuration option (env var or config) `TERMINAL_SESSION_TTL_SECONDS` defaulting to `0` (disabled) or e.g. `300` for 5 minutes.

Security considerations:

- Re-attaching requires knowledge of the session id. If session ids are leaked, an attacker could attach; consider rotating/expiring ids or requiring an authorization token for re-attach if needed.
- Keep session ids long and random (already implemented using crypto RNG in `generateSessionID`).

Frontend example: graceful reconnect

On the frontend, when creating a session, store the returned session id in localStorage under `terminalSession:<shellTabId>` so that a reload can attempt to re-attach to the same session id before creating a new one. If re-attach fails, fall back to requesting a new session.

```js
// pseudo-code
const id = localStorage.getItem('terminalSession:tab1')
if (id) {
  try attach to ws /ws/terminal?session=id
  if (attach ok) return
}
// otherwise create new session
const j = await fetch('/api/terminal/new?cwd=...')
localStorage.setItem('terminalSession:tab1', j.id)
attach to /ws/terminal?session=j.id
```

## Logs and observability

- The server logs session creation and termination with session id and pid when available. You can watch logs to see when a session is closed.

## Next steps / recommended defaults

- Add `TERMINAL_SESSION_TTL_SECONDS` configuration with a sane default (e.g., 300s) and implement a TTL-based delayed close as described above.
- Optionally expose an API to list active sessions for admin purposes (careful with authorization).
