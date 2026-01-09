# Project Style Guide

## Purpose
This document defines how we write and review code in this repository.
It exists to make the codebase readable, testable, and maintainable over time while staying consistent with the project laws in `.ushabti/laws.md`.

## Project Structure
- Keep boundaries explicit:
  - **Domain** (pure logic): map formats, validation, transforms, and editor rules.
  - **Application** (use-cases): orchestrates domain + I/O.
  - **Infrastructure** (side effects): filesystem, Electron main-process integrations, persistence, OS dialogs.
  - **UI** (renderer): view layer only; depends on application layer APIs.
- Prefer small, focused modules over “kitchen sink” folders.
- Export the minimum surface area needed. Avoid “barrel” exports when they accidentally widen the public API.

## Language & Tooling Conventions
- **TypeScript:**
  - Prefer strongly typed TypeScript. Turn on strictness when introduced (e.g., `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
  - Avoid `any`. If something is unknown, prefer `unknown` + narrowing.
  - Use discriminated unions and exhaustive checks to make invalid states unrepresentable.
- **Dependencies & tooling selection:**
  - Bias toward mature, widely deployed, well-maintained tooling over trendy or “hot” alternatives.
  - Prefer official or de-facto standard tooling in the Electron ecosystem when it meets requirements.
  - Avoid introducing new dependencies unless they provide clear, sustained value.
- **Naming:**
  - No single-letter variable names (including loop indices) unless the variable is a well-known mathematical index inside a very small scope and still unambiguous.
  - Names must be honest: the name reflects the behavior and the behavior matches the name.
  - Prefer domain language (tile, layer, brush, entity) over generic terms (data, thing, stuff).
- **Dependencies:**
  - Prefer dependency injection (constructor or factory injection) over importing global singletons.
  - Avoid hidden dependencies (module-level mutable state, implicit environment reads).

## Architectural Patterns

### Preferred
- **Sandi Metz-inspired OOP practices** (adapted to TypeScript):
  - Small objects with a single responsibility.
  - Message passing over shared mutable state.
  - Objects that collaborate via narrow interfaces.
  - Prefer “tell, don’t ask” when it improves cohesion.
  - Favor composition over inheritance.
- **Composition + polymorphism to reduce conditionals:**
  - Replace large `switch`/`if` trees with strategy objects, command objects, or polymorphic handlers.
  - Prefer mapping from discriminant → handler rather than cascading conditionals.
- **Explicit seams for side effects:**
  - Wrap filesystem, timers, random, and Electron primitives behind small adapter interfaces.
  - Keep domain logic free of `fs`, Electron, and UI framework dependencies.
- **Clean public APIs / blast-radius control:**
  - Default to `internal` module boundaries (non-exported) unless there’s a clear consumer.
  - Public APIs should be small, predictable, and hard to misuse.

### Discouraged / Forbidden
- Large classes/modules that do “a bit of everything”.
- Condition-heavy functions that mix policy decisions with low-level mechanics.
- Hidden control flow (surprising side effects in getters, constructors doing I/O).
- Framework-driven designs that make tests depend on the framework’s behavior.

## Testing Strategy
- **Unit tests focus on public behavior:**
  - Write unit tests for every public method.
  - Cover all conditional paths through the public method (success, failure, edge cases, each branch outcome).
  - Do not directly test private methods; cover private behavior through the public API.
  - Do not test third-party/library/framework behavior; test our code and our integration contracts.
- **Design for testability:**
  - Introduce interfaces/adapters so tests can stub filesystem, time, randomness, and Electron primitives.
  - Tests must be deterministic and should not require network access.
- **Test readability:**
  - Tests should read like specifications: arrange / act / assert.
  - Prefer explicit fixtures/builders over ad-hoc object literals when shapes get complex.

## Error Handling & Observability
- Prefer typed errors (custom error classes or discriminated union results) when callers need to branch on failure mode.
- Keep errors actionable: include context needed to diagnose (what operation, which path/id) without leaking sensitive system information.
- Avoid swallowing errors; either handle them meaningfully or propagate them with added context.

## Performance & Resource Use
- Prefer bounded caches and explicit cleanup for temporary artifacts.
- Be deliberate about object lifetimes:
  - Avoid retaining references to large map data in long-lived singletons.
  - Unsubscribe/dispose event listeners and resources at clear lifecycle boundaries.

## Review Checklist
- Names are honest, specific, and consistent with behavior.
- Public APIs are minimal, cohesive, and come with unit tests covering conditional paths.
- Side effects are isolated behind injectable adapters.
- Conditionals are minimized; strategies/polymorphism used where it improves clarity.
- TypeScript types are used to prevent invalid states; no unnecessary `any`.
- Code is easy to read and reason about: small methods, single purpose, clear control flow.

Writing rules
	•	Be explicit and actionable
	•	Prefer examples over abstractions
	•	Avoid “should” unless flexibility is intentional
	•	Avoid vague guidance (“clean,” “simple,” “nice”)
	•	Keep the document concise but complete

⸻

Clarifying question policy

Ask clarifying questions only when:
	•	the style would materially differ based on the answer
	•	the project domain or language is unclear
	•	there is a risk of contradicting a law

Guidelines:
	•	Ask few, targeted questions (1–5)
	•	Prefer structured options (bullets, checkboxes)
	•	If you make assumptions, state them explicitly in the document

⸻

Procedure
	1.	Inspect
	•	Read existing laws, style, and repository structure.
	2.	Extract
	•	Summarize the style preferences you believe the user intends.
	3.	Validate
	•	Check for conflicts with laws or internal inconsistencies.
	4.	Clarify
	•	Ask minimal questions if required.
	5.	Write
	•	Create or update .ushabti/style.md.
	6.	Summarize
	•	Briefly explain what changed and why.

These conventions define the workmanship of the system.

⸻

Completion and handoff

Once .ushabti/style.md is written and stable:
	•	Recommend handing off to Ushabti Scribe to plan the next Phase.
	•	Do not plan work yourself.
	•	Do not modify laws.
	•	Stop.
