# AI Inbox v2 Rollout Architecture

Date: 2026-02-24
Scope: TownUI embedded AI ingress (`src-tauri`) and UI controls (`src`)

## Context and design goals

AI Inbox v1 currently supports:
- Runtime-local bridge state (`AiInboxRuntimeState`) and HTTP ingestion endpoints in `commands/ai_inbox.rs`.
- Task creation via existing `create_task_internal` path.
- Basic token auth and counters, plus Settings UI controls.

AI Inbox v2 goals:
- Make ingestion durable and observable (request ledger, idempotency, replay safety).
- Add policy controls (source trust, rate-limit/allowlist).
- Preserve existing task creation and event emission behavior.

This design follows current patterns:
- JSON persistence under `~/.townui` via `AppState` save/load helpers.
- Tauri commands in `src-tauri/src/commands/*` with TS wrappers in `src/lib/tauri.ts`.
- Backward-compatible serde defaults for new settings/model fields.

## 1) Data models / schemas

### 1.1 New durable models

Add `src-tauri/src/models/ai_inbox.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AiInboxRequestStatus {
    Received,
    Accepted,
    Rejected,
    Duplicate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiInboxRequestRecord {
    pub request_id: String,                 // internal UUID
    pub idempotency_key: Option<String>,    // from header/payload
    pub source: String,                     // e.g. "n8n", "zapier", "llm-agent"
    pub rig_id: String,
    pub endpoint: String,                   // /api/ai/tasks | /api/ai/brief
    pub status: AiInboxRequestStatus,
    pub error: Option<String>,
    pub created_task_ids: Vec<String>,
    pub payload_sha256: String,
    pub received_at: String,
    pub processed_at: Option<String>,
    pub client_ip: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiInboxSourcePolicy {
    pub source: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub require_token: bool,
    #[serde(default)]
    pub allowed_rig_ids: Vec<String>,
    #[serde(default)]
    pub requests_per_minute: Option<u32>,
}
```

Persistence:
- `~/.townui/ai_inbox_requests.jsonl` (append-only ledger, like `audit_events.jsonl`).
- `~/.townui/ai_inbox_policies.json` (small mutable config document).

### 1.2 Settings schema extension

Extend `models/settings.rs` `AiInboxBridgeSettings`:
- `enabled: bool` (master switch; default `true`).
- `allowed_origins: Vec<String>` (default empty = current Any behavior).
- `ip_allowlist: Vec<String>` (default empty = allow all localhost/use existing behavior).
- `rate_limit_per_minute: u32` (default `120`).
- `idempotency_ttl_hours: u32` (default `24`).
- `persist_requests: bool` (default `true`).

Use `#[serde(default)]` and default functions to keep existing `settings.json` valid.

### 1.3 API payload schemas (v2)

`POST /api/ai/tasks` request:
- Existing fields remain: `rig_id`, `source`, `tasks[]`, single task object, or `brief`.
- New optional fields: `request_id` (client-generated), `metadata` object.

Headers:
- `X-TownUI-Token` (existing).
- `X-Idempotency-Key` (new).
- `X-AI-Source` (new; falls back to payload `source`).

Response (all endpoints):

```json
{
  "ok": true,
  "request_id": "uuid",
  "status": "accepted",
  "created_count": 2,
  "task_ids": ["..."],
  "duplicate_of": null,
  "error": null
}
```

## 2) API interfaces

### 2.1 HTTP bridge endpoints

Keep:
- `GET /health`
- `POST /api/ai/tasks`
- `POST /api/ai/brief`

Add:
- `GET /api/ai/requests?rig_id=&status=&limit=` (read request ledger).
- `POST /api/ai/replay/{request_id}` (replay only `Rejected` or `Received` by policy).

Behavior contracts:
- On duplicate idempotency key within TTL and same payload hash: return `status=duplicate`, no task creation.
- On idempotency key reuse with different payload hash: reject with `409`.

### 2.2 Tauri command interfaces

