use axum::body::Bytes;
use axum::extract::State as AxumState;
use axum::http::header::CONTENT_TYPE;
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State};
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};

use crate::models::task::{Task, TaskPriority};
use crate::state::{AiInboxRuntimeState, AppState};

const DEFAULT_BIND_ADDR: &str = "127.0.0.1:4317";

#[derive(Debug, Clone, Serialize)]
pub struct AiInboxStatus {
    pub running: bool,
    pub bind_addr: Option<String>,
    pub started_at: Option<String>,
    pub requests_total: u64,
    pub accepted_total: u64,
    pub rejected_total: u64,
    pub last_error: Option<String>,
}

impl From<&AiInboxRuntimeState> for AiInboxStatus {
    fn from(value: &AiInboxRuntimeState) -> Self {
        Self {
            running: value.running,
            bind_addr: value.bind_addr.clone(),
            started_at: value.started_at.clone(),
            requests_total: value.requests_total,
            accepted_total: value.accepted_total,
            rejected_total: value.rejected_total,
            last_error: value.last_error.clone(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
struct IncomingTaskDraft {
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    tags: Vec<String>,
    priority: Option<TaskPriority>,
    acceptance_criteria: Option<String>,
    owner_actor_id: Option<String>,
    hook_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct BriefIngestPayload {
    rig_id: String,
    brief: String,
    source: Option<String>,
    default_priority: Option<TaskPriority>,
}

#[derive(Debug, Clone, Deserialize)]
struct BriefIngestPayloadV2 {
    rig_id: String,
    brief: String,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    default_priority: Option<TaskPriority>,
    #[serde(default)]
    request_id: Option<String>,
    #[serde(default)]
    metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
enum AiBriefV2Status {
    Accepted,
    Rejected,
}

#[derive(Debug, Clone, Serialize)]
struct AiBriefV2Data {
    created_count: usize,
    task_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
struct AiBriefV2Error {
    code: String,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
struct AiBriefV2Envelope {
    ok: bool,
    request_id: String,
    status: AiBriefV2Status,
    data: Option<AiBriefV2Data>,
    error: Option<AiBriefV2Error>,
}

#[derive(Debug, Clone)]
struct BridgeContext {
    app: AppHandle,
    token: Option<String>,
}

#[tauri::command]
pub fn get_ai_inbox_status(state: State<AppState>) -> AiInboxStatus {
    let runtime = state.ai_inbox.lock().unwrap();
    AiInboxStatus::from(&*runtime)
}

#[tauri::command]
pub fn start_ai_inbox(
    bind_addr: Option<String>,
    token: Option<String>,
    state: State<AppState>,
    app: AppHandle,
) -> Result<AiInboxStatus, String> {
    let bind_addr = bind_addr.unwrap_or_else(|| DEFAULT_BIND_ADDR.to_string());

    {
        let runtime = state.ai_inbox.lock().unwrap();
        if runtime.running {
            return Ok(AiInboxStatus::from(&*runtime));
        }
    }

    {
        let mut runtime = state.ai_inbox.lock().unwrap();
        runtime.running = true;
        runtime.bind_addr = Some(bind_addr.clone());
        runtime.started_at = Some(chrono::Utc::now().to_rfc3339());
        runtime.last_error = None;
    }

    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
    {
        let mut slot = state.ai_inbox_shutdown_tx.lock().unwrap();
        *slot = Some(shutdown_tx);
    }

    let ctx = BridgeContext {
        app: app.clone(),
        token: token
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty()),
    };
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let listener = match TcpListener::bind(&bind_addr).await {
            Ok(listener) => listener,
            Err(err) => {
                set_inbox_error(
                    &app_handle,
                    format!("AI inbox bind failed on {}: {}", bind_addr, err),
                );
                stop_runtime_state(&app_handle);
                return;
            }
        };

        let app_router = Router::new()
            .route("/health", get(health_handler))
            .route("/api/ai/tasks", post(post_ai_tasks).options(preflight))
            .route("/api/ai/brief", post(post_ai_brief).options(preflight))
            .route("/api/ai/brief/v2", post(post_ai_brief_v2).options(preflight))
            .with_state(ctx)
            .layer(
                CorsLayer::new()
                    .allow_origin(Any)
                    .allow_methods(Any)
                    .allow_headers(Any),
            );

        let server = axum::serve(listener, app_router.into_make_service())
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            });

        if let Err(err) = server.await {
            set_inbox_error(&app_handle, format!("AI inbox runtime error: {}", err));
        }

        stop_runtime_state(&app_handle);
    });

    let runtime = state.ai_inbox.lock().unwrap();
    Ok(AiInboxStatus::from(&*runtime))
}

#[tauri::command]
pub fn stop_ai_inbox(state: State<AppState>) -> AiInboxStatus {
    if let Some(tx) = state.ai_inbox_shutdown_tx.lock().unwrap().take() {
        let _ = tx.send(());
    }

    let mut runtime = state.ai_inbox.lock().unwrap();
    runtime.running = false;
    AiInboxStatus::from(&*runtime)
}

#[tauri::command]
pub fn ingest_ai_brief(
    rig_id: String,
    brief: String,
    source: Option<String>,
    default_priority: Option<TaskPriority>,
    app: AppHandle,
) -> Result<Vec<Task>, String> {
    let priority = default_priority.unwrap_or(TaskPriority::Medium);
    let drafts = parse_brief_to_drafts(&brief, priority);
    if drafts.is_empty() {
        return Err("No task lines detected from brief".to_string());
    }
    create_tasks_from_drafts(
        &app,
        rig_id,
        drafts,
        source.as_deref().unwrap_or("ai_brief"),
    )
}

async fn preflight() -> impl axum::response::IntoResponse {
    StatusCode::NO_CONTENT
}

async fn health_handler(
    AxumState(ctx): AxumState<BridgeContext>,
) -> impl axum::response::IntoResponse {
    let state = ctx.app.state::<AppState>();
    let runtime = state.ai_inbox.lock().unwrap();
    (
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "status": AiInboxStatus::from(&*runtime),
        })),
    )
}

