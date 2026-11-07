import { DOCUMENT } from '@angular/common'
import { Injectable, inject } from '@angular/core'
import { AiService } from '../../ai/ai.service'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import {
  ExtractedTable,
  TablesDownloadFormat,
  buildExtractPrompt,
  parseExtractedTables,
  stripTableHtml,
  tablesToZipEntries
} from './table-formats'
import { buildZip } from './zip'

export const TABLES_ZIP_NAME = 'extracted-tables.zip'

@Injectable()
export class TablesExtractorService {
  readonly #ai = inject(AiService)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)

  collectTables(): string[] {
    return Array.from(this.#document.querySelectorAll('table'))
      .filter((table) => !this.#host.contains(table))
      .map(stripTableHtml)
  }

  async extract(
    userPrompt: string,
    signal?: AbortSignal
  ): Promise<ExtractedTable[]> {
    const answers = await Promise.all(
      this.collectTables().map((html) =>
        this.#ai.prompt({
          userPrompt: buildExtractPrompt(html, userPrompt),
          agentMode: true,
          signal
        })
      )
    )
    return answers.flatMap(parseExtractedTables)
  }

  download(tables: ExtractedTable[], format: TablesDownloadFormat): void {
    const url = URL.createObjectURL(
      buildZip(tablesToZipEntries(tables, format))
    )
    const anchor = this.#document.createElement('a')
    anchor.href = url
    anchor.download = TABLES_ZIP_NAME
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
