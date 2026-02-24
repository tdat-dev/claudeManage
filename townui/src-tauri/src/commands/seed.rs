use tauri::State;
use crate::state::AppState;
use crate::models::workflow::{WorkflowTemplate, WorkflowStep};

/// Build all bigtech-grade workflow templates.
fn bigtech_workflow_templates() -> Vec<WorkflowTemplate> {
    vec![
        // ── 1. Feature Sprint Pipeline (Google-style) ──────────────────────
        WorkflowTemplate::new(
            "Feature Sprint Pipeline".into(),
            "End-to-end feature delivery: plan → design → implement → test → review → deploy. Standard FAANG sprint flow.".into(),
            vec![
                WorkflowStep {
                    step_id: "plan".into(),
                    title: "Planning & Requirements".into(),
                    description: "Break down the feature into sub-tasks. Define acceptance criteria, edge cases, and scope boundaries. Output: task breakdown document.".into(),
                    command_template: "Analyze the feature request for {{feature_name}} in project {{rig.name}}. Break it into implementable sub-tasks with clear acceptance criteria. Consider edge cases, error handling, and backward compatibility. Output a structured plan.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Clear task breakdown with acceptance criteria for each sub-task".into()),
                },
                WorkflowStep {
                    step_id: "design".into(),
                    title: "Technical Design".into(),
                    description: "Design the solution architecture. Define interfaces, data models, and integration points.".into(),
                    command_template: "Based on the plan, design the technical architecture for {{feature_name}}. Define: 1) Data models/schemas 2) API interfaces 3) Component boundaries 4) Integration points 5) Migration strategy if needed. Follow existing patterns in {{repo.root}}.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["plan".into()],
                    acceptance_criteria: Some("Technical design doc with interfaces, data models, and clear component boundaries".into()),
                },
                WorkflowStep {
                    step_id: "implement".into(),
                    title: "Implementation".into(),
                    description: "Write the production code following the technical design. Clean, well-documented code.".into(),
                    command_template: "Implement {{feature_name}} following the technical design. Write clean, production-quality code. Follow codebase conventions. Add inline documentation for complex logic. Handle all error cases.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["design".into()],
                    acceptance_criteria: Some("Working implementation matching design spec, all error cases handled".into()),
                },
                WorkflowStep {
                    step_id: "test".into(),
                    title: "Testing".into(),
                    description: "Write comprehensive tests: unit, integration, edge cases. Achieve >80% coverage on new code.".into(),
                    command_template: "Write comprehensive tests for the {{feature_name}} implementation. Include: 1) Unit tests for each function/method 2) Integration tests for component interactions 3) Edge case tests 4) Error handling tests. Target >80% code coverage.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["implement".into()],
                    acceptance_criteria: Some(">80% test coverage, all edge cases covered, tests pass".into()),
                },
                WorkflowStep {
                    step_id: "review".into(),
                    title: "Code Review".into(),
                    description: "Automated code review: check style, security, performance, and correctness.".into(),
                    command_template: "Review the implementation of {{feature_name}}. Check: 1) Code style & conventions 2) Security vulnerabilities (injection, auth) 3) Performance issues (N+1, memory leaks) 4) Error handling completeness 5) Test quality. Report findings with severity levels.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["test".into()],
                    acceptance_criteria: Some("No critical/high severity findings, all medium findings addressed".into()),
                },
                WorkflowStep {
                    step_id: "deploy".into(),
                    title: "Deploy Preparation".into(),
                    description: "Prepare deployment: changelog, migration scripts, config changes, rollback plan.".into(),
                    command_template: "Prepare {{feature_name}} for deployment. Generate: 1) Changelog entry 2) Migration scripts if needed 3) Config/env changes 4) Rollback plan 5) Monitoring/alerting recommendations. Summarize all changes made.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["review".into()],
                    acceptance_criteria: Some("Complete deployment package with rollback plan".into()),
                },
            ],
            vec!["feature_name".into()],
        ),

        // ── 2. Bug Triage & Resolution (Meta-style) ───────────────────────
        WorkflowTemplate::new(
            "Bug Triage & Resolution".into(),
            "Systematic bug resolution: reproduce → root cause → fix → regression test → verify. SRE/oncall standard.".into(),
            vec![
                WorkflowStep {
                    step_id: "reproduce".into(),
                    title: "Reproduce & Document".into(),
                    description: "Reproduce the bug reliably. Document exact steps, environment, and observed vs expected behavior.".into(),
                    command_template: "Investigate bug: {{bug_description}}. 1) Find the relevant code in {{repo.root}} 2) Identify reproduction steps 3) Document: environment, input, expected output, actual output 4) Assess severity and blast radius.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Reproducible steps documented, severity assessed".into()),
                },
                WorkflowStep {
                    step_id: "root_cause".into(),
                    title: "Root Cause Analysis".into(),
                    description: "Deep-dive into the root cause. Trace the execution path, identify the exact failure point.".into(),
                    command_template: "Perform root cause analysis for: {{bug_description}}. Trace the execution path. Identify the exact line(s) causing the issue. Determine if this is a regression (when was it introduced?). Check if similar patterns exist elsewhere. Document the root cause clearly.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["reproduce".into()],
                    acceptance_criteria: Some("Root cause identified with exact code location and explanation".into()),
                },
                WorkflowStep {
                    step_id: "fix".into(),
                    title: "Implement Fix".into(),
                    description: "Apply the minimal, safe fix. No unnecessary refactoring — surgical precision.".into(),
                    command_template: "Fix the bug: {{bug_description}}. Apply the minimal correct fix based on root cause analysis. Do NOT refactor unrelated code. Ensure backward compatibility. Add defensive checks where appropriate. Comment the fix explaining why.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["root_cause".into()],
                    acceptance_criteria: Some("Minimal fix applied, backward compatible, no side effects".into()),
                },
                WorkflowStep {
                    step_id: "regression_test".into(),
                    title: "Regression Tests".into(),
                    description: "Write tests that would have caught this bug. Prevent future regressions.".into(),
                    command_template: "Write regression tests for: {{bug_description}}. 1) Test the exact scenario that was failing 2) Test related edge cases 3) Add tests for similar patterns found during RCA 4) Verify the fix resolves the issue. All existing tests must still pass.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["fix".into()],
                    acceptance_criteria: Some("Regression tests pass, original bug scenario covered, no existing tests broken".into()),
                },
                WorkflowStep {
                    step_id: "verify".into(),
                    title: "Verification & Postmortem".into(),
                    description: "Final verification. Write brief postmortem if severity >= high.".into(),
                    command_template: "Verify the fix for: {{bug_description}}. 1) Confirm all tests pass 2) Check no new warnings/errors 3) If severity >= High, write a brief postmortem: timeline, root cause, fix, prevention measures 4) Summarize changes for the PR description.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["regression_test".into()],
                    acceptance_criteria: Some("All tests green, postmortem written if high severity".into()),
                },
            ],
            vec!["bug_description".into()],
        ),

        // ── 3. Code Review Pipeline (Google CL-style) ─────────────────────
        WorkflowTemplate::new(
            "Automated Code Review".into(),
            "Multi-layer code review: static analysis → security scan → architecture review → performance check. Google-style CL review.".into(),
            vec![
                WorkflowStep {
                    step_id: "static_analysis".into(),
                    title: "Static Analysis".into(),
                    description: "Check code style, linting, type safety, and common anti-patterns.".into(),
                    command_template: "Perform static analysis on changes in {{target_path}}. Check: 1) Code style consistency 2) Type safety issues 3) Unused imports/variables 4) Anti-patterns (god classes, deep nesting, magic numbers) 5) Naming conventions. List issues with severity.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("All critical style/type issues identified".into()),
                },
                WorkflowStep {
                    step_id: "security_scan".into(),
                    title: "Security Review".into(),
                    description: "Check for security vulnerabilities: injection, auth bypass, data exposure, OWASP top 10.".into(),
                    command_template: "Security review of {{target_path}}. Check for: 1) SQL/command injection 2) XSS/CSRF 3) Authentication/authorization bypass 4) Sensitive data exposure 5) Insecure deserialization 6) Hardcoded secrets 7) Dependency vulnerabilities. Rate each finding: Critical/High/Medium/Low.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Zero critical/high security findings".into()),
                },
                WorkflowStep {
                    step_id: "arch_review".into(),
                    title: "Architecture Review".into(),
                    description: "Evaluate architectural decisions: modularity, coupling, scalability, maintainability.".into(),
                    command_template: "Architecture review of {{target_path}}. Evaluate: 1) Module boundaries and coupling 2) SOLID principles adherence 3) Scalability implications 4) API design quality 5) Error handling patterns 6) Testability. Suggest improvements with effort estimates.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("No architectural anti-patterns, all suggestions documented".into()),
                },
                WorkflowStep {
                    step_id: "perf_review".into(),
                    title: "Performance Review".into(),
                    description: "Check for performance issues: algorithmic complexity, memory, I/O, caching opportunities.".into(),
                    command_template: "Performance review of {{target_path}}. Check: 1) Algorithmic complexity (O(n²) patterns) 2) Memory allocation patterns 3) N+1 query issues 4) Missing caching opportunities 5) Blocking I/O 6) Large payload handling. Estimate impact of each finding.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("No O(n²) or worse issues in hot paths".into()),
                },
                WorkflowStep {
                    step_id: "summary".into(),
                    title: "Review Summary".into(),
                    description: "Consolidate all review findings into a single actionable report with priority ranking.".into(),
                    command_template: "Consolidate all review findings for {{target_path}} into a single report. Prioritize: 1) Must-fix (blocking) 2) Should-fix (next iteration) 3) Nice-to-have (tech debt). Include specific code references and suggested fixes. Generate a LGTM/Request Changes verdict.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["static_analysis".into(), "security_scan".into(), "arch_review".into(), "perf_review".into()],
                    acceptance_criteria: Some("Consolidated report with clear verdict and prioritized action items".into()),
                },
            ],
            vec!["target_path".into()],
        ),

        // ── 4. Security Audit (Microsoft SDL-style) ────────────────────────
        WorkflowTemplate::new(
            "Security Audit (SDL)".into(),
            "Microsoft SDL-style security audit: threat model → scan → classify → remediate → verify. For compliance-critical features.".into(),
            vec![
                WorkflowStep {
                    step_id: "threat_model".into(),
                    title: "Threat Modeling".into(),
                    description: "STRIDE threat modeling: identify attack surfaces, threat actors, and attack vectors.".into(),
                    command_template: "Perform STRIDE threat modeling for {{target_component}} in {{repo.root}}. Identify: 1) Attack surfaces (APIs, inputs, interfaces) 2) Threat actors (external, internal, automated) 3) Spoofing risks 4) Tampering risks 5) Repudiation risks 6) Information disclosure 7) Denial of service 8) Elevation of privilege. Output threat matrix.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Complete STRIDE matrix with all attack surfaces identified".into()),
                },
                WorkflowStep {
                    step_id: "vuln_scan".into(),
                    title: "Vulnerability Scan".into(),
                    description: "Automated vulnerability scanning of code and dependencies.".into(),
                    command_template: "Scan {{target_component}} for vulnerabilities. Check: 1) Source code for OWASP Top 10 2) Dependency CVEs 3) Configuration weaknesses 4) Secrets in code 5) Crypto misuse 6) Input validation gaps. List all findings with CVE references where applicable.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Complete scan report with all CVEs and code vulnerabilities listed".into()),
                },
                WorkflowStep {
                    step_id: "classify".into(),
                    title: "Risk Classification".into(),
                    description: "Classify and prioritize findings using CVSS scoring. Map to compliance requirements.".into(),
                    command_template: "Classify all security findings for {{target_component}}. For each finding: 1) CVSS score 2) Exploitability assessment 3) Business impact 4) Affected data classification 5) Compliance mapping (SOC2, GDPR, HIPAA if applicable). Sort by risk score descending.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["threat_model".into(), "vuln_scan".into()],
                    acceptance_criteria: Some("All findings classified with CVSS scores and prioritized".into()),
                },
                WorkflowStep {
                    step_id: "remediate".into(),
                    title: "Remediation".into(),
                    description: "Fix critical and high findings. Apply security hardening.".into(),
                    command_template: "Remediate critical and high security findings in {{target_component}}. For each: 1) Apply the fix 2) Add security tests 3) Update security configurations 4) Add input validation where missing 5) Implement defense-in-depth. Do NOT change functionality, only harden security.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["classify".into()],
                    acceptance_criteria: Some("All critical/high findings remediated, security tests added".into()),
                },
                WorkflowStep {
                    step_id: "verify_security".into(),
                    title: "Security Verification".into(),
                    description: "Re-scan and verify all remediations. Generate compliance report.".into(),
                    command_template: "Verify security remediations for {{target_component}}. 1) Re-scan for remaining vulnerabilities 2) Verify each critical/high fix is effective 3) Run security tests 4) Generate compliance summary 5) Document accepted risks for medium/low findings. Output final security report.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["remediate".into()],
                    acceptance_criteria: Some("Zero critical/high findings remaining, compliance report generated".into()),
                },
            ],
            vec!["target_component".into()],
        ),

        // ── 5. Performance Optimization (Google SRE-style) ─────────────────
        WorkflowTemplate::new(
            "Performance Optimization".into(),
            "Data-driven perf optimization: benchmark → profile → analyze → optimize → validate. Google SRE playbook.".into(),
            vec![
                WorkflowStep {
                    step_id: "benchmark".into(),
                    title: "Baseline Benchmarks".into(),
                    description: "Establish performance baselines: latency, throughput, memory, CPU.".into(),
                    command_template: "Establish performance baselines for {{target_area}} in {{repo.root}}. Measure: 1) Response latency (p50, p95, p99) 2) Throughput (ops/sec) 3) Memory usage (peak, avg) 4) CPU utilization 5) I/O patterns. Document the measurement methodology for reproducibility.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Baseline metrics documented with reproducible methodology".into()),
                },
                WorkflowStep {
                    step_id: "profile".into(),
                    title: "Profiling".into(),
                    description: "Profile hot paths: CPU flamegraph, memory allocations, I/O bottlenecks.".into(),
                    command_template: "Profile {{target_area}} to identify bottlenecks. Analyze: 1) CPU hot functions (time spent %) 2) Memory allocation hotspots 3) I/O wait patterns 4) Lock contention 5) GC pressure if applicable. Identify the top 5 optimization opportunities ranked by impact.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["benchmark".into()],
                    acceptance_criteria: Some("Top 5 bottlenecks identified with estimated impact".into()),
                },
                WorkflowStep {
                    step_id: "optimize".into(),
                    title: "Optimize".into(),
                    description: "Apply optimizations for the top bottlenecks. One change per optimization for easy rollback.".into(),
                    command_template: "Optimize {{target_area}} based on profiling results. Apply optimizations one at a time: 1) Algorithm improvements 2) Caching where beneficial 3) Batch processing 4) Lazy loading 5) Memory pooling. Each optimization should be a separate, revertable change. Document expected improvement for each.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["profile".into()],
                    acceptance_criteria: Some("Each optimization isolated and documented with expected improvement".into()),
                },
                WorkflowStep {
                    step_id: "validate_perf".into(),
                    title: "Validate & Measure".into(),
                    description: "Re-run benchmarks. Validate improvements. Check for regressions in other areas.".into(),
                    command_template: "Validate performance optimizations for {{target_area}}. 1) Re-run all baseline benchmarks 2) Compare before/after for each optimization 3) Check for regressions in non-optimized paths 4) Verify memory/CPU doesn't exceed budgets 5) Generate improvement summary with actual vs expected numbers.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["optimize".into()],
                    acceptance_criteria: Some("Measurable improvement demonstrated, no regressions".into()),
                },
                WorkflowStep {
                    step_id: "document_perf".into(),
                    title: "Performance Report".into(),
                    description: "Generate performance optimization report with before/after data and recommendations.".into(),
                    command_template: "Generate a performance report for {{target_area}} optimization. Include: 1) Before/after metrics comparison 2) What was optimized and why 3) Remaining optimization opportunities 4) Performance budget recommendations 5) Monitoring/alerting thresholds to set. Format as a team-shareable document.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["validate_perf".into()],
                    acceptance_criteria: Some("Complete performance report with actionable recommendations".into()),
                },
            ],
            vec!["target_area".into()],
        ),

        // ── 6. Incident Response (SRE Playbook) ───────────────────────────
        WorkflowTemplate::new(
            "Incident Response".into(),
            "SRE incident response: detect → triage → mitigate → RCA → postmortem. For production incidents.".into(),
            vec![
                WorkflowStep {
                    step_id: "detect".into(),
                    title: "Detection & Assessment".into(),
                    description: "Assess the incident scope: what's broken, who's affected, what's the blast radius.".into(),
                    command_template: "Assess incident: {{incident_description}}. Determine: 1) What exactly is broken 2) Blast radius (users/services affected) 3) Severity level (SEV1-4) 4) Timeline (when did it start?) 5) Related recent changes (deploys, config). Output: incident summary document.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Incident scope and severity clearly documented".into()),
                },
                WorkflowStep {
                    step_id: "triage".into(),
                    title: "Triage & Investigate".into(),
                    description: "Investigate the root cause. Check logs, metrics, recent deployments, config changes.".into(),
                    command_template: "Investigate incident: {{incident_description}}. Check: 1) Recent code changes that could cause this 2) Error patterns in the codebase 3) Configuration drift 4) Dependency failures 5) Resource exhaustion. Identify the most likely cause with confidence level.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["detect".into()],
                    acceptance_criteria: Some("Root cause hypothesis with confidence level and supporting evidence".into()),
                },
                WorkflowStep {
                    step_id: "mitigate".into(),
                    title: "Mitigation".into(),
                    description: "Apply quickest fix to restore service. Rollback, hotfix, or configuration change.".into(),
                    command_template: "Mitigate incident: {{incident_description}}. Choose the fastest path to restore service: 1) If code issue → write minimal hotfix 2) If config issue → identify correct config 3) If dependency → identify workaround. Priority is RESTORING SERVICE, not perfect fix. Document the mitigation applied.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["triage".into()],
                    acceptance_criteria: Some("Service restored or degradation minimized".into()),
                },
                WorkflowStep {
                    step_id: "rca".into(),
                    title: "Root Cause Analysis".into(),
                    description: "Deep root cause analysis after service is restored. 5-whys methodology.".into(),
                    command_template: "Deep RCA for incident: {{incident_description}}. Apply 5-whys methodology: 1) What was the proximate cause? 2) Why did that happen? (5 levels deep) 3) What controls should have prevented this? 4) Why did those controls fail? 5) Categorize: code bug, config drift, capacity, dependency, process gap.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["mitigate".into()],
                    acceptance_criteria: Some("5-whys complete, systemic causes identified".into()),
                },
                WorkflowStep {
                    step_id: "postmortem".into(),
                    title: "Postmortem & Prevention".into(),
                    description: "Write blameless postmortem. Define action items to prevent recurrence.".into(),
                    command_template: "Write blameless postmortem for: {{incident_description}}. Include: 1) Incident timeline 2) Impact summary 3) Root cause 4) What went well (detection, response) 5) What could be improved 6) Action items with owners and deadlines: a) Permanent fix b) Monitoring improvements c) Process improvements d) Testing gaps to fill. Follow Google SRE postmortem template.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["rca".into()],
                    acceptance_criteria: Some("Complete postmortem with actionable prevention items".into()),
                },
            ],
            vec!["incident_description".into()],
        ),

        // ── 7. API Design & Implementation ─────────────────────────────────
        WorkflowTemplate::new(
            "API Design & Implementation".into(),
            "API-first development: design spec → prototype → implement → contract test → document. REST/gRPC ready.".into(),
            vec![
                WorkflowStep {
                    step_id: "design_api".into(),
                    title: "API Design Spec".into(),
                    description: "Design the API: endpoints, request/response schemas, auth, rate limiting, versioning.".into(),
                    command_template: "Design API for {{api_name}}. Define: 1) Endpoints with HTTP methods 2) Request/response schemas (JSON) 3) Authentication/authorization model 4) Rate limiting strategy 5) Versioning approach 6) Error response format (RFC 7807) 7) Pagination strategy. Follow RESTful best practices or gRPC conventions as appropriate.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Complete API spec with all endpoints, schemas, auth model".into()),
                },
                WorkflowStep {
                    step_id: "prototype_api".into(),
                    title: "Prototype & Validate".into(),
                    description: "Build a minimal prototype to validate the API design. Test with sample data.".into(),
                    command_template: "Prototype the {{api_name}} API. Create: 1) Stub implementations for all endpoints 2) Sample request/response data 3) Basic validation logic 4) Test the flow with sample scenarios. Identify any design issues before full implementation.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["design_api".into()],
                    acceptance_criteria: Some("Working prototype with all endpoints stubbed and tested".into()),
                },
                WorkflowStep {
                    step_id: "implement_api".into(),
                    title: "Full Implementation".into(),
                    description: "Implement the production API with proper error handling, validation, and middleware.".into(),
                    command_template: "Implement {{api_name}} API in production quality. Include: 1) Input validation with clear error messages 2) Authentication middleware 3) Rate limiting 4) Request/response logging 5) Database integration 6) Proper HTTP status codes 7) CORS configuration. Follow the existing patterns in {{repo.root}}.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["prototype_api".into()],
                    acceptance_criteria: Some("All endpoints implemented with validation, auth, and error handling".into()),
                },
                WorkflowStep {
                    step_id: "contract_test".into(),
                    title: "Contract & Integration Tests".into(),
                    description: "Write contract tests to ensure API matches spec. Integration tests for all flows.".into(),
                    command_template: "Write tests for {{api_name}} API. Include: 1) Contract tests (response matches spec) 2) Happy path integration tests 3) Error case tests (400, 401, 403, 404, 429, 500) 4) Edge cases (empty input, large payload, concurrent requests) 5) Auth flow tests. Ensure >90% API coverage.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["implement_api".into()],
                    acceptance_criteria: Some(">90% API coverage, all error cases tested".into()),
                },
                WorkflowStep {
                    step_id: "document_api".into(),
                    title: "API Documentation".into(),
                    description: "Generate API documentation: OpenAPI/Swagger spec, usage examples, authentication guide.".into(),
                    command_template: "Generate documentation for {{api_name}} API. Create: 1) OpenAPI 3.0 spec 2) Usage examples for each endpoint 3) Authentication setup guide 4) Rate limiting documentation 5) Error code reference 6) Changelog. Make it developer-friendly with copy-paste curl examples.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["contract_test".into()],
                    acceptance_criteria: Some("Complete OpenAPI spec with usage examples and auth guide".into()),
                },
            ],
            vec!["api_name".into()],
        ),

        // ── 8. Database Migration ──────────────────────────────────────────
        WorkflowTemplate::new(
            "Database Migration".into(),
            "Safe database migration: assess → plan → migrate → validate → cutover. Zero-downtime strategy.".into(),
            vec![
                WorkflowStep {
                    step_id: "assess_db".into(),
                    title: "Assessment".into(),
                    description: "Assess current schema, data volume, dependencies, and migration risks.".into(),
                    command_template: "Assess database migration for {{migration_scope}}. Analyze: 1) Current schema structure 2) Data volume and growth rate 3) Dependent services/queries 4) Index usage patterns 5) Migration risks (data loss, downtime, corruption) 6) Rollback complexity. Output: risk assessment matrix.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Complete risk assessment with dependency mapping".into()),
                },
                WorkflowStep {
                    step_id: "plan_migration".into(),
                    title: "Migration Plan".into(),
                    description: "Design the migration strategy: blue-green, rolling, or expand-contract.".into(),
                    command_template: "Design migration plan for {{migration_scope}}. Define: 1) Migration strategy (blue-green / rolling / expand-contract) 2) Schema change scripts (forward + rollback) 3) Data transformation logic 4) Backfill strategy for new columns 5) Cutover procedure 6) Rollback procedure 7) Estimated timeline. Optimize for zero downtime.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["assess_db".into()],
                    acceptance_criteria: Some("Zero-downtime migration plan with rollback procedure".into()),
                },
                WorkflowStep {
                    step_id: "write_migration".into(),
                    title: "Write Migration Scripts".into(),
                    description: "Write forward and rollback migration scripts. Include data backfill.".into(),
                    command_template: "Write migration scripts for {{migration_scope}}. Create: 1) Forward migration (additive, non-breaking) 2) Data backfill script 3) Rollback migration 4) Validation queries (pre/post check) 5) Performance test queries. Scripts must be idempotent and safe to re-run.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["plan_migration".into()],
                    acceptance_criteria: Some("Idempotent migration scripts with rollback, tested locally".into()),
                },
                WorkflowStep {
                    step_id: "validate_migration".into(),
                    title: "Validate Migration".into(),
                    description: "Test migration on staging data. Verify data integrity and query performance.".into(),
                    command_template: "Validate migration for {{migration_scope}}. 1) Run forward migration on test data 2) Verify data integrity (row counts, checksums) 3) Run all dependent queries to verify performance 4) Test rollback procedure 5) Verify application code works with both old and new schema (expand phase). Document any issues found.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["write_migration".into()],
                    acceptance_criteria: Some("Migration tested, data integrity verified, rollback tested".into()),
                },
                WorkflowStep {
                    step_id: "cutover_plan".into(),
                    title: "Cutover & Cleanup".into(),
                    description: "Execute cutover: update application code, remove old columns (contract phase), monitor.".into(),
                    command_template: "Prepare cutover for {{migration_scope}}. Generate: 1) Cutover runbook with exact commands 2) Application code changes (switch to new schema) 3) Cleanup migration (remove old columns/tables) 4) Monitoring queries for post-migration 5) Success criteria checklist. Include timing estimates for each step.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["validate_migration".into()],
                    acceptance_criteria: Some("Complete runbook with timing, cleanup scripts, and monitoring".into()),
                },
            ],
            vec!["migration_scope".into()],
        ),

        // ── 9. Refactoring Sprint ──────────────────────────────────────────
        WorkflowTemplate::new(
            "Refactoring Sprint".into(),
            "Systematic refactoring: analyze → plan → extract → test → validate. Strangler Fig pattern for large refactors.".into(),
            vec![
                WorkflowStep {
                    step_id: "analyze_code".into(),
                    title: "Code Analysis".into(),
                    description: "Analyze code quality metrics: complexity, coupling, cohesion, duplication, test coverage.".into(),
                    command_template: "Analyze {{refactor_target}} for refactoring. Measure: 1) Cyclomatic complexity per function 2) Coupling between modules 3) Cohesion within modules 4) Code duplication 5) Test coverage gaps 6) Dead code 7) Technical debt hotspots. Prioritize refactoring targets by impact-to-effort ratio.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Code quality metrics documented, refactoring targets prioritized".into()),
                },
                WorkflowStep {
                    step_id: "plan_refactor".into(),
                    title: "Refactoring Plan".into(),
                    description: "Plan the refactoring: define target architecture, intermediate steps, and safety net.".into(),
                    command_template: "Plan refactoring of {{refactor_target}}. Define: 1) Target architecture/design 2) Strangler fig strategy (incremental steps) 3) Interface contracts (old API = new API, backward compatible) 4) Test coverage requirements before refactoring 5) Rollback points. Each step must be independently deployable.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["analyze_code".into()],
                    acceptance_criteria: Some("Incremental plan with each step independently deployable".into()),
                },
                WorkflowStep {
                    step_id: "safety_net".into(),
                    title: "Build Safety Net".into(),
                    description: "Write characterization tests to capture current behavior before changing anything.".into(),
                    command_template: "Build safety net for {{refactor_target}} refactoring. 1) Write characterization tests capturing current behavior 2) Add integration tests for all public interfaces 3) Set up code coverage measurement 4) Create snapshot tests where appropriate. These tests must pass BEFORE and AFTER refactoring.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["plan_refactor".into()],
                    acceptance_criteria: Some("Characterization tests cover all public interfaces, all passing".into()),
                },
                WorkflowStep {
                    step_id: "execute_refactor".into(),
                    title: "Execute Refactoring".into(),
                    description: "Apply refactoring changes. One logical change per commit. Run tests after each step.".into(),
                    command_template: "Execute refactoring of {{refactor_target}} following the plan. Rules: 1) One logical change per step 2) Run all tests after each change 3) Preserve all public interfaces 4) No behavior changes — only structural improvements 5) Update internal documentation. If any test fails, stop and fix before continuing.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["safety_net".into()],
                    acceptance_criteria: Some("All refactoring steps applied, all tests passing, no behavior changes".into()),
                },
                WorkflowStep {
                    step_id: "validate_refactor".into(),
                    title: "Validation & Metrics".into(),
                    description: "Re-measure code quality metrics. Verify improvement. Document learnings.".into(),
                    command_template: "Validate refactoring of {{refactor_target}}. 1) Re-measure all code quality metrics 2) Compare before/after: complexity, coupling, duplication 3) Verify all tests pass (characterization + new) 4) Check performance hasn't regressed 5) Document before/after comparison 6) List any remaining tech debt.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["execute_refactor".into()],
                    acceptance_criteria: Some("Measurable improvement in code quality metrics, all tests green".into()),
                },
            ],
            vec!["refactor_target".into()],
        ),

        // ── 10. Documentation Sprint ───────────────────────────────────────
        WorkflowTemplate::new(
            "Documentation Sprint".into(),
            "Comprehensive docs: inventory → generate → review → publish. For onboarding-ready documentation.".into(),
            vec![
                WorkflowStep {
                    step_id: "doc_inventory".into(),
                    title: "Documentation Inventory".into(),
                    description: "Audit existing docs. Identify gaps: undocumented APIs, missing guides, stale content.".into(),
                    command_template: "Audit documentation for {{doc_scope}}. Identify: 1) Documented vs undocumented public APIs 2) Missing getting-started guide 3) Stale/outdated documentation 4) Missing architecture decision records 5) Missing runbook/operational guides 6) Missing troubleshooting guides. Prioritize gaps by impact on developer onboarding.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Complete gap analysis with prioritized documentation backlog".into()),
                },
                WorkflowStep {
                    step_id: "generate_docs".into(),
                    title: "Generate Documentation".into(),
                    description: "Write the missing documentation: API docs, guides, architecture docs, runbooks.".into(),
                    command_template: "Generate documentation for {{doc_scope}} based on the gap analysis. Write: 1) API reference docs (every public function/method) 2) Getting started guide (zero to running in 5 min) 3) Architecture overview with diagrams (mermaid) 4) Common patterns and examples 5) Troubleshooting FAQ. Write for a developer who's never seen the codebase.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["doc_inventory".into()],
                    acceptance_criteria: Some("All priority gaps filled with clear, accurate documentation".into()),
                },
                WorkflowStep {
                    step_id: "code_examples".into(),
                    title: "Code Examples".into(),
                    description: "Write runnable code examples for every major use case. Copy-paste ready.".into(),
                    command_template: "Create code examples for {{doc_scope}}. For each major use case: 1) Minimal working example 2) Real-world example with error handling 3) Advanced usage example. All examples must be copy-paste runnable. Include comments explaining each step. Test that all examples work.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["doc_inventory".into()],
                    acceptance_criteria: Some("Runnable examples for all major use cases, tested".into()),
                },
                WorkflowStep {
                    step_id: "review_docs".into(),
                    title: "Documentation Review".into(),
                    description: "Review docs for accuracy, clarity, completeness. Check all code examples work.".into(),
                    command_template: "Review documentation for {{doc_scope}}. Check: 1) Technical accuracy (matches actual code) 2) Clarity (can a new dev follow it?) 3) Completeness (no missing steps) 4) Code examples all run correctly 5) Consistent formatting and style 6) No broken links or references. Fix any issues found.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["generate_docs".into(), "code_examples".into()],
                    acceptance_criteria: Some("All docs accurate, clear, and examples verified".into()),
                },
            ],
            vec!["doc_scope".into()],
        ),
    ]
}

