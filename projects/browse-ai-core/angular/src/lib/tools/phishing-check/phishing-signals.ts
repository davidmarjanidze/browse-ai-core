import type { RiskLevel } from '../../chat/tool-card.model'
import { BRANDS, IDENTITY_PROVIDERS } from './brands'

export type SignalId =
  | 'insecure-form'
  | 'foreign-action'
  | 'odd-host'
  | 'brand-mismatch'
  | 'lonely-login'
  | 'link-mismatch'
  | 'urgent-text'
  | 'blocked-paste'

export interface PhishingSignal {
  id: SignalId
  weight: number
  /** Short evidence shown to the user. */
  detail: string
  element?: Element
}

export const WEIGHTS: Record<SignalId, number> = {
  'insecure-form': 3,
  'foreign-action': 2,
  'odd-host': 2,
  'brand-mismatch': 4,
  'lonely-login': 2,
  'link-mismatch': 1,
  'urgent-text': 2,
  'blocked-paste': 1
}

export const URGENT_PHRASES = [
  'account suspended',
  'account has been suspended',
  'account will be closed',
  'verify your account',
  'verify within 24 hours',
  'within 24 hours',
  'unusual activity',
  'unauthorized login',
  'confirm your identity',
  'update your payment',
  'payment failed',
  'you won',
  "you've won",
  'claim your prize',
  'gift card',
  'pay with bitcoin',
  'crypto payment',
  'send bitcoin',
  'wallet recovery phrase',
  'seed phrase',
  'act now',
  'final notice'
]

/** example.co.uk and shop.example.com both give the site's own domain. */
export function baseDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/\.$/u, '').split('.')
  if (labels.length <= 2) return labels.join('.')
  const second = labels[labels.length - 2]
  const takeThree =
    labels[labels.length - 1].length === 2 &&
    ['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'].includes(second)
  return labels.slice(takeThree ? -3 : -2).join('.')
}

const isIp = (host: string): boolean =>
  /^\d{1,3}(\.\d{1,3}){3}$/u.test(host) || host.includes(':')
const isLocal = (host: string): boolean =>
  host === 'localhost' ||
  host.endsWith('.local') ||
  /^(10|127)\./u.test(host) ||
  /^192\.168\./u.test(host) ||
  /^172\.(1[6-9]|2\d|3[01])\./u.test(host)

const matchesDomain = (host: string, domain: string): boolean =>
  host === domain || host.endsWith(`.${domain}`)

function hasLoginField(doc: Document): Element | null {
  return doc.querySelector('input[type="password"], input[autocomplete^="cc-"]')
}

export function checkHost(hostname: string): PhishingSignal | null {
  const host = hostname.toLowerCase()
  if (isLocal(host)) return null
  const reasons: string[] = []
  if (host.split('.').some((label) => label.startsWith('xn--')))
    reasons.push('punycode')
  if (isIp(host)) reasons.push('IP address')
  if (host.split('.').length - 2 >= 4) reasons.push('many subdomains')
  if ((host.match(/-/gu) ?? []).length >= 3) reasons.push('many hyphens')
  return reasons.length
    ? {
        id: 'odd-host',
        weight: WEIGHTS['odd-host'],
        detail: `${host} (${reasons.join(', ')})`
      }
    : null
}

/** The brand named in the title, logo or main heading, when the host isn't its site. */
export function checkBrand(
  doc: Document,
  hostname: string
): PhishingSignal | null {
  const host = hostname.toLowerCase()
  if (
    isLocal(host) ||
    IDENTITY_PROVIDERS.some((domain) => matchesDomain(host, domain))
  )
    return null
  const logo = doc.querySelector('img[alt*="logo" i], header img[alt]')
  const places: [string, Element | null][] = [
    [doc.title, null],
    [logo?.getAttribute('alt') ?? '', logo],
    [doc.querySelector('h1')?.textContent ?? '', doc.querySelector('h1')]
  ]
  for (const [brand, domains] of Object.entries(BRANDS)) {
    const pattern = new RegExp(
      `\\b${brand.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\b`,
      'iu'
    )
    const place = places.find(([text]) => pattern.test(text))
    if (place && !domains.some((domain) => matchesDomain(host, domain))) {
      return {
        id: 'brand-mismatch',
        weight: WEIGHTS['brand-mismatch'],
        detail: brand,
        element: place[1] ?? undefined
      }
    }
  }
  return null
}

