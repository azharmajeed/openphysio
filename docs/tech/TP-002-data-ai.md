# TP-002: Data and AI plan for PRD-002 (knowledge base, models, training, inference, deployment)

Status: Draft, for Azhar's review (gate G2)
Version: 1-draft, 2026-11-14
Covers: PRD-002 AC-5 to AC-7 and AC-12 to AC-16
Audience: the data and AI work stream. Lanes **Knowledge** (K tasks) and **AI** (AI tasks).
Research: model and licence research, 2026-11-14. Items marked *unverified* must be confirmed in the first task that uses them.

## 1. Principles
1. **Local by default.** Every AI feature works on the phone or the user's own server. Cloud providers are an opt-in the user configures (AC-14, AC-15).
2. **Evidence first, volume second.** Every claim has a source and a grade:
   - A: guideline or consensus
   - B: systematic review or RCT
   - C: convention or expert practice

   Nothing ships until a reviewer marks it reviewed (AC-6). A small, trusted knowledge base beats a large, noisy one.
3. **Data, not code.** Muscles, exercise links, cues, faults, form rules, points and badges are all data files with schemas and tests. This follows the EXECUTION.md rule.
4. **Track licences per record.** Each record stores its source licence. CC-BY-SA text is never mixed into our own text. We paraphrase, cite and link.
5. **Video stays on the phone.** Pose runs on the device. Only joint coordinates are stored, and only with consent.

## 2. Knowledge base data model (`packages/knowledge`)
Records are JSON files validated by schemas, the same pattern as `packages/catalog`.

| Record | Key fields |
| --- | --- |
| `Muscle` | id, name, aliases, region, bodyMapArea (the id the body-map component uses), actions[], dailyLifeRole, origin/insertion (optional), claims[] |
| `MuscleGroup` | id, name, muscleIds[], bodyMapAreas[] |
| `ExerciseMuscle` | exerciseId, muscleId, role (`primary` / `secondary` / `stabiliser`), sourceId |
| `Cue` | id, exerciseId, text (≤ 12 words), phase, sourceId |
| `Fault` | id, exerciseId, description, why it matters, cue id, formRuleId (if the camera can detect it), severity |
| `Guideline` | id, scope (muscle, group or goal), the recommendation (sets, reps, frequency, rest, progression) as structured fields, population, sourceId, grade |
| `Claim` | id, text (our paraphrase), sourceId, grade, subjects (muscle, exercise or goal ids) |
| `Source` | id, type (guideline, review, RCT, textbook, video), citation, DOI or PMID or URL, year, licence |
| `VideoSegment` | id, YouTube video id, channel id, start s, end s, title, summary (our words), subjects, sourceId |
| `FormRule` | id, exerciseId, landmarks used, phases, angle thresholds with hysteresis, rep definition, fault checks → fault ids (section 6) |
| every record | `review`: `draft` / `reviewed` / `rejected`, reviewer, date, notes |

Tests check:
- every id reference resolves
- every catalogue exercise has ≥ 1 primary muscle
- every claim has a source
- grades are A, B or C
- only `reviewed` records are exported into the app pack

## 3. What to collect

| Data | Source | Licence | How it's used |
| --- | --- | --- | --- |
| Muscle list, actions, origin/insertion | Wikidata (structured anatomy) and OpenStax *Anatomy & Physiology 2e* | CC0 / CC BY 4.0 | Muscle records; OpenStax is cited and paraphrased |
| Exercise ↔ muscle links | free-exercise-db (already in C1), wger | Unlicense / CC BY-SA (*verify*) | Starting links, reviewed by hand; CC BY-SA kept as references only |
| Training guidelines | ACSM 2026 position stand, NSCA, ISSN, BJSM consensus statements | Copyrighted | Paraphrase the recommendations with a citation |
| Studies | PubMed E-utilities, Europe PMC REST (metadata, abstracts, open-access full text) | Varies per article; free APIs | Grade-B claims; the PMID is stored |
| Technique cues and faults | Guidelines, textbooks, reviewed coaching videos | Varies | Our own wording, with a citation |
| Video segments | Followed channels via the YouTube Data API (metadata only) plus human-chosen timestamps | YouTube terms: embed only | Segment cards that play inside the official embed |
| Rep and form dataset | **Our own recordings** (Azhar and consenting friends): joint coordinates + labels, optional video kept locally | Ours | Rep-counter evaluation; later training |

