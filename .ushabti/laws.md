# Project Laws

## Preamble
These laws describe the project’s non-negotiable invariants. Every review MUST verify compliance. If a change would violate a law, the change MUST be redesigned or the law MUST be explicitly amended by the user.

## Laws

### L01 — Desktop Cross-Platform Parity
- **Rule:** The Electron app MUST support macOS, Windows, and Linux as first-class desktop platforms. No architectural, dependency, packaging, filesystem, or process decisions may intentionally exclude any of these platforms.
- **Rationale:** The editor is cross-platform by requirement.
- **Enforcement:**
  - Changes MUST avoid OS-specific behavior unless guarded by a documented abstraction with equivalent behavior on all platforms.
  - CI (or an equivalent pre-merge gate) MUST run the test suite on macOS, Windows, and Linux.
- **Scope:** Entire codebase (build tooling, app runtime, tests).
- **Exceptions:** None.

### L02 — Offline Local Operation (No Network Requirement)
- **Rule:** The app MUST run locally without requiring network connectivity. Core editor capabilities MUST remain usable with the network disconnected.
- **Rationale:** Users must be able to work offline and in restricted environments.
- **Enforcement:**
  - Core workflows (launch, open/create project, edit, save/export) MUST succeed with the network disabled.
  - The build/test workflow MUST NOT depend on external online services to function.
- **Scope:** Runtime behavior; build/test execution.
- **Exceptions:** Optional features MAY use the network only if they fail gracefully and do not block core workflows.

### L03 — Electron Security and Best-Practice Posture
- **Rule:** The app MUST follow Electron security best practices and MUST NOT expose unsafe capabilities to renderer code.
- **Rationale:** Electron apps are high-risk if renderer processes can reach privileged APIs.
- **Enforcement:**
  - Renderer code MUST NOT have direct Node.js access.
  - Privileged operations MUST be mediated via a minimal, explicitly-defined preload/API surface.
  - Remote code execution MUST NOT be enabled or introduced (e.g., executing untrusted scripts, loading remote content as app code).
- **Scope:** Electron main/preload/renderer boundaries.
- **Exceptions:** None.

### L04 — Testing Policy (Public APIs and Conditional Paths)
- **Rule:** Every public method we write MUST have unit tests that cover all conditional paths through the method (success, failure, edge cases, and each branch/decision outcome).
- **Rationale:** Public APIs are the most reused and most costly to break; missing branch coverage leaves defects untested.
- **Enforcement:**
  - Any PR that adds or changes a public method MUST add or update unit tests for that method.
  - Tests MUST exercise all meaningful branches/conditions in the public method’s behavior.
  - Tests MUST NOT directly test private APIs; private behavior MUST be covered via the public APIs that call them.
  - Tests MUST NOT test third-party/library/framework behavior (including implicitly asserting it); tests MUST focus on our code’s behavior and our integration contracts (e.g., the calls we make, the inputs we pass, and the outputs/errors we handle).
- **Scope:** Entire codebase, especially shared libraries/modules, domain logic, and main/preload APIs.
- **Exceptions:** None.

### L08 — Design for Testability
- **Rule:** Production code MUST be written with testability as a first-class constraint: dependencies MUST be injectable or substitutable so mocking/stubbing is easy and does not require invasive hacks.
- **Rationale:** Test-hostile designs lead to brittle tests, slow feedback, and untested behavior.
- **Enforcement:**
  - Code that depends on time, randomness, filesystem, OS APIs, Electron primitives, or other side effects MUST isolate those dependencies behind explicit interfaces/adapters or dependency injection.
  - Unit tests MUST be able to run deterministically and offline.
  - Reviewers MUST request refactors when a change introduces hard-to-test design that prevents unit testing the public API behavior.
- **Scope:** Entire codebase.
- **Exceptions:** None.

### L05 — Resource Safety (No Memory or Disk Leaks)
- **Rule:** The app MUST avoid unbounded growth of memory usage and MUST NOT leak disk space (e.g., temp files, caches, logs).
- **Rationale:** Editors are long-running apps; leaks degrade performance and user trust.
- **Enforcement:**
  - Long-lived caches MUST be bounded and have explicit eviction strategies.
  - Temporary files and background artifacts MUST be cleaned up deterministically.
  - Repeated open/edit/save cycles MUST NOT increase retained resources without bound.
- **Scope:** Runtime behavior and persistence layers.
- **Exceptions:** None.

### L06 — System Safety (Non-Destructive by Default)
- **Rule:** The app MUST NOT perform dangerous operations on the user’s system. It MUST only read/write within user-selected locations and MUST avoid destructive actions without explicit, informed user intent.
- **Rationale:** A map editor must not risk user data or system integrity.
- **Enforcement:**
  - No silent deletion, recursive deletion, or destructive overwrites outside explicit user-directed save/export actions.
  - No arbitrary command execution, privilege escalation attempts, or access to sensitive OS areas unrelated to editing.
  - File operations MUST be scoped to the project/workspace the user opened or paths the user explicitly chose.
- **Scope:** File I/O, process execution, OS integration.
- **Exceptions:** None.

### L07 — Truthful Naming and Accurate Comments
- **Rule:** Symbols (functions, variables, classes, modules) MUST have clear names that reflect what they do and MUST NOT be misleading. Comments MUST be accurate and kept consistent with behavior.
- **Rationale:** Misleading names/comments cause defects and slow maintenance.
- **Enforcement:**
  - Reviewers MUST reject misleading names or stale comments.
  - Behavior changes MUST update any relevant comments and tests.
- **Scope:** Entire codebase.
- **Exceptions:** None.
