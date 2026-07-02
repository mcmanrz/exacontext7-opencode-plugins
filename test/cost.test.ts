import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatCost, estimatedCostLine, type ExaCostDollars } from "../src/types"

describe("formatCost", () => {
  it("returns empty string for undefined", () => {
    assert.equal(formatCost(undefined), "")
  })

  it("returns empty string for cost with no total", () => {
    assert.equal(formatCost({} as ExaCostDollars), "")
  })

  it("formats total only", () => {
    const result = formatCost({ total: 0.0015 })
    assert.equal(result, "Cost: $0.001500")
  })

  it("formats total with search breakdown", () => {
    const result = formatCost({ total: 0.0015, search: { neural: 0.001 } })
    assert.equal(result, "Cost: $0.001500 [search: neural: $0.001000]")
  })

  it("formats total with contents breakdown", () => {
    const result = formatCost({
      total: 0.0025,
      contents: { text: 0.002, highlights: 0.0005 },
    })
    assert.equal(
      result,
      "Cost: $0.002500 [contents: text: $0.002000, highlights: $0.000500]"
    )
  })

  it("formats full cost breakdown", () => {
    const result = formatCost({
      total: 0.0035,
      search: { neural: 0.001, keyword: 0.0005 },
      contents: { text: 0.002 },
    })
    assert.equal(
      result,
      "Cost: $0.003500 [search: neural: $0.001000, keyword: $0.000500] [contents: text: $0.002000]"
    )
  })

  it("omits zero-value search fields", () => {
    const result = formatCost({
      total: 0.001,
      search: { neural: undefined, keyword: 0.001 },
    })
    assert.equal(result, "Cost: $0.001000 [search: keyword: $0.001000]")
  })

  it("omits zero-value contents fields", () => {
    const result = formatCost({
      total: 0.001,
      contents: { text: 0.001, highlights: undefined },
    })
    assert.equal(result, "Cost: $0.001000 [contents: text: $0.001000]")
  })

  it("rounds to 6 decimal places", () => {
    const result = formatCost({ total: 0.123456789 })
    assert.equal(result, "Cost: $0.123457")
  })
})

describe("estimatedCostLine", () => {
  it("returns empty string for undefined", () => {
    assert.equal(estimatedCostLine(undefined), "")
  })

  it("returns empty string for 0", () => {
    assert.equal(estimatedCostLine(0), "")
  })

  it("formats cost per request", () => {
    assert.equal(estimatedCostLine(0.005), "Estimated cost: $0.005000 per request")
  })

  it("formats with many decimal places", () => {
    assert.equal(
      estimatedCostLine(0.001234),
      "Estimated cost: $0.001234 per request"
    )
  })
})
