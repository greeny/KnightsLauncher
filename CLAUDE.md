# Knight's Launcher — Project Guide

## Project Overview
A desktop launcher for the Knights and Merchants REMAKE fan project, built with
Tauri 2 (Rust backend) and TypeScript/Angular (frontend). Handles downloading and
installing game versions, launching the game, and managing maps/campaigns.

## Tech Stack
- **Frontend:** TypeScript, Angular (not yet added), Vite
- **Backend:** Tauri 2 (Rust) — keep Rust code minimal; use built-in Tauri plugins
- **Build/CI:** GitHub Actions (Linux + Windows matrix), Docker for local Linux builds

---

## Coding Style

### General
- **Indentation:** Tabs everywhere. No spaces for indentation, ever.
- **No vertical alignment:** Never use extra spaces to align things in columns.
  If something spans multiple lines, put each item on its own line aligned by
  the natural tab indent — not by spaces matching a symbol above.
  This applies everywhere: code, inline comments, and block comments alike.
  Use a single space after `//` or `*` and write the comment immediately after.
- **Line endings:** LF (Unix).

### TypeScript / Angular — PSR style adapted

Naming:
- Classes, interfaces, types, enums: `PascalCase`
- Methods, functions, variables, parameters: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Private members: prefix with `_` only when needed to disambiguate from a
  constructor parameter of the same name, otherwise just use `private`

Braces:
- Class and method opening braces go on the **next line** (Allman style)
- Control structure opening braces (`if`, `for`, `while`, `try`, etc.) go on
  the **same line** (K&R style), with one space before the brace

```typescript
// Correct
class MyClass
{
	public myMethod(): void
	{
		if (condition) {
			doSomething();
		}
	}
}
```

Visibility:
- Always declare visibility on every class member (`public`, `private`,
  `protected`) — no implicit public

Spacing:
- One space after control-structure keywords: `if (`, `for (`, `while (`
- No space between a function/method name and its argument list: `myMethod(`
- No spaces inside curly-brace groups: `import {foo, bar}` not `import { foo, bar }`
- One blank line between methods
- No trailing whitespace

Angular templates:
- No spaces inside interpolation braces: `{{var}}` not `{{ var }}`
- Pipes are the exception — one space either side of the pipe: `{{var | filter}}`

OOP:
- Prefer classes over standalone functions wherever reasonable
- Use Angular services/components/pipes as the unit of organisation
- Avoid functional-style patterns (`.map()/.reduce()` chains etc.) when a
  simple loop in a method is clearer

File naming (Angular):
- File name must match the class name exactly, including capitalisation
  - `VersionService` → `VersionService.ts` + `VersionService.html` (if templated)
  - `AppComponent` → `AppComponent.ts` + `AppComponent.html` + `AppComponent.css`
- No kebab-case file names (Angular CLI default) — use PascalCase

### Rust
- Follow standard Rust naming: `snake_case` functions/methods/variables,
  `PascalCase` structs/enums/traits, `SCREAMING_SNAKE_CASE` constants
- Tabs for indentation (enforced via `rustfmt.toml`)
- Opening braces next-line (enforced via `brace_style = "AlwaysNextLine"` in `rustfmt.toml`)
- Keep `src-tauri/src/lib.rs` as the plugin registration entry point; add
  `#[tauri::command]` functions in separate modules under `src-tauri/src/`
- Avoid large Rust additions — prefer Tauri's built-in plugins; only add custom
  commands when no plugin covers the need
