/** Shared helpers for parsing untrusted JSON into typed domain objects. */

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

export function object(v: unknown, ctx: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new ParseError(`${ctx} must be an object.`)
  }
  return v as Record<string, unknown>
}

export function array(v: unknown, ctx: string): unknown[] {
  if (!Array.isArray(v)) throw new ParseError(`${ctx} must be an array.`)
  return v
}

export function string(v: unknown, ctx: string): string {
  if (typeof v !== 'string') throw new ParseError(`${ctx} must be a string.`)
  return v
}

/** Non-negative integer (>= 0). */
export function nonNegInt(v: unknown, ctx: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw new ParseError(`${ctx} must be a non-negative integer.`)
  }
  return v
}
