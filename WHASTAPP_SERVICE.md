# WhatsApp external send API

This document describes how **other services** can enqueue an outbound WhatsApp message through this app’s Baileys integration.

The route is separate from the admin UI API: it does **not** use JWT cookies or `Authorization: Bearer` user tokens. Access is gated only by a shared secret (**API key**). CORS for this path is open (`*`) so browser-based callers can preflight; prefer **server-to-server** calls over HTTPS.

---

## Configuration

Set on the server (see `server/.env.example`):

| Variable | Description |
|----------|-------------|
| `WHATSAPP_EXTERNAL_API_KEY` | Shared secret. Required for the endpoint to accept traffic. Use a long random value in production (e.g. `openssl rand -hex 32`). |

The WhatsApp session must already be **connected** (QR scanned, Baileys running). If the bridge is down, the API returns `503`.

---

## Endpoint

| Item | Value |
|------|--------|
| Method | `POST` |
| Path | `/api/external/whatsapp/send` |
| Content-Type | `application/json` |

Full URL example: `https://<your-api-host>/api/external/whatsapp/send`

---

## Authentication

Send the same value as `WHATSAPP_EXTERNAL_API_KEY` using **one** of:

1. **Header:** `X-API-Key: <your-key>`
2. **Header:** `Authorization: Bearer <your-key>`

If both are present, `X-API-Key` is used first, then the Bearer value.

Do **not** send the project’s JWT here; this route does not validate user sessions.

---

## Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `number` | string | Yes | Destination phone number (digits; local `0…` is normalized to Indonesia `62…` in the service, same as internal sends). |
| `message` | string | Yes | Plain text body to send. |

Example:

```json
{
  "number": "081234567890",
  "message": "Hello from the external service."
}
```

---

## Successful response

**HTTP 200**

```json
{
  "status": "success",
  "message": "Message queued",
  "data": {
    "logId": "674a1b2c3d4e5f6789abcdef"
  }
}
```

The message is placed in the same outbound queue as internal notifications; delivery is asynchronous and rate-limited on the server. The log is stored with notification type `external` (see `WhatsAppLog` in the codebase).

---

## Error responses

Operational errors return JSON with `status: "error"` and a `message` field (shape may include more in `development`).

| HTTP | Typical `message` | When |
|------|-------------------|------|
| 400 | `number and message are required` | Missing or empty `number` / `message`. |
| 401 | `Missing API key` | No `X-API-Key` and no usable Bearer token. |
| 401 | `Invalid API key` | Key does not match `WHATSAPP_EXTERNAL_API_KEY`. |
| 503 | `External WhatsApp messaging is not configured` | Env key unset or blank. |
| 503 | `WhatsApp is not connected` | Baileys not connected. |
| 500 | `Failed to queue message` | Persistence/queue error (rare). |

---

## CORS

Requests under `/api/external/whatsapp` use permissive CORS (`Access-Control-Allow-Origin: *`, no credentials). Other API routes keep the stricter default CORS (e.g. `CLIENT_URL`).

---

## Examples

### cURL (`X-API-Key`)

```bash
curl -sS -X POST "https://your-api.example.com/api/external/whatsapp/send" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_SECRET_KEY" \
  -d '{"number":"081234567890","message":"Test from curl"}'
```

### cURL (`Authorization: Bearer`)

```bash
curl -sS -X POST "https://your-api.example.com/api/external/whatsapp/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -d '{"number":"081234567890","message":"Test from curl"}'
```

### Node.js (`fetch`)

```javascript
const res = await fetch("https://your-api.example.com/api/external/whatsapp/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": process.env.WHATSAPP_EXTERNAL_API_KEY,
  },
  body: JSON.stringify({
    number: "081234567890",
    message: "Hello from Node",
  }),
});
const data = await res.json();
```

---

## Security notes

- Treat `WHATSAPP_EXTERNAL_API_KEY` like a password: rotate if leaked, store only in secrets/env, never commit to git.
- Call this API **only over HTTPS** in production so the key and message metadata are not exposed on the network.
- This endpoint can send WhatsApp messages to **any** number the connected session is allowed to message; restrict who can reach your server (firewall, private network, or API gateway) if possible.

