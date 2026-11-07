import {
  chromeStorageAdapter,
  defaultStorageAdapter,
  localStorageAdapter,
  memoryStorageAdapter
} from './storage'

type ChromeGlobal = { chrome?: unknown }

describe('storage adapters', () => {
  afterEach(() => {
    delete (globalThis as ChromeGlobal).chrome
    localStorage.clear()
  })

  it('memory adapter stores copies', async () => {
    const storage = memoryStorageAdapter()
    const value = { list: [1] }
    await storage.set('key', value)
    value.list.push(2)
    expect(await storage.get('key')).toEqual({ list: [1] })
    await storage.remove('key')
    expect(await storage.get('key')).toBeUndefined()
  })

  it('localStorage adapter saves JSON and ignores broken values', async () => {
    const storage = localStorageAdapter()
    await storage.set('key', { a: 1 })
    expect(localStorage.getItem('key')).toBe('{"a":1}')
    expect(await storage.get('key')).toEqual({ a: 1 })
    localStorage.setItem('broken', '{')
    expect(await storage.get('broken')).toBeUndefined()
  })

  it('chrome adapter is null outside an extension', () => {
    expect(chromeStorageAdapter()).toBeNull()
  })

  it('chrome adapter uses chrome.storage.local', async () => {
    const data: Record<string, unknown> = {}
    ;(globalThis as ChromeGlobal).chrome = {
      storage: {
        local: {
          get: async (keys: string[]) =>
            Object.fromEntries(
              keys.filter((key) => key in data).map((key) => [key, data[key]])
            ),
          set: async (items: Record<string, unknown>) =>
            Object.assign(data, items),
          remove: async (keys: string[]) =>
            keys.forEach((key) => delete data[key])
        }
      }
    }
    const storage = chromeStorageAdapter()!
    await storage.set('key', 'value')
    expect(data['key']).toBe('value')
    expect(await storage.get('key')).toBe('value')
    await storage.remove('key')
    expect(await storage.get('key')).toBeUndefined()
  })

  it('default adapter falls back to localStorage', async () => {
    await defaultStorageAdapter().set('fallback', 1)
    expect(localStorage.getItem('fallback')).toBe('1')
  })
})
