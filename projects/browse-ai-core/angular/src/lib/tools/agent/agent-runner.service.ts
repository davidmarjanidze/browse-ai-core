import { DOCUMENT } from '@angular/common'
import { DestroyRef, Injectable, inject, signal } from '@angular/core'
import {
  AiPromptInput,
  AiSession,
  formatString,
  getSessionOptions
} from 'browse-ai-core'
import { AiService } from '../../ai/ai.service'
import {
  isSessionNearlyFull,
  promptWithSchema
} from '../../ai/constrained-prompt'
import {
  GenerationStoppedError,
  isGenerationStopped,
  isQuotaExceededError
} from '../../ai/stream-reader'
import { ChatEvents } from '../../chat/chat-events'
import type { ToolRequest, ToolResult } from '../../chat/tool-runner'
import { ToolNotices } from '../../chat/tool-notices'
import { ConfigStore } from '../../core/config.store'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import { SnipCaptureService } from '../../page/snip-capture.service'
import {
  AgentCall,
  AgentStepRecord,
  agentResponseSchema,
  buildAgentSystemPrompt,
  buildStepPrompt,
  parseAgentCall
} from './agent-protocol'
import { captureWithRefs, flashElement, shrinkImage } from './agent-screen'
import { AgentTool, AgentToolContext, agentTools } from './agent-tools'
import { RefMap, formatSnapshot, nameOf, takeSnapshot } from './page-snapshot'
import { waitForIdle } from './page-waits'
import { RiskReason, riskOf } from './risk-check'

/** Wrong answers in a row before the run ends. */
export const MAX_BAD_ANSWERS = 3
/** Wait for the page to settle after an action, in ms. */
const SETTLE_MS = 3_000
/** Start a new model session when this share of its context is used. */
const CONTEXT_LIMIT = 0.75

export interface AgentStepView {
  step: number
  tool: string
  target: string
  status: AgentStepRecord['status']
}

export interface AgentConfirmation {
  tool: string
  target: string
  reason: Exclude<RiskReason, null>
}

type Ending = { status: 'done' | 'failed' | 'stopped' | 'limit'; text: string }

/** Runs Agent Mode: observe the page, ask the model for one step, run it, repeat. */
@Injectable()
export class AgentRunnerService {
  readonly #ai = inject(AiService)
  readonly #config = inject(ConfigStore)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly #snip = inject(SnipCaptureService)
  readonly #events = inject(ChatEvents)
  readonly #notices = inject(ToolNotices)

  readonly running = signal(false)
  readonly steps = signal<AgentStepView[]>([])
  /** Question from `ask_user`, waiting for the user's next message. */
  readonly question = signal<string | null>(null)
  /** Instructions the user sent while the run is going, oldest first. */
  readonly updates = signal<string[]>([])
  /** Risky step waiting for Allow or Deny. */
  readonly confirmation = signal<AgentConfirmation | null>(null)

