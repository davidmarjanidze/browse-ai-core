import { parseJsonFromModelResponse } from '../../ai/json-response'
import { ZipEntry } from './zip'

export interface ExtractedTable {
  title: string
  headers: string[]
  rows: string[][]
}

export type TablesDownloadFormat = 'csv' | 'excel' | 'json' | 'markdown'

export function tableToCsv(table: ExtractedTable): string {
  const escape = (value: string): string => `"${value.replace(/"/g, '""')}"`
  return [table.headers, ...table.rows]
    .filter((row) => row.length > 0)
    .map((row) => row.map(escape).join(','))
    .join('\n')
}

/** Tab-separated text, which Excel opens as a sheet. */
export function tableToTsv(table: ExtractedTable): string {
  return [table.headers, ...table.rows]
    .filter((row) => row.length > 0)
    .map((row) => row.join('\t'))
    .join('\n')
}

export function tableToMarkdown(table: ExtractedTable): string {
  const headers = table.headers.length ? table.headers : ['Column 1']
  const rows = table.rows.length ? table.rows : [['']]
  return [
    `# ${table.title}`,
    '',
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n')
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

const FORMATS: Record<
  TablesDownloadFormat,
  { extension: string; write: (table: ExtractedTable) => string }
> = {
  csv: { extension: 'csv', write: tableToCsv },
  excel: { extension: 'xls', write: tableToTsv },
  json: { extension: 'json', write: (table) => JSON.stringify(table, null, 2) },
  markdown: { extension: 'md', write: tableToMarkdown }
}

export function tablesToZipEntries(
  tables: ExtractedTable[],
  format: TablesDownloadFormat
): ZipEntry[] {
  const { extension, write } = FORMATS[format]
  return tables.map((table, index) => {
    const number = String(index + 1).padStart(2, '0')
    const name = slug(table.title) || `table-${index + 1}`
    return { name: `${number}-${name}.${extension}`, content: write(table) }
  })
}

/** Reads `[{ title, headers, rows }]` from a model answer. */
export function parseExtractedTables(content: string): ExtractedTable[] {
  const parsed = parseJsonFromModelResponse(content)
  if (!Array.isArray(parsed)) return []

  return parsed.flatMap((entry): ExtractedTable[] => {
    if (!entry || typeof entry !== 'object') return []
    const candidate = entry as Record<string, unknown>
    const cells = (value: unknown): string[] =>
      Array.isArray(value) ? value.map((cell) => String(cell ?? '').trim()) : []
    const headers = cells(candidate['headers'])
    const rows = Array.isArray(candidate['rows'])
      ? candidate['rows'].filter(Array.isArray).map(cells)
      : []
    if (!headers.length && !rows.length) return []
    return [
      {
        title: String(candidate['title'] ?? '').trim() || 'Table',
        headers,
        rows
      }
    ]
  })
}

/** A copy of the table's HTML without attributes, to keep prompts short. */
export function stripTableHtml(table: HTMLTableElement): string {
  const clone = table.cloneNode(true) as HTMLTableElement
  for (const element of [clone, ...Array.from(clone.querySelectorAll('*'))]) {
    for (const name of element.getAttributeNames())
      element.removeAttribute(name)
  }
  return clone.outerHTML
}

export function buildExtractPrompt(
  tableHtml: string,
  userPrompt: string
): string {
  const outputFormat = {
    title: '<string>',
    headers: ['<column name>', '<column name>'],
    rows: [['<cell>', '<cell>']]
  }
  return `
Extract ALL data from these HTML tables into normalized JSON.

Optional user instruction:
${userPrompt || 'No additional instruction provided.'}

TABLE HTML NODES:
${JSON.stringify([tableHtml], null, 2)}

Rules:
- Preserve row order.
- Use table caption/title if available, otherwise generate a short table title.
- Keep rows as arrays aligned to headers length.
- If no valid table data exists, return []

OUTPUT FORMAT:
${JSON.stringify([outputFormat], null, 2)}
`
}
