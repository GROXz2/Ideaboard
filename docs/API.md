# IdeaBoard API

## Authentication

All endpoints require `Authorization: Bearer <JWT>` header except
`/webhooks/stripe` which uses Stripe signatures.

Errors follow the structure:

```json
{
  "error": {
    "code": "bad_request|unauthorized|forbidden|not_found|rate_limited|internal",
    "message": "..."
  }
}
```

## POST /ai/run

Execute an AI model for a thread.

### Body

```json
{
  "threadId": "uuid",
  "input": "Prompt text",
  "model": "gpt-4o-mini",
  "temperature": 0.2,
  "attachments": [{ "id": "uuid" }],
  "rag": { "topK": 5, "usePolicies": true, "useKnowledge": false }
}
```

### Response

```json
{
  "messageId": "uuid",
  "output": { "text": "..." },
  "usage": { "tokens_in": 123, "tokens_out": 456, "usd_cost": 0.01 },
  "latency_ms": 1000
}
```

Touches tables: `ai_thread`, `ai_message`, `ai_run`, `ai_context_ref`.

## POST /attachments/sign-url

Create an attachment and return a signed upload URL.

### Body

```json
{ "boardId": "uuid", "nodeId": "uuid", "mime": "image/png", "type": "image" }
```

### Response

```json
{ "attachment": { "id": "uuid", "url": "https://..." } }
```

Touches table: `attachment`.

## POST /webhooks/stripe

Stripe webhook for purchases. Validates signature and marks purchases as paid or
refunded.

### Response

```json
{ "received": true }
```

Touches table: `purchase`.
