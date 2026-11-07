import { DOCUMENT } from '@angular/common'
import { Injectable, inject } from '@angular/core'
import { BrowseAiCoreStrings, formatString } from 'browse-ai-core'
import { AiService } from '../../ai/ai.service'
import { parseJsonFromModelResponse } from '../../ai/json-response'
import type { FormIssue } from '../../chat/tool-card.model'
import type { ToolRequest, ToolResult } from '../../chat/tool-runner'
import { ConfigStore } from '../../core/config.store'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import { FieldTrackerService } from '../../page/field-tracker.service'
import { isSensitiveField } from '../../page/insert-text'
import { MarkerLayer } from '../../page/marker-layer'
import { FormControlElement } from '../form-filler/form-field.model'
import { extractFieldLabel } from '../form-filler/form-field-scanner'
import {
  RuleId,
  RuleProblem,
  checkField,
  formFields,
  pickForm
} from './form-rules'

const RULE_STRINGS: Record<RuleId, keyof BrowseAiCoreStrings> = {
  valueMissing: 'ruleValueMissing',
  typeMismatch: 'ruleTypeMismatch',
  patternMismatch: 'rulePatternMismatch',
  tooShort: 'ruleTooShort',
  tooLong: 'ruleTooLong',
  rangeUnderflow: 'ruleRangeUnderflow',
  rangeOverflow: 'ruleRangeOverflow',
  stepMismatch: 'ruleStepMismatch',
  email: 'ruleEmail',
  confirm: 'ruleConfirm',
  spaces: 'ruleSpaces',
  pastDate: 'rulePastDate'
}

export function fixedMessage(
  strings: BrowseAiCoreStrings,
  rule: RuleId
): string {
  return strings[RULE_STRINGS[rule]] as string
}

/** Prompt with labels, rules and values. Sensitive values are never included. */
export function buildExplainPrompt(problems: RuleProblem[]): string {
  return [
    'Explain each form field problem below to the user in one short, plain sentence. Include an example of a valid value when it helps.',
    ...problems.map((problem, index) => {
      const value = isSensitiveField(problem.element)
        ? '(hidden)'
        : JSON.stringify(problem.element.value ?? '')
      const detail = problem.detail ? ` (${problem.detail})` : ''
      return `[${index}] Field: ${extractFieldLabel(problem.element) || problem.element.name}. Rule broken: ${problem.rule}${detail}. Current value: ${value}`
    }),
    'Answer only with JSON: {"messages":[{"index":<number>,"message":"<sentence>"}]}'
  ].join('\n')
}

export function parseExplanations(
  answer: string,
  count: number
): Map<number, string> {
  const json = parseJsonFromModelResponse(answer) as {
    messages?: unknown
  } | null
  const result = new Map<number, string>()
  if (!Array.isArray(json?.messages)) return result
  for (const entry of json.messages as {
    index?: unknown
    message?: unknown
  }[]) {
    if (
      typeof entry?.index === 'number' &&
      entry.index >= 0 &&
      entry.index < count &&
      typeof entry.message === 'string' &&
      entry.message.trim()
    ) {
      result.set(entry.index, entry.message.trim())
    }
  }
  return result
}

/** Checks a form before it is sent and marks the problems on the page. */
@Injectable()
export class FormValidatorService {
  readonly #ai = inject(AiService)
  readonly #tracker = inject(FieldTrackerService)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly #strings = inject(ConfigStore).strings
  #layer: MarkerLayer | null = null
  #fields = new Map<string, FormControlElement>()
  #fieldList: FormControlElement[] = []

  async run(request: ToolRequest): Promise<ToolResult> {
    const strings = this.#strings()
    this.clear()
    const root = pickForm(this.#document, this.#tracker.form())
    const fields = root
      ? formFields(root).filter((field) => !this.#host.contains(field))
      : []
    if (fields.length === 0) return { content: strings.noFormFields }

    this.#fieldList = fields
    const problems = fields.flatMap((field, index) =>
      checkField(field, index > 0 ? fields[index - 1] : null)
    )
    if (problems.length === 0) return { content: strings.formLooksValid }

    let messages = new Map<number, string>()
    if (this.#ai.isModelReady()) {
      try {
        const answer = await this.#ai.prompt({
          userPrompt: buildExplainPrompt(problems),
          agentMode: true,
          signal: request.signal
        })
        messages = parseExplanations(answer, problems.length)
      } catch (error) {
        if (request.signal.aborted) throw error
      }
    }

    const issues: FormIssue[] = problems.map((problem, index) => {
      const fieldId = `field-${fields.indexOf(problem.element)}`
      this.#fields.set(fieldId, problem.element)
      return {
        fieldId,
        label:
          extractFieldLabel(problem.element) ||
          problem.element.name ||
          problem.element.type,
        message: messages.get(index) ?? fixedMessage(strings, problem.rule)
      }
    })
    this.#showMarkers(issues)
    return {
      content: formatString(strings.formProblems, { count: issues.length }),
      extra: { card: { kind: 'form-issues', issues } }
    }
  }

  /** Scrolls to a field and focuses it. */
  show(fieldId: string): void {
    const field = this.#fields.get(fieldId)
    if (!field?.isConnected) return
    field.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    field.focus({ preventScroll: true })
  }

  get markerCount(): number {
    return this.#layer?.size ?? 0
  }

  clear(): void {
    for (const field of this.#fields.values())
      field.removeEventListener('input', this.#recheck)
    this.#layer?.destroy()
    this.#layer = null
    this.#fields.clear()
  }

  #showMarkers(issues: FormIssue[]): void {
    this.#layer = new MarkerLayer({
      doc: this.#document,
      themeSource: this.#host
    })
    this.#layer.show(
      issues.map((issue, index) => ({
        id: issue.fieldId,
        element: this.#fields.get(issue.fieldId)!,
        badge: String(index + 1),
        title: issue.label,
        text: issue.message
      }))
    )
    for (const field of this.#fields.values())
      field.addEventListener('input', this.#recheck)
  }

  /** Checks a marked field again when it changes, and removes fixed markers. */
  readonly #recheck = (event: Event): void => {
    const field = event.currentTarget as FormControlElement
    const entry = [...this.#fields].find(([, element]) => element === field)
    if (!entry || !this.#layer) return
    const index = this.#fieldList.indexOf(field)
    const problems = checkField(
      field,
      index > 0 ? this.#fieldList[index - 1] : null
    )
    if (problems.length === 0) {
      this.#layer.remove(entry[0])
      field.removeEventListener('input', this.#recheck)
    }
  }
}
