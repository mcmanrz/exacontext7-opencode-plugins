export class KeyPool {
  readonly keys: string[]
  private index = 0

  constructor(keys: string[]) {
    if (!keys.length) {
      throw new Error("KeyPool requires at least one API key")
    }
    this.keys = keys
  }

  private next(): string {
    const key = this.keys[this.index]
    this.index = (this.index + 1) % this.keys.length
    return key
  }

  async execute<T>(fn: (key: string) => Promise<T>): Promise<T> {
    const startIndex = this.index
    let exhausted = false
    let lastError: Error | null = null

    while (!exhausted) {
      const key = this.next()
      try {
        return await fn(key)
      } catch (err) {
        lastError = err as Error
        if (!KeyPool.isRetryable(err)) throw err
        exhausted = this.index === startIndex
      }
    }

    throw new Error(
      `All ${this.keys.length} API keys exhausted. Last error: ${lastError?.message}`
    )
  }

  static isRetryable(err: unknown): boolean {
    if (err instanceof Error) {
      const msg = err.message.toLowerCase()
      if (
        msg.includes("429") ||
        msg.includes("rate limit") ||
        msg.includes("too many requests") ||
        msg.includes("401") ||
        msg.includes("unauthorized") ||
        msg.includes("403")
      ) {
        return true
      }
    }
    return false
  }

  get size(): number {
    return this.keys.length
  }
}
