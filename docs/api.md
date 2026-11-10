# Server API

All `/api/*` routes need `Authorization: Bearer <token>`. Errors are `{ "error": string }`.

## POST /api/coach/chat

AI coach. Reads the user's synced data (profile, injuries, plan, logs, recovery) and the knowledge base through server-side tools, and cites sources. It never changes data itself: plan changes come back as `proposals` that the phone applies only after the user taps Apply.

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
  "redFlag": false,
  "proposals": [],
  "refusals": []
}
```

- `text`: the reply. Source ids appear inline as `[id]`; the client can turn them into chips by matching `citations[].id`. Ids not in the registry are never listed in `citations`.
- `citations`: resolved sources (`grade` is `A`, `B` or `C`). Open `url` on tap.
- `redFlag`: `true` when the last user message describes a red flag (chest pain, fainting, spreading numbness, night pain, sudden swelling, cannot bear weight, fever with joint pain). The model is not called; `text` is a fixed stop-and-see-a-professional reply and `citations` is empty. Show it prominently.

- `proposals`: plan changes the coach suggested that passed server validation (injury filter and 30-day spike guard). Each is `{ change, session }`: `change` is the C4 `AdaptChange` shape (`sessionId`, `kind` swap | volume | move, `exerciseId?`, `from`, `to`, `reason`); `session` is the full planned session as it would look (items and date changed, `updatedAt` set). The phone shows a card with Apply / Dismiss; on Apply it saves `session` locally and syncs. Nothing is written server-side.
- `refusals`: plain-language reasons for proposals the server rejected, e.g. `refused: exceeds your 30-day max by 18% (run distance; the limit is 10% above it)`. Show them to the user; the model also receives each reason and can propose a safer change.

Errors: `400` bad body, `401` bad token, `502` provider error, `503` AI not configured (e.g. `ANTHROPIC_API_KEY` unset). With `AI_PROVIDER=mock` replies are canned. On network failure the client should show an offline notice.

Side effect: each chat saves a short `coach_note` row (memory), which syncs to devices.

## Followed channels: /api/learn/channels

Server-only table `followed_channel` (`channelId`, `name`, `addedAt`), created by the server. On first start, when the table is empty, it is seeded from `apps/server/defaults/channels.json`. All routes need auth.

- `GET /api/learn/channels`: array of `{ channelId, name, addedAt }`, oldest first.
- `POST /api/learn/channels` with `{ "channelId": "UC...", "name": "..." }`: `201` with the row. `channelId` is `UC` plus 22 characters; `name` is 1 to 100 characters. `400` invalid, `409` already followed.
- `DELETE /api/learn/channels/:channelId`: `204`, or `404` if not followed.

## GET /api/learn/feed

New videos from the followed trainer channels (the `followed_channel` table, managed with `/api/learn/channels` below), read from each channel's public YouTube RSS feed. No API key; video content is never downloaded or proxied, the client embeds or links `url`.

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
## Scans: /api/scans

Import a scanned medical report or paper training log. The phone does on-device text recognition and uploads the image plus the text. Originals stay on the server (`DATA_DIR/scans/<id>.<ext>`) and are served back only to the authenticated owner.

- `POST /api/scans`: multipart form with `file` (jpeg, png, webp or pdf, max 15 MB), `kind` (`medical` or `log`), `text` (on-device OCR text), optional `tzOffsetMin` (integer minutes east of UTC, e.g. `330` for UTC+5:30, i.e. `-new Date().getTimezoneOffset()`; default `0`, range +-840, else `400`). Imported session times are local noon of the extracted date in that offset. Returns `201` with the `scan_import` row (`status: "pending"`). If `text` is under 20 characters the model is not called and `extracted` is `{ "items": [], "unreadable": true, "dropped": 0 }` (show "could not read this, enter it manually"). Otherwise `extracted` is `{ items, unreadable: false, dropped }`; items with unknown enum values are dropped and counted in `dropped`. Every item has a stable `itemId` and `decision: null`. Errors: `400` bad kind or no file, `413` too big, `415` bad content type, `502` provider error, `503` AI not configured.
  - medical item: `{ itemId, kind: "injury", bodyArea, side, description, startedOn, avoidAreas, decision }`
  - log item: `{ itemId, kind: "session", date, type, exercises: [{ name, sets: [{ reps, loadKg, durationS }] }], decision }`
- `GET /api/scans`: all scans, newest first. `GET /api/scans/:id`: one scan (`404` if missing).
- `GET /api/scans/:id/file`: the original file.
- `POST /api/scans/:id/decision` with `{ "approve": [itemId], "reject": [itemId] }`: approved items are written as rows with `source: "scan"` (injury; or workout plus `set_log` rows) and reach the phone on its next `/api/sync/pull`. Exercise names are matched case-insensitively to catalogue id or name; unmatched sets get `exerciseId: "unmapped"` and the name is added to the workout `notes`. Already-decided items are ignored. Returns the scan plus `written` (`{ table: [ids] }`). Scan `status` becomes `approved` (some approved) or `rejected` (all rejected) once every item is decided, else stays `pending`. `400` for unknown or conflicting `itemId`s.
