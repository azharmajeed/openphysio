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

## GET /api/learn/feed

New videos from the followed trainer channels (list in `apps/server/src/learn/channels.ts`), read from each channel's public YouTube RSS feed. No API key; video content is never downloaded or proxied, the client embeds or links `url`.

Response 200:

```json
{
  "items": [
    {
      "videoId": "MMrOVv1CFFw",
      "title": "Example video",
      "published": "2026-10-14T18:07:23+00:00",
      "channel": "ATG Exercise Coaching",
      "thumbnailUrl": "https://i2.ytimg.com/vi/MMrOVv1CFFw/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=MMrOVv1CFFw"
    }
  ],
  "errors": [{ "channel": "PhysioRun", "error": "HTTP 404" }]
}
```

- `items`: all channels merged, newest `published` first.
- `errors`: channels that failed to load; the others are still returned (so `items` can be partial, or empty, with HTTP 200).
- Each channel is cached in server memory for 1 hour (failures are not cached). The server needs outbound access to youtube.com.