async fn post_ai_brief(
    AxumState(ctx): AxumState<BridgeContext>,
    headers: HeaderMap,
    body: Bytes,
) -> impl axum::response::IntoResponse {
    mark_request(&ctx.app);

    if !authorized(&headers, &ctx.token) {
        mark_rejected(&ctx.app, "Unauthorized AI brief request");
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"ok": false, "error": "Unauthorized"})),
        );
    }

    let payload: BriefIngestPayload = match serde_json::from_slice(&body) {
        Ok(payload) => payload,
        Err(err) => {
            let msg = format!("Invalid brief JSON payload: {}", err);
            mark_rejected(&ctx.app, &msg);
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": msg})),
            );
        }
    };

    let drafts = parse_brief_to_drafts(
        &payload.brief,
        payload.default_priority.unwrap_or(TaskPriority::Medium),
    );
    if drafts.is_empty() {
        let msg = "No task lines detected from brief payload".to_string();
        mark_rejected(&ctx.app, &msg);
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": msg})),
        );
    }

    match create_tasks_from_drafts(
        &ctx.app,
        payload.rig_id,
        drafts,
        payload.source.as_deref().unwrap_or("ai_bridge_brief"),
    ) {
        Ok(created) => {
            mark_accepted(&ctx.app, created.len());
            (
                StatusCode::OK,
                Json(json!({
                    "ok": true,
                    "created_count": created.len(),
                    "task_ids": created.iter().map(|t| t.id.clone()).collect::<Vec<String>>(),
                })),
            )
        }
        Err(err) => {
            mark_rejected(&ctx.app, &err);
            (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": err})),
            )
        }
    }
}

