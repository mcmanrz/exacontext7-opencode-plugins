import { tool, type Plugin } from "@opencode-ai/plugin"
import { KeyPool } from "./key-pool.js"
import {
  resolveKeys,
  requireResponseBody,
  writeResultFile,
  estimatedCostLine,
  DEFAULT_CONTEXT7_URL,
  type PluginOptions,
} from "./types.js"

function formatLibraryResults(
  results: Array<{
    id: string
    name: string
    description: string
    totalSnippets: number
    benchmarkScore: number
    versions?: string[]
  }>
): string {
  if (!results.length) return "No libraries found matching the provided name."

  return results
    .map((r) => {
      const versions = r.versions?.length
        ? `\n  Versions: ${r.versions.slice(0, 3).join(", ")}${
            r.versions.length > 3 ? "..." : ""
          }`
        : ""
      return `- **${r.name}** (ID: \`${r.id}\`)\n  ${r.description}\n  Documentation snippets: ${r.totalSnippets}, Benchmark score: ${r.benchmarkScore}${versions}`
    })
    .join("\n\n")
}

const RESOLVE_DESCRIPTION = `Search Context7 for a library to get its documentation ID.

You MUST call this before 'context7_query_docs' to obtain a valid Context7-compatible library ID UNLESS the user explicitly provides a library ID in the format '/org/project' or '/org/project/version'.

Each result includes:
- Library ID: Context7-compatible identifier (format: /org/project)
- Name: Library or package name
- Description: Short summary
- Documentation snippets: Number of available code examples
- Benchmark score: Quality indicator (100 is the highest score)
- Versions: List of versions if available

For best results, select libraries based on name match, description relevance, and benchmark score.`

const QUERY_DESCRIPTION = `Retrieve up-to-date documentation and code examples from Context7 for any programming library or framework.

You must call 'context7_resolve_library' first to obtain the exact Context7-compatible library ID required to use this tool, UNLESS the user explicitly provides a library ID in the format '/org/project' or '/org/project/version'.`

const plugin: Plugin = async (_input, options) => {
  const opts = options as PluginOptions
  const pool = new KeyPool(resolveKeys(opts.apiKeys, "CONTEXT7_API_KEY"))
  const baseUrl = opts.baseUrl ?? DEFAULT_CONTEXT7_URL
  const costHeader = estimatedCostLine(opts.estimatedCostPerRequest)

  return {
    tool: {
      context7_resolve_library: tool({
        description: RESOLVE_DESCRIPTION,
        args: {
          query: tool.schema
            .string()
            .describe(
              "The question or task you need help with. This ranks library results by relevance to what you are trying to accomplish."
            ),
          libraryName: tool.schema
            .string()
            .describe(
              "Library name to search for. Use the official library name with proper punctuation — e.g., 'Next.js' instead of 'nextjs', 'Three.js' instead of 'threejs'."
            ),
        },
        async execute(args) {
          return pool.execute(async (key) => {
            const url =
              `${baseUrl}/v2/libs/search?query=${encodeURIComponent(args.query)}` +
              `&libraryName=${encodeURIComponent(args.libraryName)}`

            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${key}` },
            })

            const data = (await requireResponseBody(res, "Context7")) as {
              results?: Array<{
                id: string
                name: string
                description: string
                totalSnippets: number
                benchmarkScore: number
                versions?: string[]
              }>
              error?: string
            }

            if (data.error) throw new Error(`Context7 API error: ${data.error}`)

            const header = costHeader ? `${costHeader}\n\n---\n\n` : ""
            const content = `${header}Available Libraries:\n\n${formatLibraryResults(data.results ?? [])}`
            const { filePath, attachment } = await writeResultFile(
              "context7-resolve",
              content
            )
            return {
              output: `Results written to \`${filePath}\``,
              attachments: [attachment],
            }
          })
        },
      }),

      context7_query_docs: tool({
        description: QUERY_DESCRIPTION,
        args: {
          query: tool.schema
            .string()
            .describe(
              "Specific question or task. Be detailed — good: 'How to set up authentication with JWT in Express.js'; bad: 'auth'."
            ),
          libraryId: tool.schema
            .string()
            .describe(
              "Exact Context7-compatible library ID (e.g., '/mongodb/docs', '/vercel/next.js', '/supabase/supabase') obtained from context7_resolve_library."
            ),
        },
        async execute(args) {
          return pool.execute(async (key) => {
            const url =
              `${baseUrl}/v2/context?query=${encodeURIComponent(args.query)}` +
              `&libraryId=${encodeURIComponent(args.libraryId)}`

            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${key}` },
            })

            const data = (await requireResponseBody(res, "Context7")) as {
              data?: string
              error?: string
            }

            if (data.error) throw new Error(`Context7 API error: ${data.error}`)
            if (!data.data) {
              return {
                output: "No documentation found for the given query.",
                attachments: [],
              }
            }

            const header = costHeader ? `${costHeader}\n\n---\n\n` : ""
            const content = `${header}${data.data}`
            const { filePath, attachment } = await writeResultFile(
              "context7-docs",
              content
            )
            return {
              output: `Documentation written to \`${filePath}\``,
              attachments: [attachment],
            }
          })
        },
      }),
    },
  }
}

export default { id: "context7-plugin", server: plugin }
