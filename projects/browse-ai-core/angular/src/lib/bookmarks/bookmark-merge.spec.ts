import {
  addBookmark,
  applyMerges,
  chunkBookmarks,
  normalizeMerges
} from './bookmark-merge'

const entry = (url: string, title = url) => ({ title, url })

describe('bookmark merge', () => {
  const bookmarks = {
    'Angular Signals': [entry('https://a/1', 'Signals guide')],
    'Angular Forms': [entry('https://a/2'), entry('https://a/1')],
    News: [entry('https://n/1')]
  }

  it('keeps valid merges and resolves page titles to categories', () => {
    const merges = normalizeMerges(
      {
        merges: [
          {
            from: ['Angular Signals', 'Signals guide', 'Unknown'],
            to: 'Angular'
          },
          { from: ['Angular Forms'], to: 'Web' },
          { from: 'bad', to: 'x' }
        ]
      },
      bookmarks
    )
    expect(merges).toEqual([
      { from: ['Angular Signals'], to: 'Angular' },
      { from: ['Angular Forms'], to: 'Web' }
    ])
  })

  it('does not use a category twice', () => {
    const merges = normalizeMerges(
      {
        merges: [
          { from: ['News'], to: 'Reading' },
          { from: ['News', 'Angular Forms'], to: 'Other' }
        ]
      },
      bookmarks
    )
    expect(merges).toHaveLength(1)
  })

  it('moves entries without duplicates', () => {
    const next = applyMerges(bookmarks, [
      { from: ['Angular Signals', 'Angular Forms'], to: 'Angular' }
    ])
    expect(Object.keys(next)).toEqual(['News', 'Angular'])
    expect(next['Angular'].map((e) => e.url)).toEqual([
      'https://a/1',
      'https://a/2'
    ])
  })

  it('splits large bookmark sets', () => {
    const big = {
      Big: Array.from({ length: 10 }, (_, i) =>
        entry(`https://example.com/${i}`)
      )
    }
    const chunks = chunkBookmarks(big, 120)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.flatMap((c) => c['Big'])).toHaveLength(10)
  })

  it('adds new pages first and new categories on top', () => {
    const added = addBookmark(bookmarks, 'News', entry('https://n/2'))!
    expect(added['News'][0].url).toBe('https://n/2')
    expect(
      Object.keys(addBookmark(bookmarks, 'Fresh', entry('https://f'))!)[0]
    ).toBe('Fresh')
    expect(addBookmark(bookmarks, 'News', entry('https://n/1'))).toBeNull()
  })
})
