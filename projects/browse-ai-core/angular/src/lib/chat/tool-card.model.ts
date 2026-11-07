import type { LinkRow } from '../tools/link-inspector/link-scanner'

/** Data the newer tools attach to their answer, drawn by `bac-tool-card`. */

export interface ReviewStats {
  count: number
  /** Reviews that had a rating. */
  rated: number
  average: number | null
  /** Count per star, index 0 is 1 star. */
  perStar: number[]
}

export interface ResearchSource {
  n: number
  title: string
  url: string
}

export type Evidence = 'quote' | 'data' | 'source' | 'none'

export interface ArgumentPoint {
  type: 'support' | 'counter'
  text: string
  evidence: Evidence
  quote: string
  points: ArgumentPoint[]
}

export interface ArgumentMap {
  claim: string
  points: ArgumentPoint[]
}

export interface FormIssue {
  fieldId: string
  label: string
  message: string
}

export type RiskLevel = 'low' | 'medium' | 'high'

export interface RiskSignal {
  id: string
  text: string
  /** Index of the element to show, kept by the service. */
  elementId?: number
}

export type DarkPatternType =
  | 'prechecked'
  | 'timer'
  | 'scarcity'
  | 'shaming'
  | 'weak-decline'
  | 'sneak'
  | 'hard-cancel'

export interface DarkPatternFinding {
  n: number
  type: DarkPatternType
  evidence: string
  why: string
  canUncheck: boolean
}

export type ToolCard =
  | { kind: 'links'; links: LinkRow[]; matched: boolean }
  | { kind: 'reply'; fieldLabel: string }
  | { kind: 'notes'; url: string }
  | { kind: 'reviews'; stats: ReviewStats }
  | { kind: 'research'; sources: ResearchSource[] }
  | { kind: 'research-pages'; topicId: string }
  | { kind: 'argument'; map: ArgumentMap }
  | { kind: 'form-issues'; issues: FormIssue[] }
  | { kind: 'performance' }
  | { kind: 'phishing'; level: RiskLevel; signals: RiskSignal[] }
  | { kind: 'dark-patterns'; findings: DarkPatternFinding[] }
