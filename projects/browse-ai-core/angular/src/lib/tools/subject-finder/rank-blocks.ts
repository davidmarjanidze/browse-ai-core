import { TextBlock } from './text-blocks'

/** Blocks sent to the model when the page is too big to send whole. */
export const MAX_CANDIDATES = 40
/** Page text (characters) that is sent whole, without ranking. */
export const MAX_UNRANKED_CHARS = 6000

const STOP_WORDS = new Set(
  (
    'a an and are as at be by for from has have i im in is it its looking ' +
    'me my of on or regarding about find search show text that the this ' +
    'to was what where which with want need part section page'
  ).split(' ')
)

/** Lower-case words without stop words, with a plural "s" removed. */
export function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map((word) => (word.length > 3 ? word.replace(/s$/, '') : word))
}

export function scoreBlock(queryWords: string[], block: TextBlock): number {
  const blockWords = new Set(words(block.text))
  const hits = new Set(queryWords.filter((word) => blockWords.has(word))).size
  return hits === 0 ? 0 : hits + (block.isHeading ? 0.5 : 0)
}

/**
 * The blocks to show the model. Small pages: all blocks. Big pages: the
 * `MAX_CANDIDATES` blocks that share the most words with the request, in
 * page order.
 */
export function pickCandidates(
  query: string,
  blocks: TextBlock[]
): TextBlock[] {
  const size = blocks.reduce((sum, block) => sum + block.text.length, 0)
  if (size <= MAX_UNRANKED_CHARS) return blocks

  const queryWords = words(query)
  return blocks
    .map((block, index) => ({
      block,
      index,
      score: scoreBlock(queryWords, block)
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_CANDIDATES)
    .sort((a, b) => a.index - b.index)
    .map(({ block }) => block)
}