Public rep and form datasets (Countix, RepCount, Fitness-AQA) have unclear or non-commercial licences (FLEX is CC BY-NC-SA). They are for research comparison only and never ship.

**Coverage targets for v0.2:**
- every muscle the body map shows (about 20 areas → about 45 muscles)
- links for 100% of catalogue exercises
- cues and faults for the 30 most-planned exercises
- guidelines for each of the 5 goals and each muscle group
- 3–5 reviewed video segments per major muscle group

## 4. Collection pipeline (run in parallel)

```
harvest → extract → normalise → verify → review → publish
```

1. **Harvest** (scripts in `workers/knowledge`): Wikidata SPARQL, OpenStax chapters, PubMed / Europe PMC searches per muscle and goal, YouTube Data API channel uploads. Raw files are cached by source id.
2. **Extract:** an LLM turns raw text into draft records in the schema, with the source span kept for the reviewer. It runs locally (Ollama) or through a BYO key. Large batches go to RunPod (Qwen3 class), with spend approved per batch.
3. **Normalise:** map names to ids (the muscle and exercise alias tables) and dedupe.
4. **Verify** (automatic):
   - the PMID or DOI exists
   - the claim's subject matches the source's topic
   - a second model checks that the source supports the claim
   - CC-BY-SA text never leaves the reference field

   Failures go back to draft with a reason.
5. **Review:** one PR per region or topic, holding the JSON plus a generated review page (claim, source link, span). The reviewer, Azhar or a delegate, sets `reviewed`. Rejected items keep their reason.
6. **Publish:** build `knowledge-pack-vN` (section 5) and attach it to a GitHub release. The app and server download it.

**Running in parallel:** work splits by body region (lower limb, hip and trunk, upper limb, neck and shoulder) and by topic (goals, rehab, nutrition). Each split is one implementer agent that opens one data PR. Up to four run at once, because their data files don't overlap.

## 5. Retrieval: embeddings and search (AC-7, AC-14)
- **Model:** **EmbeddingGemma 2**, text path (Apache 2.0, released 2026-10). Matryoshka 256-dim vectors, the same model on the phone and the server so vectors are compatible.
  - Fallback: Qwen3-Embedding-0.6B (Apache 2.0) on the server.
  - The phone RAM figure is *unverified*: measure it in AI5.
- **Index:** the pack is a SQLite file with an FTS5 table (keywords) and a sqlite-vec table (vectors), built in CI at publish time.
  - The phone opens it with expo-sqlite's bundled sqlite-vec (SDK 58), so it never embeds the corpus itself, only the query.
  - Hybrid search: FTS5 + vector, combined by reciprocal rank fusion.
- **No model downloaded yet:** keyword search only (FTS5), still offline.
- **Evaluation:** 60 real questions, each with its expected entries. Gate: correct entry in the top 5 for ≥ 85%. Runs in CI on every pack.

## 6. Camera: pose, rep counting and form cues (AC-12, AC-13)
- **Pose model:** MediaPipe Pose Landmarker (BlazePose lite/full, 33 landmarks with 3D world coordinates, Apache 2.0). Fallback: MoveNet. **Avoid YOLO-pose (AGPL).**
- **Camera:** react-native-vision-camera v5 frame processors, plus **our own small Nitro plugin** wrapping MediaPipe. The community plugins are stale or tied to v3/v4. AI1 spikes this and measures frames per second on the Pixel 8a.
- **Rep counter v1: rules, not a learned model.**
  - Per exercise, a `FormRule` (data) names the joint angle(s) that define a rep (e.g. knee flexion for a squat).
  - Thresholds have hysteresis, signals are smoothed (one-euro filter) and there's a minimum phase time.
  - A rep is top → bottom → top.
  - It runs in `packages/core` as pure functions over landmark frames. This revives the deferred C5 (form-rule schema and joint-angle maths).
