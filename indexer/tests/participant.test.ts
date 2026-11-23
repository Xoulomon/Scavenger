/**
 * Unit tests for participantService (#797).
 *
 * All DB calls are mocked so these tests run without a real database.
 */

import {
  getParticipant,
  listParticipants,
  registerParticipant,
  removeParticipant,
  ValidationError,
  NotFoundError
} from '../src/services/participantService'

// Mock the query layer
jest.mock('../src/queries/participantQueries', () => ({
  queryParticipantByAddress: jest.fn(),
  queryParticipants: jest.fn(),
  upsertParticipant: jest.fn(),
  deactivateParticipant: jest.fn()
}))

import {
  queryParticipantByAddress,
  queryParticipants,
  upsertParticipant,
  deactivateParticipant
} from '../src/queries/participantQueries'

const mockGetByAddress = queryParticipantByAddress as jest.MockedFunction<
  typeof queryParticipantByAddress
>
const mockList = queryParticipants as jest.MockedFunction<typeof queryParticipants>
const mockUpsert = upsertParticipant as jest.MockedFunction<typeof upsertParticipant>
const mockDeactivate = deactivateParticipant as jest.MockedFunction<typeof deactivateParticipant>

const SAMPLE_PARTICIPANT = {
  address: 'GABC123',
  role: 'Recycler' as const,
  name: 'Alice',
  latitude: 1000,
  longitude: 2000,
  registeredAtLedger: 100,
  registeredAt: new Date().toISOString(),
  isActive: true
}

describe('participantService – getParticipant (#797)', () => {
  beforeEach(() => jest.resetAllMocks())

  it('returns participant when found', async () => {
    mockGetByAddress.mockResolvedValue(SAMPLE_PARTICIPANT)
    const result = await getParticipant('GABC123')
    expect(result).toEqual(SAMPLE_PARTICIPANT)
    expect(mockGetByAddress).toHaveBeenCalledWith('GABC123')
  })

  it('throws NotFoundError when participant does not exist', async () => {
    mockGetByAddress.mockResolvedValue(null)
    await expect(getParticipant('GMISSING')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws ValidationError for empty address', async () => {
    await expect(getParticipant('')).rejects.toBeInstanceOf(ValidationError)
    await expect(getParticipant('   ')).rejects.toBeInstanceOf(ValidationError)
  })

  it('trims address before lookup', async () => {
    mockGetByAddress.mockResolvedValue(SAMPLE_PARTICIPANT)
    await getParticipant('  GABC123  ')
    expect(mockGetByAddress).toHaveBeenCalledWith('GABC123')
  })
})

describe('participantService – listParticipants (#797)', () => {
  beforeEach(() => jest.resetAllMocks())

  const EMPTY_RESULT = { participants: [], total: 0, limit: 100, offset: 0 }

  it('calls queryParticipants with defaults', async () => {
    mockList.mockResolvedValue(EMPTY_RESULT)
    await listParticipants({})
    expect(mockList).toHaveBeenCalledWith({
      role: undefined,
      isActive: undefined,
      limit: 100,
      offset: 0
    })
  })

  it('passes parsed role filter', async () => {
    mockList.mockResolvedValue(EMPTY_RESULT)
    await listParticipants({ role: 'Recycler' })
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ role: 'Recycler' }))
  })

  it('throws ValidationError for unknown role', async () => {
    await expect(listParticipants({ role: 'Alien' })).rejects.toBeInstanceOf(ValidationError)
  })

  it('parses isActive=true correctly', async () => {
    mockList.mockResolvedValue(EMPTY_RESULT)
    await listParticipants({ isActive: 'true' })
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }))
  })

  it('parses isActive=false correctly', async () => {
    mockList.mockResolvedValue(EMPTY_RESULT)
    await listParticipants({ isActive: 'false' })
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }))
  })

  it('caps limit at 1000', async () => {
    mockList.mockResolvedValue(EMPTY_RESULT)
    await listParticipants({ limit: '99999' })
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ limit: 1000 }))
  })
})

describe('participantService – registerParticipant (#797)', () => {
  beforeEach(() => jest.resetAllMocks())

  const VALID_INPUT = {
    address: 'GABC123',
    role: 'Recycler',
    name: 'Alice',
    latitude: 1000,
    longitude: 2000,
    registeredAtLedger: 100,
    registeredAt: new Date()
  }

  it('upserts and returns participant on valid input', async () => {
    mockUpsert.mockResolvedValue(SAMPLE_PARTICIPANT)
    const result = await registerParticipant(VALID_INPUT)
    expect(result).toEqual(SAMPLE_PARTICIPANT)
    expect(mockUpsert).toHaveBeenCalledTimes(1)
  })

  it('throws ValidationError when address is missing', async () => {
    await expect(registerParticipant({ ...VALID_INPUT, address: '' })).rejects.toBeInstanceOf(
      ValidationError
    )
  })

  it('throws ValidationError when name is blank', async () => {
    await expect(registerParticipant({ ...VALID_INPUT, name: '   ' })).rejects.toBeInstanceOf(
      ValidationError
    )
  })

  it('throws ValidationError for invalid role', async () => {
    await expect(registerParticipant({ ...VALID_INPUT, role: 'Unknown' })).rejects.toBeInstanceOf(
      ValidationError
    )
  })

  it('throws ValidationError when latitude is not finite', async () => {
    await expect(
      registerParticipant({ ...VALID_INPUT, latitude: Infinity })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws ValidationError when registeredAtLedger is negative', async () => {
    await expect(
      registerParticipant({ ...VALID_INPUT, registeredAtLedger: -1 })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('passes valid Collector and Manufacturer roles', async () => {
    mockUpsert.mockResolvedValue({ ...SAMPLE_PARTICIPANT, role: 'Collector' })
    await expect(registerParticipant({ ...VALID_INPUT, role: 'Collector' })).resolves.toBeDefined()

    mockUpsert.mockResolvedValue({ ...SAMPLE_PARTICIPANT, role: 'Manufacturer' })
    await expect(
      registerParticipant({ ...VALID_INPUT, role: 'Manufacturer' })
    ).resolves.toBeDefined()
  })
})

describe('participantService – removeParticipant (#797)', () => {
  beforeEach(() => jest.resetAllMocks())

  it('deactivates existing participant', async () => {
    mockDeactivate.mockResolvedValue(true)
    await expect(removeParticipant('GABC123')).resolves.toBeUndefined()
    expect(mockDeactivate).toHaveBeenCalledWith('GABC123')
  })

  it('throws NotFoundError when participant does not exist', async () => {
    mockDeactivate.mockResolvedValue(false)
    await expect(removeParticipant('GMISSING')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws ValidationError for blank address', async () => {
    await expect(removeParticipant('')).rejects.toBeInstanceOf(ValidationError)
  })
})
