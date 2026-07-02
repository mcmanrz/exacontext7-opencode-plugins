import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir, platform } from "node:os"
import { modify, applyEdits, parseTree, findNodeAtLocation } from "jsonc-parser"

const PLUGIN_NAME = "exacontext7-opencode-plugins"
const FORMAT_OPTS = { tabSize: 2, insertSpaces: true, eol: "\n" } as const

function configDir(): string {
  if (process.env.OPENCODE_CONFIG_DIR) return process.env.OPENCODE_CONFIG_DIR
  const home = process.env.OPENCODE_TEST_HOME ?? homedir()
  if (platform() === "win32") {
    return join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "opencode")
  }
  if (platform() === "darwin") {
    return join(home, "Library", "Application Support", "opencode")
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(home, ".config"), "opencode")
}

function findConfigFile(): string {
  const dir = configDir()
  for (const name of ["opencode.jsonc", "opencode.json"]) {
    const p = join(dir, name)
    if (existsSync(p)) return p
  }
  return join(dir, "opencode.jsonc")
}

function findPluginIndex(text: string): number {
  const tree = parseTree(text)
  if (!tree) return -1
  const plugins = findNodeAtLocation(tree, ["plugin"])
  if (!plugins?.children) return -1
  return plugins.children.findIndex((child) => {
    if (child.type === "string" && child.value === PLUGIN_NAME) return true
    const pkg = findNodeAtLocation(child, ["package"])
    if (pkg && pkg.type === "string" && pkg.value === PLUGIN_NAME) return true
    return false
  })
}

function arrayLength(text: string): number {
  const tree = parseTree(text)
  if (!tree) return 0
  const plugins = findNodeAtLocation(tree, ["plugin"])
  if (!plugins?.children || plugins.type !== "array") return 0
  return plugins.children.filter((c) => c.type !== "string" || c.value !== undefined).length
}

function parseKeysFlag(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined
  return raw.split(",").map((s) => s.trim()).filter(Boolean)
}

function buildPluginValue(
  exaKeys: string[] | undefined,
  context7Keys: string[] | undefined,
): string | Record<string, unknown> {
  if (!exaKeys?.length && !context7Keys?.length) return PLUGIN_NAME
  const options: Record<string, Record<string, unknown>> = {}
  if (exaKeys?.length) options.exa = { apiKeys: exaKeys }
  if (context7Keys?.length) options.context7 = { apiKeys: context7Keys }
  return { package: PLUGIN_NAME, options }
}

function warnMissingKeys(exa: string[] | undefined, ctx7: string[] | undefined): void {
  const missing: string[] = []
  if (!exa?.length && !process.env.EXA_API_KEY) {
    missing.push("EXA_API_KEY (ExaSearch)")
  }
  if (!ctx7?.length && !process.env.CONTEXT7_API_KEY) {
    missing.push("CONTEXT7_API_KEY (Context7)")
  }
  if (missing.length > 0) {
    console.warn(
      `WARNING: No API keys configured for: ${missing.join(", ")}.\n` +
      `  Set env vars or use --exa-keys / --context7-keys flags.\n` +
      `  The plugin will fail at runtime until keys are provided.`,
    )
  }
}