async fn post_ai_brief_v2(
    AxumState(ctx): AxumState<BridgeContext>,
    headers: HeaderMap,
    body: Bytes,
) -> impl axum::response::IntoResponse {
    mark_request(&ctx.app);

    let mut request_id = resolve_request_id_v2(&headers, None);
    if !authorized(&headers, &ctx.token) {
        mark_rejected(&ctx.app, "Unauthorized AI brief request (v2)");
        return v2_error_response(
            StatusCode::UNAUTHORIZED,
            request_id,
            "UNAUTHORIZED",
            "Missing or invalid x-townui-token header",
        );
    }

    if !has_json_content_type(&headers) {
        mark_rejected(&ctx.app, "Unsupported content-type for AI brief v2 request");
        return v2_error_response(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            request_id,
            "UNSUPPORTED_MEDIA_TYPE",
            "Content-Type must be application/json",
        );
    }

    let payload: BriefIngestPayloadV2 = match serde_json::from_slice(&body) {
        Ok(payload) => payload,
        Err(err) => {
            let msg = format!("Invalid brief v2 JSON payload: {}", err);
            mark_rejected(&ctx.app, &msg);
            return v2_error_response(
                StatusCode::BAD_REQUEST,
                request_id,
                "INVALID_JSON",
                "Request body must be valid JSON matching the /api/ai/brief/v2 schema",
            );
        }
    };
    request_id = resolve_request_id_v2(&headers, payload.request_id.as_deref());

    if !payload.rig_id.trim().is_empty() && !payload.brief.trim().is_empty() {
        if let Some(source) = payload.source.as_deref() {
            if source.trim().is_empty() {
                mark_rejected(&ctx.app, "Validation failed: source cannot be empty");
                return v2_error_response(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    request_id,
                    "VALIDATION_ERROR",
                    "Field 'source' must be a non-empty string when provided",
                );
            }
        }
    } else {
        mark_rejected(&ctx.app, "Validation failed: missing rig_id/brief");
        return v2_error_response(
            StatusCode::UNPROCESSABLE_ENTITY,
            request_id,
            "VALIDATION_ERROR",
            "Fields 'rig_id' and 'brief' are required and must be non-empty strings",
        );
    }

    if let Some(metadata) = payload.metadata.as_ref() {
        if !metadata.is_object() {
            mark_rejected(&ctx.app, "Validation failed: metadata must be object");
            return v2_error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                request_id,
                "VALIDATION_ERROR",
                "Field 'metadata' must be a JSON object when provided",
            );
        }
    }

    let source_from_header = headers
        .get("x-ai-source")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string);
    let source = source_from_header
        .or_else(|| payload.source.clone())
        .unwrap_or_else(|| "ai_bridge_brief_v2".to_string());

    let drafts = parse_brief_to_drafts(
        &payload.brief,
        payload.default_priority.unwrap_or(TaskPriority::Medium),
    );
    if drafts.is_empty() {
        mark_rejected(&ctx.app, "No task lines detected from brief payload");
        return v2_error_response(
            StatusCode::UNPROCESSABLE_ENTITY,
            request_id,
            "EMPTY_BRIEF",
            "No task lines detected from brief",
        );
    }

    match create_tasks_from_drafts(&ctx.app, payload.rig_id.clone(), drafts, &source) {
        Ok(created) => {
            mark_accepted(&ctx.app, created.len());
            (
                StatusCode::OK,
                Json(AiBriefV2Envelope {
                    ok: true,
                    request_id,
                    status: AiBriefV2Status::Accepted,
                    data: Some(AiBriefV2Data {
                        created_count: created.len(),
                        task_ids: created.into_iter().map(|t| t.id).collect(),
                    }),
                    error: None,
                }),
            )
        }
        Err(err) => {
            mark_rejected(&ctx.app, &err);
            let (status, code, message) = map_v2_task_creation_error(&err);
            v2_error_response(status, request_id, code, message)
        }
    }
}

