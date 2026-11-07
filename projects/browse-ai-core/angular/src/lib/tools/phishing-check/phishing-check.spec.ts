import { TestBed } from '@angular/core/testing'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import {
  baseDomain,
  checkBrand,
  checkHost,
  levelFromScore,
  raiseLevel,
  scanPhishingSignals
} from './phishing-signals'

describe('phishing signals', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.title = ''
  })

  it('reads base domains', () => {
    expect(baseDomain('login.example.co.uk')).toBe('example.co.uk')
    expect(baseDomain('a.b.example.com')).toBe('example.com')
  })

  it('flags odd hosts but not local ones', () => {
    expect(checkHost('xn--pypal-4ve.com')?.detail).toContain('punycode')
    expect(checkHost('203.0.113.9')?.detail).toContain('IP address')
    expect(checkHost('a.b.c.d.evil.com')?.detail).toContain('many subdomains')
    expect(checkHost('secure-login-pay-pal.com')?.detail).toContain(
      'many hyphens'
    )
    expect(checkHost('192.168.1.10')).toBeNull()
    expect(checkHost('localhost')).toBeNull()
    expect(checkHost('example.com')).toBeNull()
  })

  it('flags a brand name off its own site, but not on it', () => {
    document.title = 'PayPal - Log in'
    expect(checkBrand(document, 'paypal-secure.example')?.detail).toBe('PayPal')
    expect(checkBrand(document, 'www.paypal.com')).toBeNull()
    expect(checkBrand(document, 'login.microsoftonline.com')).toBeNull()
  })

  it('finds foreign form actions, mismatched links, urgent words and blocked paste', () => {
    document.body.innerHTML = `
      <form action="https://collector.evil.test/steal"><input type="password" onpaste="return false"></form>
      <a href="https://evil.test/x">www.mybank.com</a>
      <p>Your account has been suspended. Verify within 24 hours.</p>`
    const ids = scanPhishingSignals(document).map((signal) => signal.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'foreign-action',
        'link-mismatch',
        'urgent-text',
        'blocked-paste',
        'lonely-login'
      ])
    )
  })

  it('turns scores into levels and only raises by one', () => {
    expect(levelFromScore(2)).toBe('low')
    expect(levelFromScore(3)).toBe('medium')
    expect(levelFromScore(6)).toBe('high')
    expect(raiseLevel('low', true)).toBe('medium')
    expect(raiseLevel('medium', true)).toBe('high')
    expect(raiseLevel('high', false)).toBe('high')
  })
})

describe('Scam Check tool', () => {
  afterEach(() => (document.body.innerHTML = ''))

  async function run(reply: string) {
    const fake = fakeAi({ reply })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    const session = TestBed.inject(ChatSessionStore)
    TestBed.tick()
    await flush()
    session.selectTool('phishing-check')
    await session.send()
    return { session, fake }
  }

  it('shows the risk level, reasons and the disclaimer; the model cannot lower it', async () => {
    document.body.innerHTML = `
      <form action="https://collector.evil.test/"><input type="password"></form>
      <p>Your account has been suspended.</p>`
    const { session, fake } = await run(
      '{"explanation":"Looks fake.","advice":"Leave the page.","raise":false}'
    )
    expect(promptText(fake.inputs[0])).toContain(
      'SIGNS FOUND: A form sends data to another website'
    )
    const answer = session.messages()[1]
    expect(answer.content).toContain('**High risk**')
    expect(answer.content).toContain('Leave the page.')
    expect(answer.content).toContain('This is a quick check, not a guarantee.')
    const card = answer.card as {
      kind: 'phishing'
      level: string
      signals: unknown[]
    }
    expect(card.level).toBe('high')
    expect(card.signals.length).toBe(3)
  })

  it('is Low with no signs, and the model can raise it by one', async () => {
    document.body.innerHTML = '<p>A calm page.</p>'
    const low = await run('{"explanation":"","advice":"","raise":false}')
    expect(low.session.messages()[1].content).toContain(
      'No warning signs were found on this page.'
    )
    TestBed.resetTestingModule()
    const raised = await run(
      '{"explanation":"Gift card scam.","advice":"","raise":true}'
    )
    expect((raised.session.messages()[1].card as { level: string }).level).toBe(
      'medium'
    )
  })
})
