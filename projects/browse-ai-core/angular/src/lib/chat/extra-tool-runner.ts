import { Injectable, inject } from '@angular/core'
import { ArgumentMapperService } from '../tools/argument-mapper/argument-mapper.service'
import { DarkPatternDetectorService } from '../tools/dark-patterns/dark-pattern-detector.service'
import { DictationService } from '../tools/dictation/dictation.service'
import { ExtraToolId } from '../tools/extra-tools'
import { FormValidatorService } from '../tools/form-validator/form-validator.service'
import { LinkInspectorService } from '../tools/link-inspector/link-inspector.service'
import { NotesService } from '../tools/notes/notes.service'
import { PerformanceExplainerService } from '../tools/performance/performance-explainer.service'
import { PhishingCheckService } from '../tools/phishing-check/phishing-check.service'
import { ReplyDrafterService } from '../tools/reply-drafter/reply-drafter.service'
import { ResearchService } from '../tools/research/research.service'
import { ReviewSummarizerService } from '../tools/review-summarizer/review-summarizer.service'
import type { ToolRequest, ToolResult } from './tool-runner'

/** Runs the tools from specs T-002 to T-012. */
@Injectable()
export class ExtraToolRunner {
  readonly links = inject(LinkInspectorService)
  readonly reply = inject(ReplyDrafterService)
  readonly notes = inject(NotesService)
  readonly reviews = inject(ReviewSummarizerService)
  readonly research = inject(ResearchService)
  readonly argument = inject(ArgumentMapperService)
  readonly form = inject(FormValidatorService)
  readonly dictation = inject(DictationService)
  readonly performance = inject(PerformanceExplainerService)
  readonly phishing = inject(PhishingCheckService)
  readonly darkPatterns = inject(DarkPatternDetectorService)

  run(tool: ExtraToolId, request: ToolRequest): Promise<ToolResult> {
    const services: Record<
      ExtraToolId,
      { run(request: ToolRequest): Promise<ToolResult> }
    > = {
      'link-inspector': this.links,
      'reply-drafter': this.reply,
      notes: this.notes,
      'review-summarizer': this.reviews,
      'research-notes': this.research,
      'argument-mapper': this.argument,
      'form-validator': this.form,
      dictation: this.dictation,
      'performance-explainer': this.performance,
      'phishing-check': this.phishing,
      'dark-pattern-detector': this.darkPatterns
    }
    return services[tool].run(request)
  }

  /** Removes page markers (new chat or destroy). */
  reset(): void {
    this.form.clear()
    this.darkPatterns.clear()
    this.reply.reset()
  }
}
