import { RequestStatus } from './request-status'

describe('RequestStatus', () => {
  it('tracks generating, first chunk and thinking', () => {
    const status = new RequestStatus()
    const request = status.begin(true)
    expect(status.isGenerating()).toBe(true)
    expect(status.isAwaitingFirstChunk()).toBe(true)
    expect(status.isThinking()).toBe(true)

    status.firstChunk(request)
    status.firstChunk(request)
    expect(status.isAwaitingFirstChunk()).toBe(false)
    expect(status.isThinking()).toBe(false)
    expect(status.isGenerating()).toBe(true)

    status.end(request)
    expect(status.isGenerating()).toBe(false)
  })

  it('counts parallel requests', () => {
    const status = new RequestStatus()
    const a = status.begin(false)
    const b = status.begin(false)
    status.end(a)
    expect(status.isGenerating()).toBe(true)
    status.end(b)
    expect(status.isGenerating()).toBe(false)
    expect(status.isThinking()).toBe(false)
  })
})
