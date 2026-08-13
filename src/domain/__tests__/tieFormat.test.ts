import { describe, it, expect } from 'vitest'
import { parseTieFormat } from '../tieFormat'

const valid = {
  rubbers: [
    { format: 'singles', constraint: { allowedGenders: ['M'] } },
    {
      format: 'doubles',
      constraint: { allowedGenders: ['M', 'F'], ageMin: 40 },
      pairRule: 'mixed'
    }
  ],
  usagePolicy: { kind: 'max-rubbers', max: 2 },
  leadTimeMinutes: 30
}

describe('parseTieFormat — happy path', () => {
  it('parses a full, well-formed format', () => {
    expect(parseTieFormat(valid)).toEqual(valid)
  })

  it('defaults leadTimeMinutes to 30 and usagePolicy to at-most-once when omitted', () => {
    expect(parseTieFormat({ rubbers: [] })).toEqual({ rubbers: [], leadTimeMinutes: 30 })
  })

  it('accepts a constraint with only age bounds', () => {
    const fmt = parseTieFormat({
      rubbers: [{ format: 'singles', constraint: { ageMax: 17 } }]
    })
    expect(fmt.rubbers[0].constraint).toEqual({ ageMax: 17 })
  })
})

describe('parseTieFormat — rejects malformed input', () => {
  it('rejects non-object input', () => {
    expect(() => parseTieFormat('nope')).toThrow()
  })

  it('rejects rubbers that is not an array', () => {
    expect(() => parseTieFormat({ rubbers: 'x' })).toThrow(/rubbers/)
  })

  it('rejects an invalid rubber format', () => {
    expect(() => parseTieFormat({ rubbers: [{ format: 'triple', constraint: {} }] })).toThrow(
      /format/
    )
  })

  it('rejects a rubber missing its constraint', () => {
    expect(() => parseTieFormat({ rubbers: [{ format: 'singles' }] })).toThrow(/constraint/)
  })

  it('rejects a negative ageMin', () => {
    expect(() =>
      parseTieFormat({ rubbers: [{ format: 'singles', constraint: { ageMin: -1 } }] })
    ).toThrow(/ageMin/)
  })

  it('rejects an invalid pairRule', () => {
    expect(() =>
      parseTieFormat({
        rubbers: [{ format: 'doubles', constraint: {}, pairRule: 'whatever' }]
      })
    ).toThrow(/pairRule/)
  })

  it('rejects an invalid usagePolicy kind', () => {
    expect(() => parseTieFormat({ rubbers: [], usagePolicy: { kind: 'nope' } })).toThrow(
      /usagePolicy/
    )
  })

  it('rejects max-rubbers without a max', () => {
    expect(() => parseTieFormat({ rubbers: [], usagePolicy: { kind: 'max-rubbers' } })).toThrow(
      /max/
    )
  })

  it('rejects a negative leadTimeMinutes', () => {
    expect(() => parseTieFormat({ rubbers: [], leadTimeMinutes: -5 })).toThrow(/leadTimeMinutes/)
  })
})
