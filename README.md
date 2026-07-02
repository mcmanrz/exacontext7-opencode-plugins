# exacontext7-opencode-plugins

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-green)](package.json)

opencode plugins for **ExaSearch** (AI-powered web search) and **Context7** (live library documentation) with per-service round-robin multi-key support.

- **5 tools** — `exa_search`, `exa_answer`, `exa_get_contents`, `context7_resolve_library`, `context7_query_docs`
- **2 auto-loaded skills** — the LLM automatically receives usage guidance, no manual `.opencode/skills/` setup
- **Per-service key scoping** — ExaSearch and Context7 keys never cross-contaminate
- **Round-robin KeyPool** — distribute requests across multiple API keys with automatic 429/401/403 retry

---

## Quick Start

```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/mcmanrz/exacontext7-opencode-plugins/main/install.sh | bash

# Windows PowerShell
iwr https://raw.githubusercontent.com/mcmanrz/exacontext7-opencode-plugins/main/install.ps1 | iex
```

That's it. The installer adds the plugin to your global `~/.config/opencode/opencode.jsonc`. Restart opencode and the tools are available.

To configure multiple API keys for round-robin rotation:

```bash
curl -fsSL .../install.sh | bash -s -- \
  --exa-keys "exa-key-1,exa-key-2" \
  --context7-keys "ctx7-key-1,ctx7-key-2,ctx7-key-3"
```

---

## Tools

### ExaSearch — Web Search

| Tool | Description |
|---|---|
| `exa_search` | AI-powered web search. `type`: `auto`, `neural` (semantic), or `keyword` (exact). Returns text content with URLs. |
| `exa_answer` | Synthesized answer with cited web sources. Provide a clear question, get an answer backed by real-time results. |
| `exa_get_contents` | Retrieve clean, parsed text from specific URLs. Strips navigation, ads, and formatting. |

### Context7 — Live Documentation

| Tool | Description |
|---|---|
| `context7_resolve_library` | Search Context7's library index to find the correct `/org/project` library ID. Required before querying docs. |
| `context7_query_docs` | Retrieve documentation and code examples for a library. Requires a library ID from the resolve step. |

---

## Installation

### Option A: One-Liner Installer (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/mcmanrz/exacontext7-opencode-plugins/main/install.sh | bash
```

The installer:
1. Installs the package globally via npm
2. Adds the plugin to your global `opencode.jsonc` (comment-safe via `jsonc-parser`)
3. Warns if API keys are missing

**Flags**: `--exa-keys key1,key2` `--context7-keys key3` `--dry-run` `--uninstall`

### Option B: Manual (npm + CLI)

```bash
npm install -g exacontext7-opencode-plugins
npx exacontext7-install --exa-keys "key1,key2" --context7-keys "key3"
```

### Option C: Edit Config Directly

Add to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "plugins": [
    {
      "package": "exacontext7-opencode-plugins",
      "options": {
        "exa": { "apiKeys": ["exa-key-1", "exa-key-2"] },
        "context7": { "apiKeys": ["ctx7-key-1"] }
      }
    }
  ]
}
```

### Uninstall

```bash
npx exacontext7-install --uninstall   # removes from config
npm uninstall -g exacontext7-opencode-plugins
```

---

## Configuration

| Path | Service | Description | Fallback |
|---|---|---|---|
| `options.exa.apiKeys` | ExaSearch | API keys (round-robin) | `EXA_API_KEY` env var |
| `options.exa.baseUrl` | ExaSearch | Override API base URL | `https://api.exa.ai` |
| `options.context7.apiKeys` | Context7 | API keys (round-robin) | `CONTEXT7_API_KEY` env var |
| `options.context7.baseUrl` | Context7 | Override API base URL | `https://context7.com/api` |
| `options.context7.estimatedCostPerRequest` | Context7 | Estimated cost in USD per request | — |

Keys support `$ENV_VAR` syntax:

```jsonc
"apiKeys": ["$EXA_KEY_1", "$EXA_KEY_2"]
```

---

## Multi-Key Round-Robin

Each service uses a `KeyPool` that rotates through its configured API keys:

```
Request 1 → key[0]
Request 2 → key[1]
Request 3 → key[2]
Request 4 → key[0]  (wraps around)
```

On 429 (rate limit), 401 (unauthorized), or 403 (forbidden) errors, the pool automatically retries with the next key. If all keys are exhausted, an error is thrown.

ExaSearch and Context7 pools are **completely independent** — Exa keys are never tried against Context7 and vice versa.

---

## Skill Auto-Loading

The V2 plugin entry point (`dist/v2-plugin.js`) registers two skills at integration time via `ctx.skill.transform()`:

- **`exasearch`** — Teaches the LLM when to use `exa_search` vs `exa_answer` vs `exa_get_contents`, best practices for query phrasing, and cost awareness
- **`context7`** — Teaches the LLM the two-step resolve-then-query workflow, library ID format, and benchmark score interpretation

Skills are loaded automatically — **no manual `.opencode/skills/` setup required**. The LLM sees them as available skills and can load them via the `skill` tool.

---

## Architecture

```
exacontext7-opencode-plugins
├── dist/
│   ├── v2-plugin.js              # V2 entry — skill registration
│   ├── exasearch-plugin.js       # V1 MCP — exa_search, exa_answer, exa_get_contents
│   ├── context7-plugin.js        # V1 MCP — context7_resolve_library, context7_query_docs
│   ├── install.js                # CLI installer (jsonc-parser, comment-safe)
│   └── skills/
│       ├── exa-search-guide.md   # SKILL.md for ExaSearch
│       └── context7-guide.md     # SKILL.md for Context7
├── src/                          # TypeScript source
├── install.sh                    # Linux/macOS entry point
├── install.ps1                   # Windows PowerShell entry point
├── scripts/
│   ├── build-exe.sh              # Bun compile → standalone .exe
│   └── build-exe.ps1
└── test/                         # 32 unit tests
```

---

## Building From Source

```bash
git clone https://github.com/mcmanrz/exacontext7-opencode-plugins.git
cd exacontext7-opencode-plugins
npm install
npm run build       # tsc + copies skill .md files to dist/
npm test            # 32 unit tests
npm run typecheck   # TypeScript --noEmit
```

To build a standalone Windows `.exe` installer:

```bash
bun build --compile --target=bun-windows-x64 src/install.ts --outfile dist/install.exe
```

Requires [Bun](https://bun.sh) installed on the build machine.

---

## License

[MIT](LICENSE)
