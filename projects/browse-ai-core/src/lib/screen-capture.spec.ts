import {
  chromeExtensionScreenCapture,
  defaultScreenCapture
} from './screen-capture'

type ChromeGlobal = { chrome?: unknown }

describe('screen capture adapters', () => {
  afterEach(() => delete (globalThis as ChromeGlobal).chrome)

  it('extension adapter is null outside an extension', () => {
    expect(chromeExtensionScreenCapture()).toBeNull()
  })

  it('asks the background worker for a screenshot', async () => {
    const sendMessage = vi.fn(
      (_message: unknown, callback: (response: unknown) => void) =>
        callback({ ok: true, dataUrl: 'data:image/png;base64,AA' })
    )
    ;(globalThis as ChromeGlobal).chrome = {
      runtime: { id: 'ext', sendMessage }
    }

    const capture = chromeExtensionScreenCapture()!
    await expect(capture.captureVisibleArea()).resolves.toBe(
      'data:image/png;base64,AA'
    )
    expect(sendMessage.mock.calls[0][0]).toEqual({
      type: 'CAPTURE_VISIBLE_TAB'
    })
  })

  it('rejects with the error from the worker', async () => {
    ;(globalThis as ChromeGlobal).chrome = {
      runtime: {
        id: 'ext',
        sendMessage: (
          _message: unknown,
          callback: (response: unknown) => void
        ) => callback({ ok: false, error: 'No permission' })
      }
    }
    await expect(
      chromeExtensionScreenCapture()!.captureVisibleArea()
    ).rejects.toThrow('No permission')
  })

  it('default adapter prefers the extension adapter', () => {
    ;(globalThis as ChromeGlobal).chrome = {
      runtime: { id: 'ext', sendMessage: vi.fn() }
    }
    expect(defaultScreenCapture()).not.toBeNull()
  })
})