/// Seed bigtech-standard workflow templates into the store.
/// Only adds templates whose names don't already exist (idempotent).
#[tauri::command]
pub fn seed_workflow_templates(state: State<AppState>) -> Result<Vec<String>, String> {
    let mut templates = state.workflow_templates.lock().unwrap();
    let existing_names: Vec<String> = templates.iter().map(|t| t.name.clone()).collect();
    let mut added = Vec::new();

    for tpl in bigtech_workflow_templates() {
        if !existing_names.contains(&tpl.name) {
            added.push(tpl.name.clone());
            templates.push(tpl);
        }
    }

    state.save_workflow_templates(&templates);
    Ok(added)
}

/// Returns the count of available bigtech seed templates and Gas Town formulas.
#[tauri::command]
pub fn get_seed_info() -> SeedInfo {
    let templates = bigtech_workflow_templates();
    let formulas = gastown_formula_templates();
    SeedInfo {
        workflow_template_count: templates.len(),
        workflow_template_names: templates.iter().map(|t| t.name.clone()).collect(),
        formula_count: formulas.len(),
        formula_names: formulas.iter().map(|t| t.name.clone()).collect(),
        prompt_template_count: crate::templates::get_builtin_templates().len(),
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SeedInfo {
    pub workflow_template_count: usize,
    pub workflow_template_names: Vec<String>,
    pub formula_count: usize,
    pub formula_names: Vec<String>,
    pub prompt_template_count: usize,
}

// ─── Gas Town built-in Formulas ──────────────────────────────────────────────

fn gastown_formula_templates() -> Vec<WorkflowTemplate> {
    vec![
        // ── release formula ───────────────────────────────────────────────
        WorkflowTemplate::new(
            "Formula: Release".into(),
            "Gas Town release formula — bump version → build → test → changelog → tag → deploy.".into(),
            vec![
                WorkflowStep {
                    step_id: "bump".into(),
                    title: "Bump Version".into(),
                    description: "Determine the next version (semver), update version files.".into(),
                    command_template: "Bump the {{version_type}} version in {{repo.root}}. Update all version files (package.json, Cargo.toml, __version__, etc.) consistently. Show what changed.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("All version files updated consistently to new version".into()),
                },
                WorkflowStep {
                    step_id: "build".into(),
                    title: "Build & Verify".into(),
                    description: "Run the build and verify no compile errors.".into(),
                    command_template: "Run the build process in {{repo.root}}. Fix any build errors. Report build artifacts and bundle size.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["bump".into()],
                    acceptance_criteria: Some("Build passes without errors".into()),
                },
                WorkflowStep {
                    step_id: "test".into(),
                    title: "Run Test Suite".into(),
                    description: "Execute all tests to confirm release readiness.".into(),
                    command_template: "Run the full test suite in {{repo.root}}. Report pass/fail counts, any flaky tests, and coverage delta from last release.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["build".into()],
                    acceptance_criteria: Some("All tests pass, no regressions".into()),
                },
                WorkflowStep {
                    step_id: "changelog".into(),
                    title: "Generate Changelog".into(),
                    description: "Summarise changes since last release into CHANGELOG.md.".into(),
                    command_template: "Generate a changelog entry for version {{version_type}} in {{repo.root}}. Extract commits since last tag. Group by: Features, Bug Fixes, Breaking Changes, Internal. Write to CHANGELOG.md.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["test".into()],
                    acceptance_criteria: Some("CHANGELOG.md updated with categorised release notes".into()),
                },
                WorkflowStep {
                    step_id: "tag".into(),
                    title: "Create Release Tag".into(),
                    description: "Create a git tag for the release commit.".into(),
                    command_template: "Create a signed git tag for the new version in {{repo.root}}. Push the tag to remote. Output the tag name.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["changelog".into()],
                    acceptance_criteria: Some("Git tag created and pushed".into()),
                },
                WorkflowStep {
                    step_id: "deploy".into(),
                    title: "Deploy".into(),
                    description: "Deploy the release to the target environment.".into(),
                    command_template: "Deploy the release to {{deploy_target}} from {{repo.root}}. Confirm health checks pass post-deploy. Report deploy URL and any anomalies.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["tag".into()],
                    acceptance_criteria: Some("Deploy successful, health checks green".into()),
                },
            ],
            vec!["version_type".into(), "deploy_target".into()],
        ),

        // ── hotfix formula ────────────────────────────────────────────────
        WorkflowTemplate::new(
            "Formula: Hotfix".into(),
            "Gas Town hotfix formula — fast-track critical fix with minimal blast radius.".into(),
            vec![
                WorkflowStep {
                    step_id: "diagnose".into(),
                    title: "Diagnose & Locate".into(),
                    description: "Find the root cause of the production issue.".into(),
                    command_template: "Diagnose production issue: {{issue_description}}. Find the root cause in {{repo.root}}. Identify the minimal code change needed to fix it. Do NOT refactor.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Root cause identified, fix location known".into()),
                },
                WorkflowStep {
                    step_id: "fix".into(),
                    title: "Apply Minimal Fix".into(),
                    description: "Apply the minimal targeted fix. No scope creep.".into(),
                    command_template: "Apply the hotfix for {{issue_description}} in {{repo.root}}. Minimal change only — no refactoring or unrelated improvements. Add a regression test for the fixed scenario.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["diagnose".into()],
                    acceptance_criteria: Some("Fix applied, regression test added".into()),
                },
                WorkflowStep {
                    step_id: "validate".into(),
                    title: "Validate Fix".into(),
                    description: "Run smoke tests and the new regression test.".into(),
                    command_template: "Validate the hotfix in {{repo.root}}: run smoke tests and the new regression test. Confirm the issue is resolved and no new failures introduced.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["fix".into()],
                    acceptance_criteria: Some("Regression test passes, smoke tests green".into()),
                },
                WorkflowStep {
                    step_id: "ship".into(),
                    title: "Ship Hotfix".into(),
                    description: "Patch version bump, hotfix tag, expedited deploy.".into(),
                    command_template: "Ship the hotfix from {{repo.root}}: bump patch version, create hotfix tag, deploy immediately to production. Add a one-line entry to CHANGELOG.md under Hotfixes.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["validate".into()],
                    acceptance_criteria: Some("Hotfix deployed, patch tag created".into()),
                },
            ],
            vec!["issue_description".into()],
        ),

        // ── feature-dev formula ───────────────────────────────────────────
        WorkflowTemplate::new(
            "Formula: Feature Dev".into(),
            "Gas Town feature-dev formula — spec → spike → implement → review → ship.".into(),
            vec![
                WorkflowStep {
                    step_id: "spec".into(),
                    title: "Write Spec".into(),
                    description: "Write a concise feature spec with goals, non-goals, and success metrics.".into(),
                    command_template: "Write a feature spec for {{feature_name}} in {{repo.root}}. Include: goal, non-goals, user stories, success metrics, open questions. Keep it under 1 page.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Spec written with clear goals and success metrics".into()),
                },
                WorkflowStep {
                    step_id: "spike".into(),
                    title: "Technical Spike".into(),
                    description: "Time-boxed exploration to validate technical approach.".into(),
                    command_template: "Do a technical spike for {{feature_name}} in {{repo.root}}. Explore: 1) Feasibility 2) Key risks 3) Library options 4) Rough implementation path. Time-box to essentials only. Output findings.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["spec".into()],
                    acceptance_criteria: Some("Technical approach validated, risks identified".into()),
                },
                WorkflowStep {
                    step_id: "implement".into(),
                    title: "Implement Feature".into(),
                    description: "Full implementation following the spec and spike findings.".into(),
                    command_template: "Implement {{feature_name}} in {{repo.root}} following the spec. Write clean, tested code. Add unit tests. Follow existing patterns.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["spike".into()],
                    acceptance_criteria: Some("Feature implemented with tests".into()),
                },
                WorkflowStep {
                    step_id: "review".into(),
                    title: "Self-Review".into(),
                    description: "Review for code quality, security, and spec compliance.".into(),
                    command_template: "Review the {{feature_name}} implementation in {{repo.root}}. Check: spec compliance, code quality, security issues, test coverage, documentation. Output a review summary.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["implement".into()],
                    acceptance_criteria: Some("No blockers, spec requirements met".into()),
                },
                WorkflowStep {
                    step_id: "ship".into(),
                    title: "Ship Feature".into(),
                    description: "Merge to main, update docs, notify stakeholders.".into(),
                    command_template: "Ship {{feature_name}} in {{repo.root}}: merge to main branch, update relevant docs/README, add CHANGELOG entry, create PR description summary.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["review".into()],
                    acceptance_criteria: Some("Merged, docs updated, changelog entry written".into()),
                },
            ],
            vec!["feature_name".into()],
        ),

        // ── database migration formula ─────────────────────────────────────
        WorkflowTemplate::new(
            "Formula: Database Migration".into(),
            "Gas Town DB migration formula — plan → script → dry-run → apply → verify → rollback-plan.".into(),
            vec![
                WorkflowStep {
                    step_id: "plan".into(),
                    title: "Migration Plan".into(),
                    description: "Analyse schema changes, estimate size/runtime, identify risks.".into(),
                    command_template: "Plan a database migration for {{migration_goal}} in {{repo.root}}. Analyse: schema diff, table sizes, index impacts, lock risks, estimated runtime, zero-downtime feasibility.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec![],
                    acceptance_criteria: Some("Migration plan with risk assessment".into()),
                },
                WorkflowStep {
                    step_id: "script".into(),
                    title: "Write Migration Script".into(),
                    description: "Write idempotent up/down migration scripts.".into(),
                    command_template: "Write migration scripts for {{migration_goal}} in {{repo.root}}. Scripts must be: idempotent, have both up and down, handle partial failures gracefully.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["plan".into()],
                    acceptance_criteria: Some("Idempotent up/down migration scripts written".into()),
                },
                WorkflowStep {
                    step_id: "dry_run".into(),
                    title: "Dry Run".into(),
                    description: "Run migration against a staging copy to measure actual runtime.".into(),
                    command_template: "Dry-run the migration for {{migration_goal}} in {{repo.root}} against staging. Report: actual runtime, rows affected, any warnings. Flag if runtime exceeds acceptable threshold.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["script".into()],
                    acceptance_criteria: Some("Dry run completed, runtime within acceptable range".into()),
                },
                WorkflowStep {
                    step_id: "apply".into(),
                    title: "Apply Migration".into(),
                    description: "Apply migration to production with monitoring.".into(),
                    command_template: "Apply the migration for {{migration_goal}} to production in {{repo.root}}. Monitor for locks, replication lag, error rates during apply. Report completion status.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["dry_run".into()],
                    acceptance_criteria: Some("Migration applied without incidents".into()),
                },
                WorkflowStep {
                    step_id: "verify".into(),
                    title: "Verify & Rollback Plan".into(),
                    description: "Verify data integrity and document rollback procedure.".into(),
                    command_template: "Verify the migration for {{migration_goal}} in {{repo.root}}: check row counts, spot-check data integrity, run application smoke tests. Document exact rollback steps with command examples.".into(),
                    agent_type: "codex".into(),
                    dependencies: vec!["apply".into()],
                    acceptance_criteria: Some("Data integrity verified, rollback steps documented".into()),
                },
            ],
            vec!["migration_goal".into()],
        ),
    ]
}

/// Seed Gas Town built-in formula templates into the store (idempotent).
#[tauri::command]
pub fn seed_gastown_formulas(state: State<AppState>) -> Result<Vec<String>, String> {
    let mut templates = state.workflow_templates.lock().unwrap();
    let existing_names: Vec<String> = templates.iter().map(|t| t.name.clone()).collect();
    let mut added = Vec::new();

    for tpl in gastown_formula_templates() {
        if !existing_names.contains(&tpl.name) {
            added.push(tpl.name.clone());
            templates.push(tpl);
        }
    }

    state.save_workflow_templates(&templates);
    Ok(added)
}