- **Form cues:**
  - Fault checks are rules over angles, timing and left/right symmetry (e.g. knee valgus from the knee-to-ankle line in the frontal plane; depth; trunk lean; tempo).
  - Precision matters more than recall: a cue fires only if the fault appears in ≥ 2 reps of the set.
  - **At most one spoken cue per set**, and a summary after it (AC-13).
- **v1 exercises:** squat, push-up, reverse lunge, glute bridge, hip hinge (RDL), plank hold (timer + hip sag). Home exercises with clear camera angles.
- **Evaluation harness** (`workers/pose-eval`):
  - Replays recorded landmark files through the same core functions.
  - Gates: ±1 rep on ≥ 90% of sets (AC-12); fault-cue precision ≥ 0.8.
  - Runs in CI on stored landmark fixtures, never video.
- **Dataset capture:** a "record for dataset" mode in dev builds saves landmarks plus optional local video, with consent per recording. A small labelling screen marks reps and faults. Target: 6 exercises × 3 people × 10 sets, with deliberate faults.
- **Training (only if rules fail evaluation):**
  - a small temporal model (1-D CNN or GRU) over landmark sequences, per exercise or class-agnostic
  - trained in PyTorch on RunPod with our own data
  - exported to TFLite or ExecuTorch
  - it must beat the rule counter in the same harness before replacing it

## 7. Coach models and providers (AC-14, AC-15)

