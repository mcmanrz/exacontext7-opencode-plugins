import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { define } from "@opencode-ai/plugin/v2/promise"
import type { PluginContext } from "@opencode-ai/plugin/v2/promise"

const __dirname = dirname(fileURLToPath(import.meta.url))
const skillsDir = resolve(__dirname, "skills")

const exaGuide = readFileSync(resolve(skillsDir, "exa-search-guide.md"), "utf-8")
const ctx7Guide = readFileSync(resolve(skillsDir, "context7-guide.md"), "utf-8")

export default define({
  id: "exacontext7",
  async setup(ctx: PluginContext) {
    await ctx.skill.transform((draft) => {
      draft.source({
        type: "embedded",
        skill: {
          name: "exasearch",
          description:
            "Use ExaSearch tools (exa_search, exa_answer, exa_get_contents) for real-time web search, AI-powered answers with citations, and page content retrieval.",
          location: "/plugins/exacontext7/exasearch.md",
          content: exaGuide,
        },
      })
      draft.source({
        type: "embedded",
        skill: {
          name: "context7",
          description:
            "Use Context7 tools (context7_resolve_library, context7_query_docs) to look up live, up-to-date documentation and code examples for any programming library or framework.",
          location: "/plugins/exacontext7/context7.md",
          content: ctx7Guide,
        },
      })
    })
  },
})
