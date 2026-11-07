export interface ResearchPage {
  url: string
  title: string
  addedAt: string
  points: string[]
}

export interface ResearchTopic {
  id: string
  name: string
  updatedAt: string
  pages: ResearchPage[]
}

/** Topic id to topic. */
export type ResearchData = Record<string, ResearchTopic>

export const MAX_RESEARCH_PAGES = 50

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'

function normalizePage(value: unknown): ResearchPage | null {
  if (!isObject(value) || !isString(value['url'])) return null
  const points = Array.isArray(value['points'])
    ? value['points'].filter(isString)
    : []
  return {
    url: value['url'],
    title: isString(value['title']) ? value['title'] : '',
    addedAt: isString(value['addedAt']) ? value['addedAt'] : '',
    points
  }
}

export function normalizeResearch(value: unknown): ResearchData {
  if (!isObject(value)) return {}
  const result: ResearchData = {}
  for (const [id, topic] of Object.entries(value)) {
    if (!isObject(topic) || !isString(topic['name'])) continue
    const pages = Array.isArray(topic['pages'])
      ? topic['pages']
          .map(normalizePage)
          .filter((page): page is ResearchPage => page !== null)
      : []
    result[id] = {
      id,
      name: topic['name'],
      updatedAt: isString(topic['updatedAt']) ? topic['updatedAt'] : '',
      pages
    }
  }
  return result
}

export type AddPageResult = 'added' | 'updated' | 'full'

/** Adds or replaces a page in a topic. Topics hold at most 50 pages. */
export function addResearchPage(
  data: ResearchData,
  topicId: string,
  page: ResearchPage
): { data: ResearchData; result: AddPageResult } {
  const topic = data[topicId]
  if (!topic) return { data, result: 'full' }
  const index = topic.pages.findIndex((entry) => entry.url === page.url)
  if (index < 0 && topic.pages.length >= MAX_RESEARCH_PAGES)
    return { data, result: 'full' }
  const pages =
    index >= 0
      ? topic.pages.map((entry, i) => (i === index ? page : entry))
      : [...topic.pages, page]
  return {
    data: {
      ...data,
      [topicId]: { ...topic, pages, updatedAt: page.addedAt }
    },
    result: index >= 0 ? 'updated' : 'added'
  }
}

export function removeResearchPage(
  data: ResearchData,
  topicId: string,
  url: string
): ResearchData {
  const topic = data[topicId]
  if (!topic) return data
  return {
    ...data,
    [topicId]: {
      ...topic,
      pages: topic.pages.filter((page) => page.url !== url)
    }
  }
}

export function topicToMarkdown(topic: ResearchTopic): string {
  const lines = [`# ${topic.name}`, '']
  topic.pages.forEach((page, index) => {
    lines.push(`## ${index + 1}. ${page.title || page.url}`, '', page.url, '')
    lines.push(...page.points.map((point) => `- ${point}`), '')
  })
  return lines.join('\n')
}
