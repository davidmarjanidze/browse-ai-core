import { createDefaultStorageData, normalizeStorageData } from './storage-data'

describe('normalizeStorageData', () => {
  it('returns defaults for empty or broken data', () => {
    expect(normalizeStorageData(undefined)).toEqual(createDefaultStorageData())
    expect(normalizeStorageData('text')).toEqual(createDefaultStorageData())
  })

  it('reads the current format', () => {
    const data = normalizeStorageData({
      personalization: { nickname: 'Ana', customInstructions: 'Short' },
      bookmarks: {
        aiBookmarksEnabled: false,
        bookmarkReorganizationCounter: 3.7,
        bookmarksData: { Docs: [{ title: 'A', url: 'https://a' }] }
      },
      appearance: { theme: 'dark', palette: 'teal' }
    })
    expect(data.personalization.nickname).toBe('Ana')
    expect(data.bookmarks.aiBookmarksEnabled).toBe(false)
    expect(data.bookmarks.bookmarkReorganizationCounter).toBe(3)
    expect(data.appearance).toEqual({ theme: 'dark', palette: 'teal' })
  })

  it('reads the older extension format', () => {
    const data = normalizeStorageData({
      personalization: { nickname: '', customInstructions: '' },
      aiBookmarksEnabled: true,
      bookmarks: { News: [{ title: 'N', url: 'https://n' }] }
    })
    expect(data.bookmarks.bookmarksData).toEqual({
      News: [{ title: 'N', url: 'https://n' }]
    })
  })

  it('drops invalid appearance values', () => {
    const data = normalizeStorageData({
      appearance: { theme: 'blue', palette: 'pink' }
    })
    expect(data.appearance).toEqual({})
  })
})
