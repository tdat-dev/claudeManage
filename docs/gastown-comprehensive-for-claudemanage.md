# Gas Town Comprehensive Notes for ClaudeManage

Last updated: 2026-02-12  
Audience: ClaudeManage engineering team  
Purpose: tổng hợp khái niệm, workflow, lệnh vận hành, và blueprint triển khai tương đương trong ClaudeManage.

## 1. Tóm tắt điều hành

Gas Town là một hệ điều phối multi-agent tập trung vào `durability` (độ bền trạng thái công việc) và `attribution` (ai làm gì, khi nào, ở đâu). Trọng tâm của hệ là:

- Agent có thể chết/restart nhưng công việc không mất.
- Công việc được biểu diễn bằng dữ liệu có cấu trúc (`beads`) thay vì chỉ nằm trong context tạm.
- Điều phối nhiều agent qua `convoy`, `hook`, `handoff`, `mailbox`.
- Tách vai trò hạ tầng và vai trò làm việc để scale rõ ràng.

## 2. Vấn đề Gas Town giải quyết

Các pain point phổ biến khi chạy nhiều coding agent:

- Agent mất context sau restart.
- Theo dõi trách nhiệm khó (không rõ agent nào tạo thay đổi nào).
- Handoff rời rạc, thông tin thất lạc.
- 4-10 agent trở lên dễ hỗn loạn nếu điều phối thủ công.

Gas Town xử lý bằng cách giữ work-state trong git-backed structures, và biến workflow thành graph work items có thể truy vết.

## 3. Mental model cốt lõi

### 3.1 Không gian làm việc

- `Town`: workspace tổng (thường `~/gt`).
- `Rig`: container cho từng project/repo.
- `Crew`: workspace bền vững của người hoặc agent dài hạn.
- `Polecat`: worker ngắn hạn, nhận task rồi kết thúc session.

### 3.2 Điều phối

- `Mayor`: điều phối trung tâm, tạo kế hoạch/công việc.
- `Deacon`: watchdog và health/maintenance loops.
- `Witness` + `Refinery`: quan sát tiến độ và xử lý merge/queue theo rig.

### 3.3 Đơn vị công việc

- `Bead` (issue ID): đơn vị task nguyên tử, lưu có cấu trúc.
- `Hook`: nơi gắn task cho agent, có tính bền và resumable.
- `Convoy`: grouping/cohort để theo dõi tiến độ một mục tiêu lớn.
- `Formula` -> `Molecule`: workflow template và instance nhiều bước.

## 4. Nguyên lý vận hành đáng học theo

### 4.1 Durability-first

Agent context chỉ là cache tạm; source of truth nằm ở work ledger + hook state.

### 4.2 Work-on-hook means execute

Khi task đã lên hook thì worker cần xử lý ngay, không chờ thêm xác nhận trừ khi bị block.

### 4.3 Coordinator-driven orchestration

Một coordinator (Mayor) giữ bức tranh lớn, worker chỉ tập trung vào execution scope nhỏ.

### 4.4 Structured handoff

Handoff không phải chat tự do; cần artifact có trạng thái, blocker, next step, owner rõ ràng.

## 5. Workflow chuẩn trong Gas Town

### 5.1 Mayor-first workflow

1. Người dùng mô tả mục tiêu cho Mayor.
2. Mayor chia thành các bead/task.
3. Mayor tạo convoy để theo dõi mục tiêu tổng.
4. Task được sling vào worker phù hợp qua hook.
5. Worker cập nhật trạng thái (`done`, escalate, defer, handoff).
6. Mayor tổng hợp kết quả và đóng convoy.

### 5.2 Minimal mode (không phụ thuộc tmux orchestration full)

- Tạo task/convoy.
- Sling task cho worker.
- Khởi chạy runtime thủ công (Claude/Codex).
- Worker đọc mail/hook rồi thực thi.
- Theo dõi lại bằng convoy status.

### 5.3 Formula/Molecule workflow

Dùng khi quy trình lặp lại nhiều lần (release, migration, incident response):

1. Định nghĩa `formula` (TOML) có biến và dependencies.
2. `cook` để instantiate biến.
3. `pour` để tạo molecule instance theo dõi thực thi.
4. Chạy từng step theo dependency graph.

## 6. Khái niệm dữ liệu quan trọng

### 6.1 Identity model

Mỗi actor có định danh ổn định (không phụ thuộc session process ID).

Gợi ý cho ClaudeManage:

- `actor_id`: ổn định toàn cục.
- `runtime_session_id`: ngắn hạn, thay đổi theo lần khởi chạy.
- `rig_id`, `town_id`: namespace để tách bối cảnh.

### 6.2 Work item model

Trường nên có:

- `work_id` (bead-like id).
- `title`, `description`, `acceptance_criteria`.
- `status` (`todo`, `in_progress`, `blocked`, `done`, `deferred`, `escalated`).
- `owner_actor_id`.
- `hook_id` (nullable trước khi assign).
- `dependencies` (list work_id).
- `created_at`, `updated_at`, `completed_at`.

### 6.3 Hook model

- `hook_id`.
- `attached_actor_id`.
- `current_work_id`.
- `resume_cursor` hoặc `state_blob_ref`.
- `last_heartbeat`.

