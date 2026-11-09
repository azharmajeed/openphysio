# Server API

All `/api/*` routes need `Authorization: Bearer <token>`. Errors are `{ "error": string }`.

## POST /api/coach/chat

AI coach. Reads the user's synced data (profile, injuries, plan, logs, recovery) and the knowledge base through server-side tools, and cites sources. Read-only: it never changes data.

Request:

```json
{ "messages": [{ "role": "user", "content": "How hard should I go on legs today?" }] }
```

- `messages`: non-empty, `role` is `user` or `assistant`, `content` is a plain string, last message must be `user`. Send the whole conversation each time (the server keeps no chat state).

Response 200:

```json
{
  "text": "Keep it light on the knee today [src-ioc-load-2016].",
  "citations": [
    { "id": "src-ioc-load-2016", "title": "IOC consensus on load ...", "url": "https://...", "grade": "A" }
  ],
  "redFlag": false
}
```

- `text`: the reply. Source ids appear inline as `[id]`; the client can turn them into chips by matching `citations[].id`. Ids not in the registry are never listed in `citations`.
- `citations`: resolved sources (`grade` is `A`, `B` or `C`). Open `url` on tap.
- `redFlag`: `true` when the last user message describes a red flag (chest pain, fainting, spreading numbness, night pain, sudden swelling, cannot bear weight, fever with joint pain). The model is not called; `text` is a fixed stop-and-see-a-professional reply and `citations` is empty. Show it prominently.

Errors: `400` bad body, `401` bad token, `502` provider error, `503` AI not configured (e.g. `ANTHROPIC_API_KEY` unset). With `AI_PROVIDER=mock` replies are canned. On network failure the client should show an offline notice.

Side effect: each chat saves a short `coach_note` row (memory), which syncs to devices.
