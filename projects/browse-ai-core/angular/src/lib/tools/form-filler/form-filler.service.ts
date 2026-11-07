import { DOCUMENT } from '@angular/common'
import { Injectable, inject } from '@angular/core'
import { AiService } from '../../ai/ai.service'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import { FormFieldData } from './form-field.model'
import { fillField, scanFormFields } from './form-field-scanner'
import {
  buildMatchPrompt,
  chunk,
  mergeSuggestions,
  parseMatchedFormFields
} from './form-value-matching'

const FIELDS_PER_PROMPT = 3

export interface ApprovedValue {
  fieldId: string
  value: string
}

/** Suggests values for the form on the page and writes approved ones. */
@Injectable()
export class FormFillerService {
  readonly #ai = inject(AiService)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)

  scan() {
    return scanFormFields(this.#document, this.#host)
  }

  async suggest(
    userPrompt: string,
    signal?: AbortSignal
  ): Promise<FormFieldData[]> {
    const fields = this.scan()
    if (fields.length === 0) return []

    const answers = await Promise.all(
      chunk(fields, FIELDS_PER_PROMPT).map((group) =>
        this.#ai.prompt({
          userPrompt: buildMatchPrompt(group, userPrompt),
          agentMode: true,
          signal
        })
      )
    )

    return mergeSuggestions(fields, answers.flatMap(parseMatchedFormFields))
  }

  /** Returns how many fields were filled. */
  apply(values: ApprovedValue[]): number {
    const fields = new Map(this.scan().map((field) => [field.id, field]))
    return values.filter(({ fieldId, value }) => {
      const field = fields.get(fieldId)
      return field ? fillField(field, value) : false
    }).length
  }
}
