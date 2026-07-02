---
name: context7
description: Use Context7 tools (context7_resolve_library, context7_query_docs) to look up live, up-to-date documentation and code examples for any programming library or framework.
---

# Context7

The `context7-plugin` provides two tools backed by [Context7](https://context7.com) for retrieving live library documentation. Results are written to files under `/tmp/exacontext7/` and returned as file attachments.

## Two-Step Workflow

You MUST follow this two-step flow unless the user explicitly provides a library ID in `/org/project` or `/org/project/version` format.

### Step 1: `context7_resolve_library`
Search Context7's library index to find the correct library ID.

- **`query`**: The task you need help with — this ranks results by relevance to your goal
- **`libraryName`**: Official library name with proper punctuation (e.g., `"Next.js"` not `"nextjs"`, `"Three.js"` not `"threejs"`)
- Returns: A list of matching libraries with IDs, descriptions, benchmark scores, and available snippet counts

**Select the best match** based on name match, description relevance, and benchmark score (100 = highest quality).

### Step 2: `context7_query_docs`
Retrieve documentation and code examples for a specific library.

- **`query`**: Specific question or task — be detailed (e.g., `"How to set up authentication with JWT in Express.js"`)
- **`libraryId`**: Exact Context7-compatible ID from step 1 (e.g., `"/mongodb/docs"`, `"/vercel/next.js"`)

## Library ID Format

Library IDs use the format `/org/project` or `/org/project/version`. Examples:
- `/mongodb/docs`
- `/vercel/next.js`
- `/supabase/supabase`
- `/expressjs/express`

## Best Practices

- Always call `context7_resolve_library` first to get the library ID
- Use official library names with correct casing and punctuation
- Be specific in your documentation query — detailed questions yield better results
- Prefer libraries with higher benchmark scores for better quality docs
- If results include versions, note which version the documentation targets
