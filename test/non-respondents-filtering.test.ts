import { describe, it, expect } from 'vitest'

describe('Non-respondents filtering logic', () => {
  const mockNonRespondents = [
    {
      responseId: 'resp1',
      id: 'member1',
      name: 'John Doe',
      lotNumber: '1',
      address: '123 Main Street',
      token: 'token1',
    },
    {
      responseId: 'resp2',
      id: 'member2',
      name: 'Jane Smith',
      lotNumber: '2',
      address: '456 Oak Avenue',
      token: 'token2',
    },
    {
      responseId: 'resp3',
      id: 'member3',
      name: 'Bob Johnson',
      lotNumber: '10',
      address: '789 Pine Road',
      token: 'token3',
    },
    {
      responseId: 'resp4',
      id: 'member4',
      name: 'Alice Brown',
      lotNumber: '15',
      address: null,
      token: 'token4',
    },
  ]

  const createFilterFunction = (lotFilter: string, nameFilter: string, addressFilter: string) => {
    return (respondent: typeof mockNonRespondents[0]) => {
      const lotMatch = lotFilter === '' || respondent.lotNumber.toLowerCase().includes(lotFilter.toLowerCase())
      const nameMatch = nameFilter === '' || respondent.name.toLowerCase().includes(nameFilter.toLowerCase())
      const addressMatch = addressFilter === '' || (respondent.address && respondent.address.toLowerCase().includes(addressFilter.toLowerCase()))
      return lotMatch && nameMatch && addressMatch
    }
  }

  it('filters by lot number', () => {
    const filterFn = createFilterFunction('1', '', '')
    const filtered = mockNonRespondents.filter(filterFn)

    expect(filtered.length).toBe(3) // '1', '10', '15' all contain '1'
    expect(filtered.map(r => r.lotNumber).sort()).toEqual(['1', '10', '15'])
  })

  it('filters by name', () => {
    const filterFn = createFilterFunction('', 'john', '')
    const filtered = mockNonRespondents.filter(filterFn)

    expect(filtered.length).toBe(2)
    expect(filtered.map(r => r.name)).toEqual(['John Doe', 'Bob Johnson'])
  })

  it('filters by address', () => {
    const filterFn = createFilterFunction('', '', 'avenue')
    const filtered = mockNonRespondents.filter(filterFn)

    expect(filtered.length).toBe(1)
    expect(filtered[0].name).toBe('Jane Smith')
  })

  it('combines multiple filters', () => {
    const filterFn = createFilterFunction('1', 'john', '')
    const filtered = mockNonRespondents.filter(filterFn)

    expect(filtered.length).toBe(2) // John Doe (lot '1', name contains 'john') and Bob Johnson (lot '10', name contains 'john')
    expect(filtered.map(r => r.name).sort()).toEqual(['Bob Johnson', 'John Doe'])
  })

  it('handles empty filters (shows all)', () => {
    const filterFn = createFilterFunction('', '', '')
    const filtered = mockNonRespondents.filter(filterFn)

    expect(filtered.length).toBe(4)
  })

  it('handles null addresses', () => {
    const filterFn = createFilterFunction('', '', 'road')
    const filtered = mockNonRespondents.filter(filterFn)

    expect(filtered.length).toBe(1)
    expect(filtered[0].name).toBe('Bob Johnson')
  })

  it('is case insensitive', () => {
    const filterFn = createFilterFunction('', 'DOE', '')
    const filtered = mockNonRespondents.filter(filterFn)

    expect(filtered.length).toBe(1)
    expect(filtered[0].name).toBe('John Doe')
  })

  it('handles partial matches', () => {
    const filterFn = createFilterFunction('1', 'o', '') // 'o' matches John, Bob, Alice
    const filtered = mockNonRespondents.filter(filterFn)

    expect(filtered.length).toBe(3) // John Doe, Bob Johnson, Alice Brown
    expect(filtered.map(r => r.name).sort()).toEqual(['Alice Brown', 'Bob Johnson', 'John Doe'])
  })
})