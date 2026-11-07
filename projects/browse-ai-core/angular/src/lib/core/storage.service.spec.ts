import { TestBed } from '@angular/core/testing'
import { memoryStorageAdapter } from 'browse-ai-core'
import { provideTestChat } from '../../../../testing/fake-ai'
import { StorageService } from './storage.service'

describe('StorageService', () => {
  function setup() {
    const storage = memoryStorageAdapter()
    TestBed.configureTestingModule({
      providers: provideTestChat({ storage, storageKey: 'test-key' })
    })
    return { storage, service: TestBed.inject(StorageService) }
  }

  it('saves everything under the storage key', async () => {
    const { storage, service } = setup()
    await service.setPersonalization({
      nickname: 'Ana',
      customInstructions: ''
    })
    await service.setAppearance({ palette: 'rose' })
    const saved = await storage.get<{ personalization: { nickname: string } }>(
      'test-key'
    )
    expect(saved?.personalization.nickname).toBe('Ana')
    expect(await service.loadAppearance()).toEqual({ palette: 'rose' })
  })

  it('runs writes one after another', async () => {
    const { service } = setup()
    await Promise.all([
      service.setBookmarks({ A: [] }),
      service.setAiBookmarksEnabled(false),
      service.setPersonalization({ nickname: 'B', customInstructions: '' })
    ])
    const data = await service.load()
    expect(data.bookmarks.bookmarksData).toEqual({ A: [] })
    expect(data.bookmarks.aiBookmarksEnabled).toBe(false)
    expect(data.personalization.nickname).toBe('B')
  })

  it('asks for reorganization every n additions', async () => {
    const { service } = setup()
    const results = []
    for (let i = 0; i < 4; i++)
      results.push(await service.trackBookmarkAddition(2))
    expect(results).toEqual([false, true, false, true])
  })
})