  #onAnswer: ((text: string) => void) | null = null
  #onDecision: ((allow: boolean) => void) | null = null

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reset())
  }

  /** Screenshots need a capture adapter and a model with image input. */
  canScreenshot(): boolean {
    return (
      this.#config.config().screenCapture !== null &&
      this.#ai.supportsImageInput()
    )
  }

  /** Adds an instruction from the user. The agent reads it at its next step. */
  steer(text: string): void {
    if (!this.running() || !text.trim()) return
    this.updates.update((updates) => [...updates, text.trim()])
  }

  answer(text: string): void {
    const resolve = this.#onAnswer
    this.#onAnswer = null
    this.question.set(null)
    resolve?.(text)
  }

  decide(allow: boolean): void {
    const resolve = this.#onDecision
    this.#onDecision = null
    this.confirmation.set(null)
    resolve?.(allow)
  }

  reset(): void {
    this.decide(false)
    this.#onAnswer = null
    this.question.set(null)
    this.steps.set([])
    this.updates.set([])
  }

  async run(request: ToolRequest): Promise<ToolResult> {
    const strings = this.#config.strings()
    const { maxSteps, maxDurationMs } = this.#config.config().agent
    const withScreens = this.canScreenshot()
    const tools = agentTools(withScreens)
    const refs = new RefMap()
    const records: AgentStepRecord[] = []
    const abort = new AbortController()
    const stopOuter = (): void => abort.abort()
    request.signal.addEventListener('abort', stopOuter, { once: true })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      abort.abort()
    }, maxDurationMs)
    let image: Blob | null = null
    let session: AiSession | null = null

    const context: AgentToolContext = {
      doc: this.#document,
      host: this.#host,
      refs,
      signal: abort.signal,
      screenshot: async () => {
        const dataUrl = await captureWithRefs(
          this.#document,
          this.#host,
          refs,
          () => this.#snip.captureVisibleArea()
        )
        image = await shrinkImage(dataUrl)
      },
      askUser: (question) => this.#ask(question, abort.signal)
    }

    this.steps.set([])
    this.updates.set([])
    let seenUpdates = 0
    this.running.set(true)
    let ending: Ending = { status: 'stopped', text: '' }
    try {
      session = await this.#newSession(tools, withScreens)
      let recap = false
      let note: string | undefined
      let bad = 0
      for (;;) {
        if (abort.signal.aborted) throw new GenerationStoppedError()
        if (records.length >= maxSteps) {
          ending = {
            status: 'limit',
            text: formatString(strings.agentLimitSteps, {
              count: records.length
            })
          }
          break
        }
        const page = formatSnapshot(
          takeSnapshot(this.#document, this.#host, refs)
        )
        const updates = this.updates()
        const prompt = buildStepPrompt({
          task: request.text,
          page,
          steps: records,
          recap,
          note,
          hasImage: image !== null,
          updates,
          newUpdate: updates.length > seenUpdates
        })
        seenUpdates = updates.length
        const sent = image
        image = null
        recap = false
        note = undefined

        let answer: string
        try {
          answer = await this.#prompt(
            session,
            prompt,
            sent,
            tools,
            abort.signal
          )
        } catch (error) {
          if (!isQuotaExceededError(error)) throw error
          session.destroy?.()
          session = await this.#newSession(tools, withScreens)
          recap = true
          continue
        }
        if (isSessionNearlyFull(session, CONTEXT_LIMIT)) {
          session.destroy?.()
          session = await this.#newSession(tools, withScreens)
          recap = true
        }

        const call = parseAgentCall(answer, tools)
        if ('error' in call) {
          if (++bad >= MAX_BAD_ANSWERS) throw new Error(strings.agentBadAnswers)
          note = `${call.error} Answer again with one JSON object.`
          continue
        }
        bad = 0
        const tool = tools.find((entry) => entry.name === call.tool)!
        if (call.tool === 'done' || call.tool === 'fail') {
          if (this.updates().length > seenUpdates) {
            note =
              'The user sent a new instruction before you finished. Read USER UPDATES and go on.'
            continue
          }
          const text = String(await tool.run(call.args, context))
          this.#record(
            records,
            call,
            '',
            call.tool === 'done' ? 'ok' : 'error',
            text
          )
          ending =
            call.tool === 'done'
              ? { status: 'done', text: text || strings.agentDone }
              : {
                  status: 'failed',
                  text: formatString(strings.agentFailed, { reason: text })
                }
          break
        }
        await this.#runStep(tool, call, context, records)
      }
    } catch (error) {
      if (timedOut) {
        ending = {
          status: 'limit',
          text: formatString(strings.agentLimitTime, {
            minutes: Math.round(maxDurationMs / 60_000)
          })
        }
      } else if (isGenerationStopped(error) || abort.signal.aborted) {
        ending = {
          status: 'stopped',
          text: formatString(strings.agentStopped, { count: records.length })
        }
      } else {
        const reason = error instanceof Error ? error.message : String(error)
        ending = {
          status: 'failed',
          text: formatString(strings.agentFailed, { reason })
        }
      }
    } finally {
      clearTimeout(timer)
      request.signal.removeEventListener('abort', stopOuter)
      session?.destroy?.()
      this.running.set(false)
      this.question.set(null)
      this.#onAnswer = null
      this.decide(false)
    }
    return { content: this.#finish(ending.status, ending.text, records, tools) }
  }

  async #runStep(
    tool: AgentTool,
    call: AgentCall,
    context: AgentToolContext,
    records: AgentStepRecord[]
  ): Promise<void> {
    const strings = this.#config.strings()
    const element =
      call.args['ref'] !== undefined
        ? context.refs.get(Number(call.args['ref']))
        : null
    const label = element
      ? nameOf(element).slice(0, 50) || element.tagName.toLowerCase()
      : this.#argsLabel(call)
    const skipsRisk =
      (call.tool === 'press_key' && call.args['key'] !== 'Enter') ||
      (call.tool === 'type_text' && call.args['submit'] !== true)
    const reason = skipsRisk
      ? null
      : riskOf(
          call.tool,
          element,
          this.#document,
          this.#config.config().agent.confirm,
          strings.agentRiskWords
        )
    if (
      reason &&
      !(await this.#confirm(
        { tool: call.tool, target: label, reason },
        context.signal
      ))
    ) {
      this.#record(
        records,
        call,
        label,
        'denied',
        'The user denied this step. Do something else or ask the user.'
      )
      return
    }
    let status: AgentStepRecord['status'] = 'ok'
    let result: string
    try {
      if (element && tool.changesPage)
        flashElement(this.#document, element, this.#color())
      result = String(await tool.run(call.args, context))
    } catch (error) {
      if (isGenerationStopped(error) || context.signal.aborted) throw error
      status = 'error'
      result = error instanceof Error ? error.message : String(error)
    }
    if (status === 'ok' && tool.changesPage) {
      await waitForIdle(this.#document, SETTLE_MS, context.signal)
    }
    this.#record(records, call, label, status, result)
  }

  #record(
    records: AgentStepRecord[],
    call: AgentCall,
    target: string,
    status: AgentStepRecord['status'],
    result: string
  ): void {
    const step = records.length + 1
    records.push({ step, tool: call.tool, args: call.args, status, result })
    this.steps.update((steps) => [
      ...steps,
      { step, tool: call.tool, target, status }
    ])
    this.#events.agentStep.next({
      step,
      tool: call.tool,
      args: call.args,
      result: `${status}: ${result.slice(0, 300)}`
    })
  }

  #finish(
    status: 'done' | 'failed' | 'stopped' | 'limit',
    text: string,
    records: AgentStepRecord[],
    tools: readonly AgentTool[]
  ): string {
    this.#events.agentFinished.next({ status, summary: text })
    if (!records.length || !tools.length) return text
    const strings = this.#config.strings()
    const label = {
      ok: strings.agentResultOk,
      error: strings.agentResultError,
      denied: strings.agentResultDenied
    }
    const steps = this.steps()
      .map(
        (step) =>
          `${step.step}. ${step.tool}${step.target ? ` — ${step.target}` : ''} (${label[step.status]})`
      )
      .join('\n')
    return `${text}\n\n**${strings.agentSteps}**\n\n${steps}`
  }

  #argsLabel(call: AgentCall): string {
    const value =
      call.args['text'] ??
      call.args['selector'] ??
      call.args['key'] ??
      call.args['direction'] ??
      call.args['ms'] ??
      call.args['question']
    return value === undefined ? '' : String(value).slice(0, 50)
  }

  #color(): string {
    return (
      getComputedStyle(this.#host).getPropertyValue('--bac-primary').trim() ||
      '#2563eb'
    )
  }

  #ask(question: string, signal: AbortSignal): Promise<string> {
    this.#notices.post(
      formatString(this.#config.strings().agentQuestion, { question })
    )
    return new Promise((resolve, reject) => {
      const onAbort = (): void => reject(new GenerationStoppedError())
      signal.addEventListener('abort', onAbort, { once: true })
      this.question.set(question)
      this.#onAnswer = (text) => {
        signal.removeEventListener('abort', onAbort)
        resolve(`The user answered: ${text}`)
      }
    })
  }

  #confirm(
    confirmation: AgentConfirmation,
    signal: AbortSignal
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const onAbort = (): void => reject(new GenerationStoppedError())
      signal.addEventListener('abort', onAbort, { once: true })
      this.confirmation.set(confirmation)
      this.#onDecision = (allow) => {
        signal.removeEventListener('abort', onAbort)
        resolve(allow)
      }
    })
  }

  #newSession(
    tools: readonly AgentTool[],
    withImages: boolean
  ): Promise<AiSession> {
    const config = this.#config.config()
    const base = getSessionOptions(config)
    return config.aiProvider.createSession({
      ...base,
      systemPrompt: buildAgentSystemPrompt(tools),
      initialPrompts: undefined,
      expectedInputs: withImages ? ['text', 'image'] : ['text']
    })
  }

  #prompt(
    session: AiSession,
    text: string,
    image: Blob | null,
    tools: readonly AgentTool[],
    signal: AbortSignal
  ): Promise<string> {
    const input: AiPromptInput = image
      ? [
          {
            role: 'user',
            content: [
              { type: 'text', value: text },
              { type: 'image', value: image }
            ]
          }
        ]
      : text
    return promptWithSchema(session, input, agentResponseSchema(tools), signal)
  }
}