function install(exaKeys: string[] | undefined, context7Keys: string[] | undefined, dryRun: boolean): void {
  const cf = findConfigFile()
  const exists = existsSync(cf)

  if (!exists) {
    if (dryRun) {
      console.log(`[DRY RUN] Would create: ${cf}`)
      return
    }
    const dir = configDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const value = buildPluginValue(exaKeys, context7Keys)
    const pluginEntry = typeof value === "string"
      ? `"${value}"`
      : JSON.stringify(value, null, 2).replace(/\n/g, "\n  ")
    writeFileSync(cf, `{\n  "plugin": [${pluginEntry}]\n}\n`, "utf-8")
    console.log(`Created ${cf}`)
    warnMissingKeys(exaKeys, context7Keys)
    return
  }

  const text = readFileSync(cf, "utf-8")

  if (findPluginIndex(text) !== -1) {
    console.log(`Plugin "${PLUGIN_NAME}" is already in ${cf}`)
    return
  }

  const value = buildPluginValue(exaKeys, context7Keys)
  const len = arrayLength(text)
  const edits = modify(text, ["plugin", len], value, {
    formattingOptions: FORMAT_OPTS,
    isArrayInsertion: true,
  })

  if (dryRun) {
    const desc = typeof value === "string" ? `"${value}"` : "object with options"
    console.log(`[DRY RUN] Would add ${desc} to plugin in ${cf}`)
    return
  }

  writeFileSync(cf, applyEdits(text, edits), "utf-8")
  console.log(`Added "${PLUGIN_NAME}" to ${cf}`)
  warnMissingKeys(exaKeys, context7Keys)
}

function uninstall(dryRun: boolean): void {
  const cf = findConfigFile()
  if (!existsSync(cf)) {
    console.log(`Config not found: ${cf}`)
    process.exit(1)
  }

  const text = readFileSync(cf, "utf-8")
  const idx = findPluginIndex(text)

  if (idx === -1) {
    console.log(`Plugin "${PLUGIN_NAME}" not found in ${cf}`)
    process.exit(1)
  }

  const edits = modify(text, ["plugin", idx], undefined, {
    formattingOptions: FORMAT_OPTS,
  })

  if (dryRun) {
    console.log(`[DRY RUN] Would remove "${PLUGIN_NAME}" from ${cf}`)
    return
  }

  writeFileSync(cf, applyEdits(text, edits), "utf-8")
  console.log(`Removed "${PLUGIN_NAME}" from ${cf}`)
}

function help(): void {
  console.log(`ExaContext7 Plugin Installer`)
  console.log(``)
  console.log(`  Install or remove exacontext7-opencode-plugins from your global`)
  console.log(`  opencode configuration (~/.config/opencode/opencode.jsonc).`)
  console.log(``)
  console.log(`Usage:`)
  console.log(`  node install.js [command] [options]`)
  console.log(``)
  console.log(`Commands:`)
  console.log(`  --install, -i        Add plugin to global config (default)`)
  console.log(`  --uninstall, -u      Remove plugin from global config`)
  console.log(``)
  console.log(`Key configuration (applied with --install):`)
  console.log(`  --exa-keys <keys>    Comma-separated ExaSearch API keys`)
  console.log(`                       Supports round-robin rotation via KeyPool`)
  console.log(`  --context7-keys <k>  Comma-separated Context7 API keys`)
  console.log(`                       Supports round-robin rotation via KeyPool`)
  console.log(`  If omitted, falls back to EXA_API_KEY / CONTEXT7_API_KEY env vars`)
  console.log(``)
  console.log(`Options:`)
  console.log(`  --dry-run            Preview without writing changes`)
  console.log(`  --help, -h           Show this help`)
  console.log(``)
  console.log(`Examples:`)
  console.log(`  node install.js --exa-keys "key1,key2" --context7-keys "key3"`)
  console.log(`  node install.js --uninstall`)
  console.log(`  node install.js --dry-run`)
}

const args = process.argv.slice(2)

if (args.includes("--help") || args.includes("-h")) {
  help()
  process.exit(0)
}

const dryRun = args.includes("--dry-run")
const uninstallMode = args.includes("--uninstall") || args.includes("-u")

function getFlagValue(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  if (idx === -1 || idx + 1 >= args.length) return undefined
  const val = args[idx + 1]
  if (val.startsWith("--")) return undefined
  return val
}

const exaKeys = parseKeysFlag(getFlagValue("--exa-keys"))
const context7Keys = parseKeysFlag(getFlagValue("--context7-keys"))

if (uninstallMode) {
  uninstall(dryRun)
} else {
  install(exaKeys, context7Keys, dryRun)
}
