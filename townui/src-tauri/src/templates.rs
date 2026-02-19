use std::collections::HashMap;
use std::fs;

pub struct Template {
    pub name: String,
    pub description: String,
    pub content: String,
    pub is_builtin: bool,
}

pub fn get_builtin_templates() -> Vec<Template> {
    vec![
        Template {
            name: "implement_feature".to_string(),
            description: "Implement a new feature".to_string(),
            content: r#"You are working on the project "{{rig.name}}".
You are on branch "{{crew.branch}}" in the repo at "{{repo.root}}".

Task: {{task.title}}

Description:
{{task.description}}

Please implement this feature. Write clean, well-structured code that follows the existing codebase patterns.
After implementing, briefly summarize what you changed."#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "fix_bug".to_string(),
            description: "Fix a bug".to_string(),
            content: r#"You are working on the project "{{rig.name}}".
You are on branch "{{crew.branch}}" in the repo at "{{repo.root}}".

Bug to fix: {{task.title}}

Description:
{{task.description}}

Please investigate and fix this bug. Explain the root cause before applying the fix.
Make sure the fix doesn't introduce regressions."#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "write_tests".to_string(),
            description: "Write tests for existing code".to_string(),
            content: r#"You are working on the project "{{rig.name}}".
You are on branch "{{crew.branch}}" in the repo at "{{repo.root}}".

Task: {{task.title}}

Description:
{{task.description}}

Please write comprehensive tests. Cover edge cases, error conditions, and happy paths.
Follow the existing test patterns in the codebase."#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "refactor".to_string(),
            description: "Refactor existing code".to_string(),
            content: r#"You are working on the project "{{rig.name}}".
You are on branch "{{crew.branch}}" in the repo at "{{repo.root}}".

Refactoring task: {{task.title}}

Description:
{{task.description}}

Please refactor the code as described. Ensure behavior is preserved — no functional changes unless explicitly requested.
Keep the code clean and well-organized."#.to_string(),
            is_builtin: true,
        },
        // ── Bigtech-grade templates ──────────────────────────────────
        Template {
            name: "code_review".to_string(),
            description: "Comprehensive code review (Google CL-style)".to_string(),
            content: r#"You are a senior engineer reviewing code in "{{rig.name}}".
Repository at "{{repo.root}}", branch "{{crew.branch}}".

Review target: {{task.title}}

Context:
{{task.description}}

Perform a thorough code review. For each finding, specify:
- Location (file:line)
- Severity: CRITICAL / HIGH / MEDIUM / LOW / NIT
- Category: correctness / security / performance / style / maintainability
- Suggested fix

Check for:
1. Correctness — Does the code do what it claims? Edge cases handled?
2. Security — Injection, auth bypass, data exposure, hardcoded secrets
3. Performance — O(n²) patterns, N+1 queries, memory leaks, blocking I/O
4. Style — Naming, formatting, idiomatic patterns, DRY violations
5. Maintainability — Readability, test coverage, documentation, coupling
6. Error handling — Are all errors caught and handled gracefully?

End with: LGTM / REQUEST_CHANGES / NEEDS_DISCUSSION
Provide an overall summary of the review."#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "security_audit".to_string(),
            description: "Security audit (OWASP + STRIDE)".to_string(),
            content: r#"You are a security engineer auditing "{{rig.name}}".
Repository at "{{repo.root}}", branch "{{crew.branch}}".

Audit scope: {{task.title}}

Details:
{{task.description}}

Perform a comprehensive security audit:

1. OWASP Top 10 check:
   - A01: Broken Access Control
   - A02: Cryptographic Failures
   - A03: Injection (SQL, Command, XSS)
   - A04: Insecure Design
   - A05: Security Misconfiguration
   - A06: Vulnerable Components
   - A07: Authentication Failures
   - A08: Data Integrity Failures
   - A09: Logging Failures
   - A10: SSRF

2. STRIDE threat model for new/changed code:
   - Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation

3. Dependency check — any known CVEs?

4. Secrets scan — hardcoded keys, tokens, passwords?

For each finding: CVSS score estimate, exploitability, remediation steps.
Output: Security report sorted by severity."#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "architecture_review".to_string(),
            description: "Architecture & design review".to_string(),
            content: r#"You are a principal engineer reviewing architecture in "{{rig.name}}".
Repository at "{{repo.root}}", branch "{{crew.branch}}".

Architecture review: {{task.title}}

Context:
{{task.description}}

Evaluate the architecture:

1. SOLID Principles
   - Single Responsibility — Does each module have one reason to change?
   - Open/Closed — Extensible without modification?
   - Liskov Substitution — Proper inheritance/interface usage?
   - Interface Segregation — No forced unused dependencies?
   - Dependency Inversion — Depends on abstractions?

2. Design Patterns — Appropriate pattern usage? Anti-patterns present?

3. Modularity — Clear boundaries? Low coupling, high cohesion?

4. Scalability — Will this handle 10x load? What breaks first?

5. Testability — Can components be tested in isolation?

6. Operational — Observable? Debuggable? Graceful degradation?

For each concern, rate: ✅ Good / ⚠️ Needs Attention / ❌ Problematic
Provide specific code references and improvement suggestions."#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "api_design".to_string(),
            description: "Design a REST/gRPC API".to_string(),
            content: r#"You are an API architect working on "{{rig.name}}".
Repository at "{{repo.root}}", branch "{{crew.branch}}".

API design task: {{task.title}}

Requirements:
{{task.description}}

Design the API following industry best practices:

1. Endpoints — RESTful resource naming, HTTP methods, status codes
2. Request/Response schemas — JSON with clear types, nullable fields documented
3. Authentication — Bearer token / API key / OAuth flow
4. Authorization — Role-based / resource-based permissions
5. Pagination — Cursor-based or offset-based with consistent format
6. Filtering & Sorting — Query parameter conventions
7. Error format — RFC 7807 Problem Details
8. Rate limiting — Headers and response codes
9. Versioning — URL path or Accept header
10. HATEOAS links if appropriate

Output: OpenAPI 3.0 spec (YAML) with usage examples (curl commands)."#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "performance_analysis".to_string(),
            description: "Performance profiling & optimization".to_string(),
            content: r#"You are a performance engineer working on "{{rig.name}}".
Repository at "{{repo.root}}", branch "{{crew.branch}}".

Performance task: {{task.title}}

Details:
{{task.description}}

Analyze and optimize performance:

1. Identify hot paths — Which functions are called most / take longest?
2. Algorithmic complexity — Any O(n²) or worse in main flows?
3. Memory — Unnecessary allocations? Large objects? Leak patterns?
4. I/O — Blocking calls? Missing async? Connection pooling?
5. Caching — What data is re-fetched frequently? Cache-friendly?
6. Database — N+1 queries? Missing indexes? Full table scans?
7. Concurrency — Lock contention? Thread pool sizing?

For each finding:
- Current cost estimate (ms / MB / ops)
- Proposed improvement
- Expected improvement (with rationale)
- Implementation effort: S / M / L

Prioritize by impact-to-effort ratio."#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "incident_investigation".to_string(),
            description: "Investigate and respond to incidents".to_string(),
            content: r#"You are an SRE investigating an incident in "{{rig.name}}".
Repository at "{{repo.root}}", branch "{{crew.branch}}".

Incident: {{task.title}}

Description:
{{task.description}}

Follow the incident response playbook:

1. ASSESS — What's broken? Who's affected? Blast radius?
2. INVESTIGATE — Check recent changes, error patterns, configurations
3. ROOT CAUSE — Apply 5-Whys methodology. Trace the failure chain.
4. MITIGATE — What's the fastest way to restore service?
   - Rollback? Hotfix? Config change? Feature flag?
5. FIX — Apply the minimal correct fix. No unnecessary changes.
6. VERIFY — Confirm the fix resolves the issue
7. PREVENT — What tests/monitoring would have caught this?

Output:
- Timeline of events
- Root cause (single paragraph)
- Fix applied (code changes)
- Prevention action items (3-5 items)"#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "documentation".to_string(),
            description: "Write comprehensive documentation".to_string(),
            content: r#"You are a technical writer for "{{rig.name}}".
Repository at "{{repo.root}}", branch "{{crew.branch}}".

Documentation task: {{task.title}}

Scope:
{{task.description}}

Write documentation following the Divio framework:

1. TUTORIAL — Step-by-step guide for beginners (learn by doing)
2. HOW-TO — Practical recipes for specific problems
3. REFERENCE — Exhaustive technical description (every param, type, return)
4. EXPLANATION — Conceptual understanding (why, not how)

Guidelines:
- Write for someone who has never seen this code
- Include copy-paste runnable examples
- Document error cases and troubleshooting
- Use diagrams (mermaid) for flows and architecture
- Keep paragraphs short (3-4 sentences max)
- Add a TL;DR at the top
- Include a prerequisite section"#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "test_strategy".to_string(),
            description: "Design comprehensive test strategy".to_string(),
            content: r#"You are a QA architect working on "{{rig.name}}".
Repository at "{{repo.root}}", branch "{{crew.branch}}".

Test strategy for: {{task.title}}

Context:
{{task.description}}

Design a comprehensive test strategy:

1. Unit Tests — What to test at function/method level
   - Pure logic, edge cases, error paths, boundary values

2. Integration Tests — Component interaction testing
   - API contracts, database queries, service communication

3. E2E Tests — Critical user path testing
   - Happy path, error recovery, concurrent usage

4. Performance Tests — Load and stress testing
   - Throughput targets, latency SLAs, resource limits

5. Security Tests — Vulnerability testing
   - Auth bypass, injection, rate limiting

6. Regression Tests — What existing behavior to protect
   - Characterization tests for legacy code

For each test:
- Test name and description
- Input data / setup
- Expected outcome
- Priority: P0 (must have) / P1 (should have) / P2 (nice to have)

Write the actual test code following existing test patterns."#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "data_migration".to_string(),
            description: "Plan and execute data migration".to_string(),
            content: r#"You are a database engineer working on "{{rig.name}}".
Repository at "{{repo.root}}", branch "{{crew.branch}}".

Migration task: {{task.title}}

Details:
{{task.description}}

Plan and execute the data migration:

1. ASSESS
   - Current schema analysis
   - Data volume and growth rate
   - Dependent queries and services
   - Risk assessment (data loss, downtime, corruption)

2. PLAN
   - Migration strategy: expand-contract (zero downtime)
   - Forward migration script
   - Rollback migration script
   - Data backfill strategy

3. IMPLEMENT
   - Write idempotent migration scripts
   - Add validation queries (pre/post checks)
   - Create data integrity checksums

4. TEST
   - Run on test data
   - Verify row counts and checksums
   - Test rollback
   - Benchmark query performance (before/after)

5. CUTOVER RUNBOOK
   - Step-by-step procedure with timing
   - Success criteria checklist
   - Monitoring queries
   - Rollback triggers

All scripts must be idempotent (safe to re-run)."#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "tech_debt_analysis".to_string(),
            description: "Analyze and prioritize technical debt".to_string(),
            content: r#"You are a tech lead analyzing technical debt in "{{rig.name}}".
Repository at "{{repo.root}}", branch "{{crew.branch}}".

Analysis scope: {{task.title}}

Focus area:
{{task.description}}

Analyze technical debt systematically:

1. CODE QUALITY
   - Cyclomatic complexity hotspots
   - Code duplication (>20 lines identical)
   - Dead code / unreachable branches
   - TODO/FIXME/HACK comments
   - Inconsistent naming or patterns

2. ARCHITECTURE
   - Circular dependencies
   - God classes / god functions
   - Missing abstraction layers
   - Tight coupling between modules
   - Missing interfaces / contracts

3. TESTING
   - Test coverage gaps
   - Flaky tests
   - Missing integration tests
   - No error case testing

4. DEPENDENCIES
   - Outdated packages (major version behind)
   - Packages with known CVEs
   - Unmaintained dependencies
   - Version conflicts

5. OPERATIONS
   - Missing monitoring / alerting
   - No health checks
   - Missing structured logging
   - No runbooks

For each item: Impact (1-5), Effort (S/M/L/XL), Priority score.
Output: Prioritized backlog sorted by priority score."#.to_string(),
            is_builtin: true,
        },
    ]
}

