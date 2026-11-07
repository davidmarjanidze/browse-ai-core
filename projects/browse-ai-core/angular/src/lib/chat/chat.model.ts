import { FormFieldData } from '../tools/form-filler/form-field.model'
import { ExtractedTable } from '../tools/tables/table-formats'
import { ToolCard } from './tool-card.model'

export type { ContextMode } from 'browse-ai-core'

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  error?: boolean
  images?: string[]
  audios?: string[]
  formFillerData?: FormFieldData[] | null
  tablesExtractorData?: ExtractedTable[] | null
  card?: ToolCard | null
}