Add commands in `commands/ai_inbox.rs`:
- `list_ai_inbox_requests(rig_id?: String, status?: String, limit?: u32) -> Vec<AiInboxRequestRecord>`
- `get_ai_inbox_request(request_id: String) -> AiInboxRequestRecord`
- `replay_ai_inbox_request(request_id: String) -> Result<Vec<Task>, String>`
- `get_ai_inbox_policies() -> Vec<AiInboxSourcePolicy>`
- `upsert_ai_inbox_policy(policy: AiInboxSourcePolicy) -> Vec<AiInboxSourcePolicy>`
- `delete_ai_inbox_policy(source: String) -> Vec<AiInboxSourcePolicy>`

Frontend wrapper pattern:
- Add typed interfaces and `invoke(...)` helpers in `src/lib/tauri.ts` following current `getAiInboxStatus/startAiInbox/stopAiInbox`.

## 3) Component boundaries

### 3.1 `commands/ai_inbox.rs` (ingress adapter only)

Responsibilities:
- HTTP parsing, auth, rate-limit, idempotency decision.
- Convert input into normalized drafts.
- Call ingestion service boundary.

Non-responsibilities:
- Business rules for task transitions.
- Persisting tasks directly outside existing task command path.

### 3.2 New internal service module: `services/ai_inbox_service.rs`

Responsibilities:
- Create/read `AiInboxRequestRecord`.
- Idempotency lookup and hash validation.
- Policy evaluation (source/rate/IP).
- Call `create_task_internal(...)` and emit uniform result envelope.

### 3.3 Existing task subsystem remains source of truth

`commands/tasks.rs` remains authoritative for:
- Task shape and lifecycle.
- `data-changed` emission.
- Audit event writes for created tasks.

AI Inbox v2 composes into this subsystem instead of duplicating task persistence logic.

### 3.4 UI boundary

- Keep bridge runtime controls in `SettingsPage`.
- Add a read-only “Intake Log” panel (new component) consuming `list_ai_inbox_requests`.
- TaskBoard “AI Quick Intake” should call `ingest_ai_brief` Tauri command, not HTTP localhost, to avoid loopback dependency.

## 4) Integration points

### 4.1 Existing integrations reused

- `AppState` JSON persistence helpers: add `save/load` helpers for AI inbox policy files and request ledger append.
- `AuditEvent` pipeline: continue task-level audit from `tasks.rs`.
- `data-changed` event: continue existing UI refresh flow.

### 4.2 New integrations

- Supervisor/operations surface:
  - Extend `town_status` with `ai_inbox_last_processed_at` and queue stats.
  - Optional watchdog in `deacon_patrol` to detect repeated rejections spike.
- Health dashboard:
  - show request acceptance ratio and top rejection reasons.

### 4.3 Security/hardening integration

- CORS: support configured allowlist while defaulting to current permissive behavior for backward compatibility.
- IP allowlist check at ingress; keep localhost default path functional.
- Token policy can be source-specific via `AiInboxSourcePolicy`.

## 5) Migration strategy

Use expand-contract, no downtime, backward compatible with current v1 payloads.

Phase A (expand, safe defaults):
- Add new models and files.
- Add new settings fields with serde defaults.
- Keep existing endpoints and responses valid; add optional new fields only.
- Enable ledger persistence behind `persist_requests=true` default.

Phase B (dual behavior):
- Accept old and new headers/payloads.
- Idempotency only enforced when key present (or feature flag enabled globally).
- Settings UI exposes v2 controls, but existing Start/Stop flow unchanged.

Phase C (contract):
- Mark legacy “no-envelope” response as deprecated in docs.
- After one release cycle, require standard response envelope for new clients (still parse old requests).

Rollback:
- Disable v2 enforcement by setting:
  - `persist_requests=false`
  - `rate_limit_per_minute=0` (treated as unlimited)
  - empty `ip_allowlist` and no per-source policies
- Existing v1 task ingestion path continues unchanged.

## Delivery checklist (implementation-aligned)

1. Add `models/ai_inbox.rs` and wire into `models/mod.rs`.
2. Add request ledger + policy persistence helpers in `state.rs`.
3. Refactor `commands/ai_inbox.rs` to use service boundary and response envelope.
4. Register new Tauri commands in `lib.rs`, add TS wrappers in `src/lib/tauri.ts`.
5. Add Settings “AI Inbox v2” controls and Intake Log UI.
6. Add e2e test: POST -> ledger row -> task created -> duplicate suppressed.