Hook phải cho phép resume sau crash mà không cần replay toàn bộ transcript.

## 7. Command surface tham khảo

Lệnh thường dùng (định hướng, không thay thế docs chính thức):

- `gt install`, `gt up`, `gt down`, `gt shutdown`.
- `gt rig add`, `gt crew add`, `gt worktree`.
- `gt convoy create`, `gt convoy list`, `gt convoy status`.
- `gt sling`, `gt hook`, `gt done`, `gt handoff`, `gt resume`.
- `gt dashboard` để quan sát trạng thái tổng.

## 8. Runtime integration

Gas Town hỗ trợ nhiều runtime (Claude, Codex, ...), nhưng giữ abstraction chung:

- Runtime command/args cấu hình theo project/rig.
- Có startup priming để inject context tối thiểu khi runtime không hỗ trợ hook sâu.
- Vai trò coordinator và worker được ràng bằng identity + mailbox, không hard-code theo runtime.

Ý nghĩa cho ClaudeManage: thiết kế runtime adapter theo interface chung thay vì bind logic vào một CLI duy nhất.

## 9. Blueprint áp dụng vào ClaudeManage

### 9.1 Module tối thiểu (MVP+)

1. `identity-service`: actor lifecycle, role, ownership.
2. `work-ledger-service`: CRUD work items + status transitions + dependency graph.
3. `hook-service`: attach/detach/resume work cho actor.
4. `dispatch-service`: rule-based routing task -> actor.
5. `handoff-service`: tạo/đọc handoff artifact chuẩn.
6. `observability-service`: timeline, audit, queue health.

### 9.2 API đề xuất

- `POST /work-items`
- `POST /work-items/{id}/assign`
- `POST /work-items/{id}/status`
- `POST /work-items/{id}/handoff`
- `POST /hooks/{id}/resume`
- `GET /convoys/{id}`
- `GET /actors/{id}/queue`

### 9.3 Schema SQL gợi ý

Bảng cốt lõi:

- `actors`
- `runtime_sessions`
- `work_items`
- `work_dependencies`
- `hooks`
- `hook_events`
- `convoys`
- `convoy_items`
- `handoffs`
- `audit_logs`

### 9.4 UI gợi ý cho TownUI

- Convoy board: theo dõi tiến độ tổng theo mục tiêu.
- Worker lanes: queue theo từng actor.
- Hook inspector: xem task đang pinned, trạng thái resume.
- Handoff inbox: danh sách handoff cần xử lý.
- Failure center: task blocked/escalated kèm lý do.

## 10. Quy tắc vận hành khuyến nghị

- Mỗi task phải có owner rõ trước khi chuyển `in_progress`.
- Blocker > N phút thì bắt buộc tạo handoff hoặc escalate.
- Không cho phép close task nếu thiếu acceptance evidence.
- Mọi transition trạng thái phải được audit.
- Runtime restart không được làm mất task ownership.

## 11. Anti-pattern cần tránh

- Dùng chat transcript làm nguồn trạng thái duy nhất.
- Gắn identity theo session ID (dễ đứt mạch khi restart).
- Không tách coordinator với worker execution.
- Handoff dạng văn bản tự do không schema.
- Không có queue/health monitor cho worker pool.

## 12. Lộ trình triển khai ClaudeManage (gợi ý)

### Phase 1: Durable task core

- Triển khai `work_items`, `hooks`, `actors`.
- Có status machine + audit log.
- Có resume API cho worker.

### Phase 2: Dispatch + convoy

- Convoy grouping nhiều task.
- Rule-based dispatcher (role/skill/load).
- Dashboard lane theo actor/convoy.

### Phase 3: Workflow engine

- Formula-like templates.
- Molecule-like DAG execution.
- Retry/escalation policy chuẩn.

### Phase 4: Advanced operations

- Automated watchdog/deacon loop.
- Capacity planning cho worker pool.
- SLO: lead time, stuck rate, reopen rate.

## 13. Checklist đánh giá mức độ "Gas Town-compatible"

- [ ] Task có tồn tại độc lập với session runtime.
- [ ] Handoff có format chuẩn + machine-readable.
- [ ] Có convoy/group để nhìn tiến độ mục tiêu lớn.
- [ ] Có khả năng resume task sau restart.
- [ ] Có audit trail đầy đủ cho mọi thay đổi trạng thái.
- [ ] Có cơ chế phát hiện stuck tasks tự động.

## 14. Nguồn tham chiếu

- Repository: `https://github.com/steveyegge/gastown`
- README: `https://github.com/steveyegge/gastown/blob/main/README.md`
- Docs hub: `https://docs.gastownhall.ai/`
- Glossary: `https://docs.gastownhall.ai/glossary/`
- Convoy concept: `https://docs.gastownhall.ai/concepts/convoy/`
- Molecules concept: `https://docs.gastownhall.ai/concepts/molecules/`
- Work management: `https://docs.gastownhall.ai/usage/work-management/`

---

Ghi chú:

- Tài liệu này là bản tổng hợp và diễn giải kỹ thuật cho mục đích thiết kế ClaudeManage.
- Không sao chép nguyên văn README; ưu tiên mô hình hóa lại để dùng cho thiết kế hệ thống.
