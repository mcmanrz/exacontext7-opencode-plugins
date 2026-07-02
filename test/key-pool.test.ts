import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { KeyPool } from "../src/key-pool"

describe("KeyPool", () => {
  it("throws when no keys provided", () => {
    assert.throws(
      () => new KeyPool([]),
      { message: /requires at least one API key/ }
    )
  })

  it("execute() succeeds on first key", async () => {
    const pool = new KeyPool(["key1"])
    const result = await pool.execute(async (k) => `used:${k}`)
    assert.equal(result, "used:key1")
  })

  it("execute() returns result from the correct key", async () => {
    const pool = new KeyPool(["k-a", "k-b"])
    const result = await pool.execute(async (k) => {
      if (k === "k-a") return "from-k-a"
      return "from-k-b"
    })
    assert.equal(result, "from-k-a")
  })

  it("execute() retries on next key after retryable error", async () => {
    const pool = new KeyPool(["bad", "good"])
    const callOrder: string[] = []

    const result = await pool.execute(async (k) => {
      callOrder.push(k)
      if (k === "bad") throw new Error("429 Too Many Requests")
      return `result:${k}`
    })

    assert.deepEqual(callOrder, ["bad", "good"])
    assert.equal(result, "result:good")
  })

  it("execute() retries multiple times until success", async () => {
    const pool = new KeyPool(["bad1", "bad2", "good"])
    const callOrder: string[] = []

    const result = await pool.execute(async (k) => {
      callOrder.push(k)
      if (k.startsWith("bad")) throw new Error("429 rate limit")
      return `result:${k}`
    })

    assert.deepEqual(callOrder, ["bad1", "bad2", "good"])
    assert.equal(result, "result:good")
  })

  it("execute() throws after exhausting all keys", async () => {
    const pool = new KeyPool(["k1", "k2"])

    await assert.rejects(
      pool.execute(async (k) => {
        throw new Error(`429 rate limit on ${k}`)
      }),
      { message: /All 2 API keys exhausted/ }
    )
  })

  it("exhaustion error includes last error message", async () => {
    const pool = new KeyPool(["a"])

    await assert.rejects(
      pool.execute(async () => {
        throw new Error("429 Too Many Requests")
      }),
      { message: /429 Too Many Requests/ }
    )
  })

  it("execute() throws immediately on non-retryable error", async () => {
    const pool = new KeyPool(["a", "b"])
    let callCount = 0

    await assert.rejects(
      pool.execute(async (k) => {
        callCount++
        throw new Error(`400 Bad Request with ${k}`)
      }),
      { message: /400 Bad Request with a/ }
    )
    assert.equal(callCount, 1)
  })

  it("isRetryable detects 429 status", () => {
    assert.equal(KeyPool.isRetryable(new Error("429 Too Many Requests")), true)
  })

  it("isRetryable detects rate limit phrasing", () => {
    assert.equal(KeyPool.isRetryable(new Error("Rate limit exceeded. Try again later.")), true)
    assert.equal(KeyPool.isRetryable(new Error("too many requests, please slow down")), true)
  })

  it("isRetryable detects 401 unauthorized", () => {
    assert.equal(KeyPool.isRetryable(new Error("401 Unauthorized: invalid API key")), true)
    assert.equal(KeyPool.isRetryable(new Error("Unauthorized")), true)
  })

  it("isRetryable detects 403 forbidden", () => {
    assert.equal(KeyPool.isRetryable(new Error("403 Forbidden")), true)
  })

  it("isRetryable returns false for non-retryable errors", () => {
    assert.equal(KeyPool.isRetryable(new Error("400 Bad Request")), false)
    assert.equal(KeyPool.isRetryable(new Error("500 Internal Server Error")), false)
    assert.equal(KeyPool.isRetryable(new Error("Network error")), false)
    assert.equal(KeyPool.isRetryable(null), false)
    assert.equal(KeyPool.isRetryable("string error"), false)
  })

  it("next() cycles round-robin through all keys", () => {
    const pool = new KeyPool(["a", "b", "c"])
    assert.equal(pool.next(), "a")
    assert.equal(pool.next(), "b")
    assert.equal(pool.next(), "c")
    assert.equal(pool.next(), "a")
    assert.equal(pool.next(), "b")
  })

  it("size returns correct key count", () => {
    assert.equal(new KeyPool(["a"]).size, 1)
    assert.equal(new KeyPool(["a", "b", "c"]).size, 3)
  })

  it("execute() continues from next index after successful call", async () => {
    const pool = new KeyPool(["a", "b", "c"])

    await pool.execute(async (k) => k)
    const second = await pool.execute(async (k) => `result:${k}`)

    assert.equal(second, "result:b")
  })

  it("execute() preserves correct position after retry exhaustion", async () => {
    const pool = new KeyPool(["a", "b", "c"])
    const callOrder: string[] = []

    await pool
      .execute(async (k) => {
        callOrder.push(k)
        throw new Error("429 rate limit")
      })
      .catch(() => {})

    assert.deepEqual(callOrder, ["a", "b", "c"])
  })

  it("execute() restarts from right position after full cycle returned to start", async () => {
    const pool = new KeyPool(["a", "b"])
    const callOrder: string[] = []

    await pool
      .execute(async (k) => {
        callOrder.push(k)
        throw new Error("429 rate limit")
      })
      .catch(() => {})

    assert.deepEqual(callOrder, ["a", "b"])
  })

  it("execute() returns the key used when function matches", async () => {
    const pool = new KeyPool(["only-key"])
    const usedKey = await pool.execute(async (k) => k)
    assert.equal(usedKey, "only-key")
  })
})