/** All signals found on the page. */
export function scanPhishingSignals(
  doc: Document,
  host?: Element | null
): PhishingSignal[] {
  const signals: PhishingSignal[] = []
  const location = doc.location
  const hostname = location?.hostname ?? ''
  const login = hasLoginField(doc)
  const add = (signal: PhishingSignal | null) => signal && signals.push(signal)
  const outside = (element: Element) =>
    !host || !(host === element || host.contains(element))

  if (login && location?.protocol === 'http:' && !isLocal(hostname)) {
    add({
      id: 'insecure-form',
      weight: WEIGHTS['insecure-form'],
      detail: '',
      element: login
    })
  }
  for (const form of Array.from(doc.forms)) {
    const action = form.getAttribute('action')
    if (!action) continue
    try {
      const target = new URL(action, doc.baseURI)
      if (
        /^https?:$/u.test(target.protocol) &&
        baseDomain(target.hostname) !== baseDomain(hostname)
      ) {
        add({
          id: 'foreign-action',
          weight: WEIGHTS['foreign-action'],
          detail: target.hostname,
          element: form
        })
        break
      }
    } catch {
      // Unreadable action URLs are skipped.
    }
  }
  add(checkHost(hostname))
  add(checkBrand(doc, hostname))

  const links = Array.from(doc.querySelectorAll('a[href]')).filter(outside)
  if (login) {
    const sameSite = links.some((link) => {
      try {
        const url = new URL(link.getAttribute('href') ?? '', doc.baseURI)
        return (
          baseDomain(url.hostname) === baseDomain(hostname) &&
          url.pathname !== location?.pathname
        )
      } catch {
        return false
      }
    })
    if (!sameSite)
      add({
        id: 'lonely-login',
        weight: WEIGHTS['lonely-login'],
        detail: '',
        element: login
      })
  }
  for (const link of links) {
    const shown = link.textContent
      ?.trim()
      .match(/^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/\S*)?$/iu)?.[1]
    if (!shown) continue
    try {
      const real = new URL(link.getAttribute('href') ?? '', doc.baseURI)
        .hostname
      if (baseDomain(real) !== baseDomain(shown)) {
        add({
          id: 'link-mismatch',
          weight: WEIGHTS['link-mismatch'],
          detail: `${shown} → ${real}`,
          element: link
        })
        break
      }
    } catch {
      // Skip.
    }
  }
  const text = (doc.body?.textContent ?? '').toLowerCase().replace(/\s+/gu, ' ')
  const phrases = URGENT_PHRASES.filter((phrase) =>
    text.includes(phrase)
  ).slice(0, 3)
  if (phrases.length)
    add({
      id: 'urgent-text',
      weight: WEIGHTS['urgent-text'],
      detail: phrases.map((p) => `"${p}"`).join(', ')
    })

  const blocked = Array.from(
    doc.querySelectorAll('input[onpaste], input[oncontextmenu], input[oncopy]')
  ).find((input) =>
    /return\s+false|preventDefault/iu.test(
      `${input.getAttribute('onpaste')} ${input.getAttribute('oncontextmenu')} ${input.getAttribute('oncopy')}`
    )
  )
  if (blocked && outside(blocked))
    add({
      id: 'blocked-paste',
      weight: WEIGHTS['blocked-paste'],
      detail: '',
      element: blocked
    })
  return signals
}

export function scoreSignals(signals: PhishingSignal[]): number {
  return signals.reduce((sum, signal) => sum + signal.weight, 0)
}

/** Low under 3, Medium 3 to 5, High 6 and above. */
export function levelFromScore(score: number): RiskLevel {
  if (score >= 6) return 'high'
  return score >= 3 ? 'medium' : 'low'
}

/** The model may raise the level by one, never lower it. */
export function raiseLevel(level: RiskLevel, raise: boolean): RiskLevel {
  if (!raise) return level
  return level === 'low' ? 'medium' : 'high'
}