async fn post_ai_tasks(
    AxumState(ctx): AxumState<BridgeContext>,
    headers: HeaderMap,
    body: Bytes,
) -> impl axum::response::IntoResponse {
    mark_request(&ctx.app);

    if !authorized(&headers, &ctx.token) {
        mark_rejected(&ctx.app, "Unauthorized AI task request");
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"ok": false, "error": "Unauthorized"})),
        );
    }

    let payload: Value = match serde_json::from_slice(&body) {
        Ok(payload) => payload,
        Err(err) => {
            let msg = format!("Invalid JSON payload: {}", err);
            mark_rejected(&ctx.app, &msg);
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": msg})),
            );
        }
    };

    let normalized = match normalize_task_payload(payload) {
        Ok(value) => value,
        Err(err) => {
            mark_rejected(&ctx.app, &err);
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": err})),
            );
        }
    };

    match create_tasks_from_drafts(&ctx.app, normalized.0, normalized.1, &normalized.2) {
        Ok(created) => {
            mark_accepted(&ctx.app, created.len());
            (
                StatusCode::OK,
                Json(json!({
                    "ok": true,
                    "created_count": created.len(),
                    "task_ids": created.iter().map(|t| t.id.clone()).collect::<Vec<String>>(),
                })),
            )
        }
        Err(err) => {
            mark_rejected(&ctx.app, &err);
            (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": err})),
            )
        }
    }
}

fn has_json_content_type(headers: &HeaderMap) -> bool {
    headers
        .get(CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|value| value.to_ascii_lowercase().starts_with("application/json"))
        .unwrap_or(false)
}

fn resolve_request_id_v2(headers: &HeaderMap, payload_request_id: Option<&str>) -> String {
    headers
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
        .or_else(|| {
            payload_request_id
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(str::to_string)
        })
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string())
}

fn map_v2_task_creation_error(error: &str) -> (StatusCode, &'static str, &'static str) {
    if error.contains("Rig not found") {
        return (
            StatusCode::NOT_FOUND,
            "RIG_NOT_FOUND",
            "The specified rig_id does not exist",
        );
    }

    if error.contains("Task title cannot be empty") {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            "VALIDATION_ERROR",
            "Task title cannot be empty",
        );
    }

    (
        StatusCode::INTERNAL_SERVER_ERROR,
        "INTERNAL_ERROR",
        "Failed to create tasks from the provided brief",
    )
}

fn v2_error_response(
    status: StatusCode,
    request_id: String,
    code: impl Into<String>,
    message: impl Into<String>,
) -> (StatusCode, Json<AiBriefV2Envelope>) {
    (
        status,
        Json(AiBriefV2Envelope {
            ok: false,
            request_id,
            status: AiBriefV2Status::Rejected,
            data: None,
            error: Some(AiBriefV2Error {
                code: code.into(),
                message: message.into(),
            }),
        }),
    )
}

fn normalize_task_payload(payload: Value) -> Result<(String, Vec<IncomingTaskDraft>, String), String> {
    let rig_id = payload
        .get("rig_id")
        .and_then(|v| v.as_str())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| "Missing required field: rig_id".to_string())?;

    let source = payload
        .get("source")
        .and_then(|v| v.as_str())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| "ai_bridge".to_string());

    if let Some(brief) = payload.get("brief").and_then(|v| v.as_str()) {
        let default_priority = payload
            .get("default_priority")
            .and_then(|v| serde_json::from_value::<TaskPriority>(v.clone()).ok())
            .unwrap_or(TaskPriority::Medium);
        let drafts = parse_brief_to_drafts(brief, default_priority);
        if drafts.is_empty() {
            return Err("No task lines detected from brief".to_string());
        }
        return Ok((rig_id, drafts, source));
    }

    if let Some(tasks_value) = payload.get("tasks") {
        let drafts: Vec<IncomingTaskDraft> = serde_json::from_value(tasks_value.clone())
            .map_err(|err| format!("Invalid tasks[] payload: {}", err))?;
        if drafts.is_empty() {
            return Err("tasks[] cannot be empty".to_string());
        }
        return Ok((rig_id, drafts, source));
    }

    let draft: IncomingTaskDraft =
        serde_json::from_value(payload).map_err(|err| format!("Invalid task payload: {}", err))?;
    Ok((rig_id, vec![draft], source))
}