pub fn render_template(
    template_content: &str,
    vars: &HashMap<String, String>,
) -> String {
    let mut result = template_content.to_string();
    for (key, value) in vars {
        result = result.replace(&format!("{{{{{}}}}}", key), value);
    }
    result
}

pub fn render_builtin_template(
    template_name: &str,
    task_title: &str,
    task_description: &str,
    rig_name: &str,
    crew_branch: &str,
    repo_root: &str,
) -> String {
    let templates = get_builtin_templates();
    let template = templates
        .iter()
        .find(|t| t.name == template_name)
        .map(|t| t.content.clone())
        .unwrap_or_else(|| format!("Task: {}\n\n{}", task_title, task_description));

    let mut vars = HashMap::new();
    vars.insert("task.title".to_string(), task_title.to_string());
    vars.insert("task.description".to_string(), task_description.to_string());
    vars.insert("rig.name".to_string(), rig_name.to_string());
    vars.insert("crew.branch".to_string(), crew_branch.to_string());
    vars.insert("repo.root".to_string(), repo_root.to_string());

    render_template(&template, &vars)
}

/// Extract all `{{var}}` variable names from a template string.
pub fn extract_variables(template_content: &str) -> Vec<String> {
    let mut vars = Vec::new();
    let bytes = template_content.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i + 3 < len {
        if bytes[i] == b'{' && bytes[i + 1] == b'{' {
            // Found opening {{
            let start = i + 2;
            if let Some(end_offset) = template_content[start..].find("}}") {
                let var_name = template_content[start..start + end_offset].trim();
                if !var_name.is_empty() && !vars.contains(&var_name.to_string()) {
                    vars.push(var_name.to_string());
                }
                i = start + end_offset + 2;
            } else {
                i += 2;
            }
        } else {
            i += 1;
        }
    }

    vars
}

/// Validate that all variables in the template are provided in the vars map.
/// Returns a list of missing variable names.
pub fn validate_variables(
    template_content: &str,
    vars: &HashMap<String, String>,
) -> Vec<String> {
    extract_variables(template_content)
        .into_iter()
        .filter(|v| !vars.contains_key(v))
        .collect()
}

pub fn load_custom_templates(templates_dir: &std::path::Path) -> Vec<Template> {
    let mut templates = Vec::new();
    if let Ok(entries) = fs::read_dir(templates_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "txt" || e == "md").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(&path) {
                    let name = path
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();
                    templates.push(Template {
                        name: name.clone(),
                        description: format!("Custom template: {}", name),
                        content,
                        is_builtin: false,
                    });
                }
            }
        }
    }
    templates
}
