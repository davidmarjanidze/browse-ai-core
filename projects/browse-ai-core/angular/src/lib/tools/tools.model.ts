import {
  BUILT_IN_TOOL_IDS,
  BrowseAiCoreFeatures,
  BrowseAiCoreStrings,
  BuiltInToolId
} from 'browse-ai-core'

export type ToolId =
  | 'form-filler'
  | 'tables-extractor'
  | 'dom-to-component'
  | 'image-downloader'
  | 'subject-finder'
  | BuiltInToolId

export const DOM_COMPONENT_FRAMEWORKS = {
  Angular: 'angular',
  React: 'react',
  VueJs: 'vue.js',
  JavaScript: 'javascript'
} as const

export type DomToComponentFramework =
  (typeof DOM_COMPONENT_FRAMEWORKS)[keyof typeof DOM_COMPONENT_FRAMEWORKS]

export interface ToolInfo {
  id: ToolId
  name: string
  description: string
  notes: string[]
  /** The tool works without a text prompt. */
  promptOptional: boolean
}

/**
 * Tools turned on in `features`, with names from `strings`. Built-in AI tools
 * are listed only when `isBuiltInListed` returns true for them.
 */
export function getTools(
  features: BrowseAiCoreFeatures,
  strings: BrowseAiCoreStrings,
  isBuiltInListed: (tool: BuiltInToolId) => boolean = () => false,
  supportsImageInput = true
): ToolInfo[] {
  const tools: (ToolInfo | false)[] = [
    features.formFiller && {
      id: 'form-filler',
      name: strings.formFillerName,
      description: strings.formFillerDescription,
      notes: strings.formFillerNotes,
      promptOptional: false
    },
    features.tablesExtractor && {
      id: 'tables-extractor',
      name: strings.tablesExtractorName,
      description: strings.tablesExtractorDescription,
      notes: strings.tablesExtractorNotes,
      promptOptional: true
    },
    features.domToComponent && {
      id: 'dom-to-component',
      name: strings.domToComponentName,
      description: strings.domToComponentDescription,
      notes: strings.domToComponentNotes,
      promptOptional: true
    },
    features.imageDownloader &&
      supportsImageInput && {
        id: 'image-downloader',
        name: strings.imageDownloaderName,
        description: strings.imageDownloaderDescription,
        notes: strings.imageDownloaderNotes,
        promptOptional: false
      },
    features.subjectFinder && {
      id: 'subject-finder',
      name: strings.subjectFinderName,
      description: strings.subjectFinderDescription,
      notes: strings.subjectFinderNotes,
      promptOptional: false
    }
  ]
  for (const id of BUILT_IN_TOOL_IDS) {
    if (!features[id] || !isBuiltInListed(id)) continue
    tools.push({
      id,
      name: strings[`${id}Name`],
      description: strings[`${id}Description`],
      notes: strings[`${id}Notes`],
      promptOptional: false
    })
  }
  return tools.filter((tool): tool is ToolInfo => tool !== false)
}
