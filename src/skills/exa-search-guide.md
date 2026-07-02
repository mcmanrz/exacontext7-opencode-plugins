---
name: exasearch
description: Use ExaSearch tools (exa_search, exa_answer, exa_get_contents) for real-time web search, AI-powered answers with citations, and page content retrieval.
---

# ExaSearch

The `exasearch-plugin` provides three tools backed by [Exa](https://exa.ai), a web search API built for AI. Results are written to files under `/tmp/exacontext7/` and returned as file attachments.

## Tools

### `exa_search`
Search the web with AI-powered ranking.

- **`type`**: `"auto"` (default — auto-selects best strategy), `"neural"` (semantic/conceptual), or `"keyword"` (exact phrase matching)
- **`numResults`**: 1-25, default 10
- **`includeDomains`** / **`excludeDomains`**: Optional domain filters
- Cost is tracked and reported per call

**Use when**: You need current information, recent documentation, or web resources outside your training data.

### `exa_answer`
Generate a synthesized answer backed by real-time web sources with citations.

- **`query`**: A clear, specific question
- Returns: An answer string + cited source URLs
- Cost is tracked and reported per call

**Use when**: You need a factual answer with cited sources, such as comparisons, current events, or fact-checking.

### `exa_get_contents`
Retrieve clean, parsed text from specific web pages — strips navigation, ads, and formatting.

- **`urls`**: Array of page URLs
- **`maxCharacters`**: Per-page text limit, default 5000
- Cost is tracked and reported per call

**Use when**: You need to read the full content of a specific page (docs, blog posts, articles).

## Best Practices

- Be **specific and detailed** in queries — Exa's AI ranking rewards precision
- Prefer `exa_answer` for questions needing synthesis with sources
- Use `exa_get_contents` when you already know which pages to read
- Use `exa_search` for discovery when you don't know which pages are relevant
- Check cost lines in results to track spending
- Results are written to temp files — read them for full content