fn parse_brief_to_drafts(brief: &str, default_priority: TaskPriority) -> Vec<IncomingTaskDraft> {
    brief
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(strip_list_prefix)
        .filter(|line| !line.is_empty())
        .map(|line| {
            let (title, description) = if let Some((lhs, rhs)) = line.split_once("::") {
                (lhs.trim().to_string(), rhs.trim().to_string())
            } else {
                (line.to_string(), String::new())
            };
            IncomingTaskDraft {
                title,
                description,
                tags: Vec::new(),
                priority: Some(default_priority.clone()),
                acceptance_criteria: None,
                owner_actor_id: None,
                hook_id: None,
            }
        })
        .filter(|draft| !draft.title.trim().is_empty())
        .collect()
}

fn strip_list_prefix(line: &str) -> String {
    let trimmed = line.trim();
    let mut chars = trimmed.chars();
    let first = chars.next();
    match first {
        Some('-') | Some('*') | Some('•') => chars.as_str().trim().to_string(),
        Some(c) if c.is_ascii_digit() => {
            let remainder = chars.as_str().trim_start();
            if remainder.starts_with('.') || remainder.starts_with(')') {
                remainder[1..].trim().to_string()
            } else {
                trimmed.to_string()
            }
        }
        _ => trimmed.to_string(),
    }
}

fn create_tasks_from_drafts(
    app: &AppHandle,
    rig_id: String,
    drafts: Vec<IncomingTaskDraft>,
    source: &str,
) -> Result<Vec<Task>, String> {
    let state = app.state::<AppState>();

    {
        let rigs = state.rigs.lock().unwrap();
        if !rigs.iter().any(|r| r.id == rig_id) {
            return Err(format!("Rig not found: {}", rig_id));
        }
    }

    let mut created = Vec::with_capacity(drafts.len());
    for draft in drafts {
        let title = draft.title.trim().to_string();
        if title.is_empty() {
            return Err("Task title cannot be empty".to_string());
        }

        let task = crate::commands::tasks::create_task_internal(
            &state,
            app,
            rig_id.clone(),
            title,
            draft.description.trim().to_string(),
            draft.tags,
            draft.priority.unwrap_or(TaskPriority::Medium),
            draft.acceptance_criteria,
            draft.owner_actor_id,
            draft.hook_id,
            Some(source),
        );
        created.push(task);
    }

    Ok(created)
}

fn authorized(headers: &HeaderMap, token: &Option<String>) -> bool {
    let Some(expected) = token.as_ref() else {
        return true;
    };

    headers
        .get("x-townui-token")
        .and_then(|v| v.to_str().ok())
        .map(|actual| actual == expected)
        .unwrap_or(false)
}

fn mark_request(app: &AppHandle) {
    let state = app.state::<AppState>();
    let mut runtime = state.ai_inbox.lock().unwrap();
    runtime.requests_total = runtime.requests_total.saturating_add(1);
}

fn mark_accepted(app: &AppHandle, count: usize) {
    let state = app.state::<AppState>();
    let mut runtime = state.ai_inbox.lock().unwrap();
    runtime.accepted_total = runtime.accepted_total.saturating_add(count as u64);
    runtime.last_error = None;
}

fn mark_rejected(app: &AppHandle, error: &str) {
    let state = app.state::<AppState>();
    let mut runtime = state.ai_inbox.lock().unwrap();
    runtime.rejected_total = runtime.rejected_total.saturating_add(1);
    runtime.last_error = Some(error.to_string());
}

fn set_inbox_error(app: &AppHandle, error: String) {
    let state = app.state::<AppState>();
    let mut runtime = state.ai_inbox.lock().unwrap();
    runtime.last_error = Some(error);
}

fn stop_runtime_state(app: &AppHandle) {
    {
        let state = app.state::<AppState>();
        let runtime_guard = state.ai_inbox.lock();
        if let Ok(mut runtime) = runtime_guard {
            runtime.running = false;
            runtime.bind_addr = None;
        }
    }

    {
        let state = app.state::<AppState>();
        let slot_guard = state.ai_inbox_shutdown_tx.lock();
        if let Ok(mut slot) = slot_guard {
            *slot = None;
        }
    }
}
