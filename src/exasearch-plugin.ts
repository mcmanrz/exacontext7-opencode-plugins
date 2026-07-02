import { tool, type Plugin } from "@opencode-ai/plugin"
import { KeyPool } from "./key-pool.js"
import {
  resolveKeys,
  requireResponseBody,
  writeResultFile,
  formatCost,
  DEFAULT_EXA_URL,
  type PluginOptions,
  type ExaCostDollars,
} from "./types.js"

type ExaApiResponse = {
  body: any
  cost?: ExaCostDollars
}

async function exaFetch(
  key: string,
  baseUrl: string,
  path: string,
  reqBody: Record<string, unknown>
): Promise<ExaApiResponse> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "User-Agent": "exa-opencode-plugin",
    },
    body: JSON.stringify(reqBody),
  })
  const json = await requireResponseBody(res, "Exa") as any
  return { body: json, cost: json.costDollars ?? undefined }
}

type ExaResult = {
  title: string | null
  url: string
  publishedDate?: string
  text?: string
  score?: number
  id: string
}

type ExaCitation = {
  title: string | null
  url: string
  publishedDate?: string
  author?: string
}

const SEARCH_DESCRIPTION = `Search the web using Exa AI-powered search. Returns relevant web pages with text content and URLs.

Search types (type parameter):
- "auto": Automatically selects the best search type for your query (default)
- "neural": Semantic/meaning-based search — best for conceptual queries
- "keyword": Traditional keyword matching — best for exact phrases or specific terms

Use this tool when you need to find current information, documentation, or web resources that may not be in your training data.`

const ANSWER_DESCRIPTION = `Generate an AI-powered answer to a question with cited web sources using Exa. The answer is based on real-time web search results with citations to source pages.

Use this tool when you need a synthesized answer backed by current web sources, such as facts, comparisons, or current events.`

const GET_CONTENTS_DESCRIPTION = `Retrieve clean, parsed text content from specific web pages by URL using Exa. This strips away navigation, ads, and formatting — returning only the main content.

Use this tool when you need to read the full text of a specific webpage, such as documentation pages, blog posts, or articles.`

const plugin: Plugin = async (_input, options) => {
  const opts = options as PluginOptions
  const pool = new KeyPool(resolveKeys(opts.apiKeys, "EXA_API_KEY"))
  const baseUrl = opts.baseUrl ?? DEFAULT_EXA_URL

  return {
    tool: {
      exa_search: tool({
        description: SEARCH_DESCRIPTION,
        args: {
          query: tool.schema
            .string()
            .describe("The search query — be specific and detailed for best results."),
          type: tool.schema
            .enum(["keyword", "neural", "auto"])
            .default("auto")
            .describe("Search type: 'auto', 'neural' (semantic), or 'keyword' (exact match)."),
          numResults: tool.schema
            .number()
            .default(10)
            .describe("Number of results to return (max 25)."),
          includeDomains: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("Only include results from these domains."),
          excludeDomains: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("Exclude results from these domains."),
        },
        async execute(args) {
          return pool.execute(async (key) => {
            const reqBody: Record<string, unknown> = {
              query: args.query,
              type: args.type,
              numResults: args.numResults,
              contents: { text: { maxCharacters: 2000 } },
            }
            if (args.includeDomains?.length) {
              reqBody.includeDomains = args.includeDomains
            }
            if (args.excludeDomains?.length) {
              reqBody.excludeDomains = args.excludeDomains
            }

            const { body, cost } = await exaFetch(key, baseUrl, "/search", reqBody)
            const data = body as {
              results?: ExaResult[]
              resolvedSearchType?: string
            }

            if (!data.results?.length) return { output: "No results found.", attachments: [] }

            const results = data.results
              .map(
                (r: ExaResult) =>
                  `## [${r.title ?? "Untitled"}](${r.url})\n` +
                  `${r.text ? r.text.trim() : "No text content available."}`
              )
              .join("\n\n---\n\n")

            const info = data.resolvedSearchType
              ? `Search type used: ${data.resolvedSearchType}\n\n`
              : ""

            const costLine = formatCost(cost)
            const costHeader = costLine ? `${costLine}\n\n---\n\n` : ""
            const content = `${costHeader}${info}${results}`

            const { filePath, attachment } = await writeResultFile(
              "exa-search",
              content
            )
            return {
              output: costLine
                ? `Search results written to \`${filePath}\` (${costLine})`
                : `Search results written to \`${filePath}\``,
              attachments: [attachment],
            }
          })
        },
      }),

      exa_answer: tool({
        description: ANSWER_DESCRIPTION,
        args: {
          query: tool.schema
            .string()
            .describe("The question to answer — be clear and specific."),
        },
        async execute(args) {
          return pool.execute(async (key) => {
            const { body, cost } = await exaFetch(key, baseUrl, "/answer", {
              query: args.query,
              text: true,
            })
            const data = body as {
              answer?: string | Record<string, unknown>
              citations?: ExaCitation[]
            }

            const answer =
              typeof data.answer === "string"
                ? data.answer
                : data.answer
                  ? JSON.stringify(data.answer, null, 2)
                  : "No answer generated."

            const citations = (data.citations ?? [])
              .map((c: ExaCitation) => `- [${c.title ?? c.url}](${c.url})`)
              .join("\n")

            const sources = citations ? `\n\n**Sources:**\n${citations}` : ""

            const costLine = formatCost(cost)
            const costHeader = costLine ? `${costLine}\n\n---\n\n` : ""
            const content = `${costHeader}${answer}${sources}`

            const { filePath, attachment } = await writeResultFile(
              "exa-answer",
              content
            )
            return {
              output: costLine
                ? `Answer written to \`${filePath}\` (${costLine})`
                : `Answer written to \`${filePath}\``,
              attachments: [attachment],
            }
          })
        },
      }),

      exa_get_contents: tool({
        description: GET_CONTENTS_DESCRIPTION,
        args: {
          urls: tool.schema
            .array(tool.schema.string())
            .describe("Array of page URLs to retrieve content from."),
          maxCharacters: tool.schema
            .number()
            .default(5000)
            .describe("Maximum characters of text to return per page."),
        },
        async execute(args) {
          return pool.execute(async (key) => {
            const { body, cost } = await exaFetch(key, baseUrl, "/contents", {
              urls: args.urls,
              contents: { text: { maxCharacters: args.maxCharacters } },
            })
            const data = body as {
              results?: ExaResult[]
            }

            if (!data.results?.length) {
              return { output: "No content retrieved for the given URLs.", attachments: [] }
            }

            const results = data.results
              .map(
                (r: ExaResult) =>
                  `## [${r.title ?? r.url}](${r.url})\n\n${r.text?.trim() ?? "No text content available."}`
              )
              .join("\n\n---\n\n")

            const costLine = formatCost(cost)
            const costHeader = costLine ? `${costLine}\n\n---\n\n` : ""
            const content = `${costHeader}${results}`

            const { filePath, attachment } = await writeResultFile(
              "exa-contents",
              content
            )
            return {
              output: costLine
                ? `Page contents written to \`${filePath}\` (${costLine})`
                : `Page contents written to \`${filePath}\``,
              attachments: [attachment],
            }
          })
        },
      }),
    },
  }
}

export default { id: "exasearch-plugin", server: plugin }
