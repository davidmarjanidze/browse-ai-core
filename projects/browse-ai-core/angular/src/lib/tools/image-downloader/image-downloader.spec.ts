import { TestBed } from '@angular/core/testing'
import { fakeAi, flush, provideTestChat } from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { parseImageMatch } from './image-downloader.service'
import { MAX_IMAGES, findVisibleImages, imageFileName } from './visible-images'

interface ImageSetup {
  src: string
  size?: number
  top?: number
  loaded?: boolean
}

function addImages(images: ImageSetup[]): HTMLImageElement[] {
  return images.map(({ src, size = 100, top = 0, loaded = true }) => {
    const img = document.createElement('img')
    img.src = src
    Object.defineProperty(img, 'complete', { value: loaded })
    Object.defineProperty(img, 'naturalWidth', { value: loaded ? size : 0 })
    img.getBoundingClientRect = () =>
      ({
        top,
        left: 0,
        bottom: top + size,
        right: size,
        width: size,
        height: size
      }) as DOMRect
    document.body.appendChild(img)
    return img
  })
}

function mockFetch(failing: string[] = []): void {
  vi.stubGlobal('fetch', async (src: string) => {
    if (failing.some((part) => String(src).includes(part)))
      throw new TypeError('CORS')
    return {
      ok: true,
      blob: async () =>
        new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    }
  })
}

describe('findVisibleImages', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('keeps loaded, large enough images in the viewport without duplicates', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    addImages([
      { src: 'https://x.test/a.png' },
      { src: 'https://x.test/a.png' },
      { src: 'https://x.test/small.png', size: 20 },
      { src: 'https://x.test/below.png', top: 5000 },
      { src: 'https://x.test/lazy.png', loaded: false }
    ])
    const found = findVisibleImages(document, host)
    expect(found.map((image) => image.src)).toEqual(['https://x.test/a.png'])
  })

  it('names files from the URL and keeps names unique', () => {
    const used = new Set<string>()
    expect(
      imageFileName('https://x.test/p/sun.jpeg?x=1', 'image/jpeg', 0, used)
    ).toBe('sun.jpg')
    expect(
      imageFileName('https://x.test/q/sun.jpg', 'image/jpeg', 1, used)
    ).toBe('sun-2.jpg')
    expect(
      imageFileName('data:image/png;base64,AA', 'image/png', 2, used)
    ).toBe('image-3.png')
  })

  it('parses the model answer', () => {
    expect(parseImageMatch('{"match": true}')).toBe(true)
    expect(parseImageMatch('```json\n{"match": false}\n```')).toBe(false)
    expect(parseImageMatch('Yes, it shows the sun')).toBe(true)
    expect(parseImageMatch('No')).toBe(false)
  })
})

describe('Image Downloader tool', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  async function run(answers: boolean[], text = 'images with the sun') {
    let call = 0
    const fake = fakeAi({
      reply: () => JSON.stringify({ match: answers[call++] ?? false })
    })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    const session = TestBed.inject(ChatSessionStore)
    TestBed.tick()
    await flush()
    session.selectTool('image-downloader')
    session.prompt.set(text)
    await session.send()
    return session
  }

  it('keeps matching images, counts skipped ones and offers the zip', async () => {
    addImages([
      { src: 'https://x.test/sun.png' },
      { src: 'https://x.test/car.png' },
      { src: 'https://cors.test/blocked.png' }
    ])
    mockFetch(['cors.test'])
    const session = await run([true, false])
    expect(session.matchedImages().map((image) => image.name)).toEqual([
      'sun.png'
    ])
    expect(session.messages()[1].content).toBe(
      '1 image(s) ready to download.\n\n1 image(s) could not be read.'
    )
  })

  it('says when nothing matches or nothing is visible', async () => {
    addImages([{ src: 'https://x.test/car.png' }])
    mockFetch()
    let session = await run([false])
    expect(session.messages()[1].content).toBe('No matching images were found.')
    expect(session.matchedImages()).toEqual([])

    TestBed.resetTestingModule()
    document.body.innerHTML = ''
    session = await run([])
    expect(session.messages()[1].content).toBe(
      'No images are visible on the page.'
    )
  })

  it('checks at most MAX_IMAGES images', async () => {
    addImages(
      Array.from({ length: MAX_IMAGES + 2 }, (_, i) => ({
        src: `https://x.test/${i}.png`
      }))
    )
    mockFetch()
    const session = await run([])
    expect(session.messages()[1].content).toContain(
      `first ${MAX_IMAGES} images`
    )
  })

  it('reports Stop and keeps the matches found before it', async () => {
    addImages([
      { src: 'https://x.test/sun.png' },
      { src: 'https://x.test/sun2.png' }
    ])
    mockFetch()
    let call = 0
    let session!: ChatSessionStore
    const fake = fakeAi({
      reply: () => {
        if (call++ === 1) session.stop()
        return '{"match": true}'
      }
    })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    session = TestBed.inject(ChatSessionStore)
    TestBed.tick()
    await flush()
    session.selectTool('image-downloader')
    session.prompt.set('sun')
    await session.send()
    expect(session.matchedImages().map((image) => image.name)).toEqual([
      'sun.png'
    ])
    expect(session.messages()[1].content).toContain(
      session.strings().generationStopped
    )
    expect(session.isBusy()).toBe(false)
  })

  it('is hidden when the model has no image input', async () => {
    const fake = fakeAi()
    fake.provider.availability = async (options) =>
      options?.expectedInputs?.includes('image') ? 'unavailable' : 'available'
    TestBed.configureTestingModule({
      providers: provideTestChat({
        aiProvider: fake.provider,
        features: { imageInput: false, screenCapture: false }
      })
    })
    const session = TestBed.inject(ChatSessionStore)
    TestBed.tick()
    await flush()
    expect(session.ai.isSupported()).toBe(true)
    expect(session.tools().map((tool) => tool.id)).not.toContain(
      'image-downloader'
    )
  })

  it('unlocks the composer when a new chat starts during a tool run', async () => {
    addImages([{ src: 'https://x.test/sun.png' }])
    vi.stubGlobal('fetch', () => new Promise(() => undefined))
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fakeAi().provider })
    })
    const session = TestBed.inject(ChatSessionStore)
    TestBed.tick()
    await flush()
    session.selectTool('image-downloader')
    session.prompt.set('sun')
    void session.send()
    expect(session.isBusy()).toBe(true)
    session.clear()
    expect(session.isBusy()).toBe(false)
  })
})
