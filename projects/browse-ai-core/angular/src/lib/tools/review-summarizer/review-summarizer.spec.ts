import { TestBed } from '@angular/core/testing'
import {
  fakeAi,
  flush,
  promptText,
  provideTestChat
} from '../../../../../testing/fake-ai'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { parseRatingText, reviewStats, scanReviews } from './review-scanner'
import { parseReviewSummary, reviewParts } from './review-summarizer.service'

const long = (text: string) => `${text} ${'and more words here '.repeat(3)}`

describe('scanReviews', () => {
  afterEach(() => {
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('reads JSON-LD reviews with ratings', () => {
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify(
      {
        '@type': 'Product',
        review: [
          {
            '@type': 'Review',
            reviewBody: 'Great phone',
            reviewRating: { ratingValue: 5 }
          },
          {
            '@type': 'Review',
            reviewBody: 'Battery is weak',
            reviewRating: { ratingValue: 4, bestRating: 10 }
          }
        ]
      }
    )}</script>`
    const reviews = scanReviews(document)
    expect(reviews.map((review) => [review.text, review.rating])).toEqual([
      ['Great phone', 5],
      ['Battery is weak', 2]
    ])
  })

  it('reads microdata reviews', () => {
    document.body.innerHTML = [1, 2]
      .map(
        (n) => `
      <div itemscope itemtype="https://schema.org/Review">
        <meta itemprop="ratingValue" content="${n + 2}">
        <p itemprop="reviewBody">${long(`Review number ${n}`)}</p>
      </div>`
      )
      .join('')
    expect(scanReviews(document).map((review) => review.rating)).toEqual([3, 4])
  })

  it('finds repeated review blocks, reads star labels and skips the chat and repeats', () => {
    document.body.innerHTML = `
      <div class="review-card"><span aria-label="4 out of 5 stars"></span><p>${long('Works well for me')}</p></div>
      <div class="review-card"><span class="star full"></span><span class="star full"></span><span class="star"></span><span class="star"></span><span class="star"></span><p>${long('Too small for my hands')}</p></div>
      <div class="review-card"><p>${long('Works well for me')}</p></div>
      <div id="chat"><div class="review-card"><p>${long('Inside the chat')}</p></div><div class="review-card"><p>${long('Inside two')}</p></div></div>`
    const reviews = scanReviews(document, document.getElementById('chat'))
    expect(reviews.map((review) => review.rating)).toEqual([4, 2])
    expect(reviews.every((review) => !review.text.includes('Inside'))).toBe(
      true
    )
  })

  it('parses rating text and counts stats in code', () => {
    expect(parseRatingText('Rated 4.5 out of 5')).toBe(4.5)
    expect(parseRatingText('3/5')).toBe(3)
    expect(parseRatingText('no rating')).toBeNull()
    const stats = reviewStats([
      { text: 'a', rating: 5, date: '' },
      { text: 'b', rating: 4, date: '' },
      { text: 'c', rating: null, date: '' }
    ])
    expect(stats).toEqual({
      count: 3,
      rated: 2,
      average: 4.5,
      perStar: [0, 0, 0, 1, 1]
    })
  })

  it('splits long review lists into parts', () => {
    const reviews = Array.from({ length: 30 }, () => ({
      text: 'x'.repeat(1000),
      rating: null,
      date: ''
    }))
    const parts = reviewParts(reviews, 10_000)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((part) => part.length <= 10_000)).toBe(true)
  })

  it('reads summaries and limits lists to 5', () => {
    const summary = parseReviewSummary(
      '{"pros":["a","b","c","d","e","f"],"cons":[],"verdict":"Good"}'
    )
    expect(summary.pros.length).toBe(5)
    expect(summary.complaints).toEqual([])
    expect(summary.verdict).toBe('Good')
  })
})

describe('Review Summarizer tool', () => {
  afterEach(() => (document.body.innerHTML = ''))

  async function run(reply: string) {
    const fake = fakeAi({ reply })
    TestBed.configureTestingModule({
      providers: provideTestChat({ aiProvider: fake.provider })
    })
    const session = TestBed.inject(ChatSessionStore)
    TestBed.tick()
    await flush()
    session.selectTool('review-summarizer')
    session.prompt.set('battery')
    await session.send()
    return { session, fake }
  }

  it('summarizes with pros, cons, stats and a bar chart card', async () => {
    document.body.innerHTML = [5, 3]
      .map(
        (n) =>
          `<div class="review"><span aria-label="${n} out of 5 stars"></span><p>${long(`Review ${n}`)}</p></div>`
      )
      .join('')
    const { session, fake } = await run(
      '{"pros":["Fast"],"cons":["Heavy"],"complaints":[],"verdict":"Solid."}'
    )
    expect(promptText(fake.inputs[0])).toContain('FOCUS ONLY ON: battery')
    const answer = session.messages()[1]
    expect(answer.content).toContain('**Pros**')
    expect(answer.content).toContain('- Fast')
    expect(answer.content).toContain('Average rating:** 4 / 5')
    expect(answer.content).toContain('Based on 2 reviews visible on this page.')
    expect(answer.card).toEqual({
      kind: 'reviews',
      stats: { count: 2, rated: 2, average: 4, perStar: [0, 0, 1, 0, 1] }
    })
  })

  it('says when there are no reviews', async () => {
    document.body.innerHTML = '<p>Just a page</p>'
    const { session, fake } = await run('{}')
    expect(session.messages()[1].content).toBe(
      'No reviews were found on this page.'
    )
    expect(fake.inputs.length).toBe(0)
  })
})