| Tier | Model / runtime | When |
| --- | --- | --- |
| Phone | **Gemma 4 E2B** (Apache 2.0), 4-bit GGUF through **llama.rn** (MIT, the only mature RN binding). About 2.6 GB download (D-15). The Pixel 8a's Mali GPU means CPU decoding; *measure tokens/s in AI7*. | Offline, short answers grounded in retrieval |
| My server | Ollama or llama.cpp in an optional Compose profile (`--profile local-llm`), a 4B-class model on CPU (Gemma 4 E4B or Qwen 3.5 4B; check its licence) | At home or on the LAN; longer answers |
| My key | **Vercel AI SDK 6** provider layer on the server. API keys for Anthropic, OpenAI and Google. **OpenRouter** sign-in (official OAuth PKCE, returns the user's own key). **OpenAI "Sign in with ChatGPT"** plan usage (allowed for open-source and local apps) as an optional later step. | The user's choice, per feature |

- **Not allowed (provider terms):** Claude or Gemini subscription logins in third-party apps. We offer API keys for those two only.
- **Safety stays deterministic:** the red-flag check, the injury filter and the safety validation of plan proposals run in code before and after any model, whichever tier answers.
- **Small models:** retrieval-first prompts, citations limited to the retrieved entries, and short answers. The badge shows which tier answered.
- **Coach evaluation** (`workers/coach-eval`): 40 scripted questions (injury-aware answers, red flags, citations, refusals of unsafe plan changes). Each tier must pass the safety items 100% and the citation items ≥ 90% before it is offered.

## 8. Video understanding (AC-16, lower priority, parallel)
**Constraint:** YouTube's terms forbid downloading and automated access to content. So:
- **No server-side downloading or transcript scraping of YouTube videos.**
- **Allowed inputs:**
  1. videos we film or own
  2. videos under a Creative Commons licence
  3. channels that give written permission (we can ask Squat University and others)
  4. a transcript the user pastes or provides
  5. the user's own Gemini API key with a YouTube link, Google's official route: the provider fetches the video, not us (*verify the terms in AI9*)
- **Pipeline:**
  - sample frames (1 every 2–3 s) plus the transcript
  - run Qwen3-VL-8B (Apache 2.0, about 8 GB VRAM at 4-bit) in batch on RunPod, or through the user's key
  - output structured `VideoSegment` drafts (exercises shown, cues, claims, timestamps)
  - send them to the review queue (section 4), never straight into the app
- **For the app:** reviewed segments play through the official embed at their start time.

## 9. Deployment
- **Model registry:** `packages/knowledge/models.json` lists each model's id, version, task, download URL (Hugging Face), sha256, size, licence and minimum RAM. The app's model manager (TP-004 AP6) downloads on Wi-Fi only, checks the hash, shows the size first, and can delete a model.
- **Knowledge pack:** versioned SQLite (FTS5 + vectors + reviewed records), built by CI from `packages/knowledge` and published as a GitHub release asset. The app checks for a new version on sync. The server serves the same pack.
- **Server:** the Docker image is unchanged by default. The optional `local-llm` profile adds Ollama; the `workers` profile holds the harvest, extract and verify scripts.
- **GPU batches:** RunPod scripts follow `../video-tracker/docs/runpod.md`. Each batch states its model, input count and price estimate, and waits for Azhar's approval. Results are cached so nothing is paid for twice.
- **CI gates:**
  - schema and reference tests
  - retrieval evaluation (≥ 85% top-5)
  - pose replay evaluation (AC-12 thresholds)
  - coach evaluation against the mock and the local tier, nightly

## 10. Tasks

Lanes: **Knowledge** (K) and **AI**. K tasks touch different data files, so they can run in parallel. AI tasks run in parallel with K tasks.

| ID | Task | Needs | Size | ACs | Done when |
| --- | --- | --- | --- | --- | --- |
| K1 | Knowledge schema, validation tests, review fields, pack export | — | M | AC-6 | Schema tests pass; empty pack builds |
| K2 | Muscle atlas: every body-map muscle from Wikidata and OpenStax | K1 | M | AC-5, AC-6 | ~45 muscles reviewed |
| K3 | Exercise ↔ muscle links for the whole catalogue; cues and faults for the top 30 | K1, K2 | L | AC-5, AC-6 | 100% links, 30 fault sets reviewed |
| K4 | Guidelines and claims per goal and muscle group (guidelines + PubMed / Europe PMC), graded | K1 | L | AC-6, AC-7 | Every goal and group has reviewed guidelines |
| K5 | Video segments from followed channels (Data API metadata + human timestamps) | K1, K2 | M | AC-5 | 3–5 segments per major group |
| K6 | Harvest → extract → verify pipeline scripts + generated review page | K1 | M | AC-6 | One region runs end to end |
| AI1 | Spike: Vision Camera v5 + MediaPipe Pose Nitro plugin; fps on emulator and Pixel | — | M | AC-12 | ≥ 15 fps landmarks on the Pixel |
| AI2 | Form-rule schema + joint-angle maths + rep state machine in core (revives C5) | — | M | AC-12, AC-13 | Unit tests on synthetic frames |
| AI3 | Dataset capture mode, labelling, pose evaluation harness | AI1, AI2 | M | AC-12, AC-13 | Harness reports accuracy on recorded sets |
| AI4 | On-device counting + cues wired to the session (with UI7) | AI1–AI3 | M | AC-12, AC-13 | Gates met for the 6 exercises |
| AI5 | EmbeddingGemma 2 on phone and server; hybrid search; retrieval evaluation | K1 | M | AC-7, AC-14 | ≥ 85% top-5 offline |
| AI6 | AI SDK provider layer: keys, OpenRouter PKCE, local-llm profile, routing per feature | — | M | AC-14, AC-15 | Each tier answers through one interface |
| AI7 | On-device coach: Gemma 4 E2B on llama.rn, measured on the Pixel | AI5, AI6 | M | AC-14 | Coach works in airplane mode |
| AI8 | Coach evaluation suite across tiers | AI6 | S | AC-7, AC-10 (PRD-001) | 100% safety, ≥ 90% citations |
| AI9 | Video understanding pipeline on allowed inputs (after D-17) | K1, K6 | M | AC-16 | One permitted video → reviewed segment drafts |
| AI10 | Learned rep counter (only if AI3 shows the rules miss the gate) | AI3 | L | AC-12 | Beats the rules in the harness |

## 11. Decisions this plan needs
- **D-15:** maximum phone download. The proposed budget is about 3 GB total: coach ~2.6 GB, embeddings ~0.2 GB, pose ~0.03 GB.
- **D-17:** video pipeline inputs. Proposed: own, CC-licensed and permitted videos only; ask Squat University for permission; Gemini-key route for users.
- **D-14:** the RunPod monthly cap (for extraction batches, Qwen3-VL and training).
- Who reviews knowledge entries besides Azhar. A physio friend would raise quality a lot.
