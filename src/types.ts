import { mkdir, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import path from "node:path"

const TMP_DIR = "/tmp/exacontext7"

export type ToolAttachment = {
  type: "file"
  mime: string
  url: string
  filename?: string
}

export type ExaCostDollars = {
  total: number
  search?: { neural?: number; keyword?: number }
  contents?: { text?: number; highlights?: number; summary?: number }
}

export type PluginOptions = {
  apiKeys?: string[]
  baseUrl?: string
  /** Estimated cost per request in USD (Context7 only — no real cost in API responses) */
  estimatedCostPerRequest?: number
}

export function formatCost(cost?: ExaCostDollars): string {
  if (!cost || cost.total === undefined) return ""
  const parts = [`Cost: $${cost.total.toFixed(6)}`]
  if (cost.search) {
    const items = Object.entries(cost.search)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: $${v!.toFixed(6)}`)
    if (items.length) parts.push(`[search: ${items.join(", ")}]`)
  }
  if (cost.contents) {
    const items = Object.entries(cost.contents)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: $${v!.toFixed(6)}`)
    if (items.length) parts.push(`[contents: ${items.join(", ")}]`)
  }
  return parts.join(" ")
}

export function estimatedCostLine(perRequestUsd?: number): string {
  if (!perRequestUsd) return ""
  return `Estimated cost: $${perRequestUsd.toFixed(6)} per request`
}

export async function writeResultFile(
  prefix: string,
  content: string,
  ext: string = "md"
): Promise<{ filePath: string; attachment: ToolAttachment }> {
  await mkdir(TMP_DIR, { recursive: true })
  const id = randomUUID()
  const filename = `${prefix}-${id}.${ext}`
  const filePath = path.join(TMP_DIR, filename)
  await writeFile(filePath, content, "utf-8")
  return {
    filePath,
    attachment: {
      type: "file",
      mime: ext === "md" ? "text/markdown" : "text/plain",
      url: `file://${filePath}`,
      filename,
    },
  }
}

export const DEFAULT_CONTEXT7_URL = "https://context7.com/api"
export const DEFAULT_EXA_URL = "https://api.exa.ai"

function resolveEnvVar(value: string): string {
  const match = value.match(/^\$(\w+)$/)
  if (match) {
    const envValue = process.env[match[1]]
    if (!envValue) {
      throw new Error(`Environment variable ${match[1]} is not set`)
    }
    return envValue
  }
  return value
}

export function resolveKeys(configured?: string[], fallbackEnv?: string): string[] {
  if (configured?.length) {
    return configured.map(resolveEnvVar)
  }
  if (fallbackEnv) {
    const envValue = process.env[fallbackEnv]
    if (envValue) return [envValue]
  }
  throw new Error(
    `No API keys configured. Pass apiKeys in plugin options or set ${fallbackEnv}.`
  )
}

export function parseResponseBody(res: Response): Promise<unknown> {
  return res.json()
}

export async function requireResponseBody(
  res: Response,
  serviceName: string
): Promise<unknown> {
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `${serviceName} API ${res.status}: ${text.slice(0, 500)}`
    )
  }
  return res.json()
}
