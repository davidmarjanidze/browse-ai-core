import { TOOL_STRINGS } from './strings-tools'

/**
 * All text shown in the UI. Pass `strings` in the config to change any of
 * them, for example to translate the UI. Words in `{braces}` are replaced
 * with values at runtime.
 */
export const DEFAULT_STRINGS = {
  title: 'BrowseAI',
  openChat: 'Open AI chat',
  closeChat: 'Close assistant',
  newChat: 'New chat',
  menu: 'Menu',
  backToChat: 'Back to chat',
  closePanel: 'Close panel',
  settings: 'Settings',
  bookmarks: 'AI Bookmarks',
  contextUsage: '{percent}% of chat memory used',
  notSupported: 'AI features are not supported in this browser.',

  downloadModel: 'Download model',
  downloadingModel: 'Downloading {percent}%',
  downloadSize: '{model} needs about {size} of storage.',
  modelNotReady: 'Download the model before sending a message.',
  responseFailed: 'The AI assistant could not respond.',
  generationStopped: 'Response generation was stopped.',
  inputTooLarge: 'The input is too large.',

  emptyPageTitle: 'Ask about this page',
  emptyPageText: 'Your message uses the full page as context.',
  emptyGeneralTitle: 'Ask anything',
  emptyGeneralText: 'No page context will be included.',
  copyResponse: 'Copy response',
  copied: 'Copied to clipboard',
  generating: 'Generating response',
  userImage: 'Image you sent',

  inputPlaceholder: 'Ask anything',
  send: 'Send message',
  stop: 'Stop generating',
  attachments: 'Add attachment',
  uploadImage: 'Upload image',
  captureVisibleArea: 'Capture visible area',
  snipCapture: 'Snip and capture',
  uploadAudio: 'Upload audio',
  contextModeLabel: 'Context',
  contextPage: 'Page',
  contextGeneral: 'General',
  tools: 'Tools',
  noTool: 'None',
  howToUse: 'How to use {tool}',
  selectedText: 'Selected text:',
  pageContentReduced:
    'The page was too long for the model, so {percent}% of it was cut.',
  attachedImage: 'Attached image',
  removeImage: 'Remove image',
  audioAttached: 'Audio attached',
  removeAudio: 'Remove audio',

  snipHint: 'Drag to capture. Press Esc to cancel.',
  snipStarted: 'Drag to select an area.',
  captureFailed: 'Could not take a screenshot.',
  captureUnavailable: 'Screenshots are not available here.',

  formFillerName: 'Form Filler',
  formFillerDescription:
    'Reads the form on this page and suggests values from your message',
  formFillerNotes: [
    'Open the page with the form before you send the message.',
    'Write the data that should go into the form.',
    'Check each suggestion on the page, then accept or dismiss it.'
  ],
  formSuggestionsReady: 'Form suggestions are ready. Check them on the page.',
  noFormFields: 'No form fields with labels were found on this page.',
  acceptAll: 'Accept all',
  dismissAll: 'Dismiss all',
  accept: 'Accept',
  dismiss: 'Dismiss',
  formFilled: 'Form filled.',
  formFillFailed: 'Could not fill the form.',
  suggestionsDismissed: 'Suggestions dismissed.',

  tablesExtractorName: 'Tables Extractor',
  tablesExtractorDescription:
    'Reads the tables on this page so you can download them',
  tablesExtractorNotes: [
    'Open a page that has HTML tables.',
    'Send the message. Text is optional.',
    'Use the download menu to save CSV, Excel, JSON or Markdown files.'
  ],
  tablesExtracted: 'Tables extracted. Use the download button to save them.',
  noTables: 'No tables were found on this page.',
  tablesReady: '{count} table(s) ready to download.',
  download: 'Download',
  downloadCsv: 'Download CSV',
  downloadExcel: 'Download Excel',
  downloadJson: 'Download JSON',
  downloadMarkdown: 'Download Markdown',
  downloaded: 'Downloaded {file}',

  domToComponentName: 'DOM Element to Component',
  domToComponentDescription: 'Turns an element on the page into a component',
  domToComponentNotes: [
    'Hover the page and click the element you want to convert.',
    'Pick the framework for the generated code.',
    'Send the message. Add extra requirements if you have any.'
  ],
  framework: 'Framework',
  inspectorActive: 'Click an element outside the chat to select it.',
  inspectorHover: 'Hover an element to inspect',
  domElement: 'Element:',
  cancelInspector: 'Cancel',
  elementAttached: 'Element attached. Press Send to generate the component.',
  waitForResponse: 'Wait for the current response to finish.',

  summarizerName: 'Summarizer',
  summarizerDescription: 'Summarizes the text you enter',
  summarizerNotes: [
    'Enter or paste the text in the prompt.',
    'Send it. The answer is the summary of the text.'
  ],
  translatorName: 'Translator',
  translatorDescription: 'Translates the text you enter',
  translatorNotes: [
    'Pick the language to translate to.',
    'Enter the text in the prompt and send it. It will be translated.'
  ],
  writerName: 'Writer',
  writerDescription: 'Writes new text for the task you describe',
  writerNotes: [
    'Describe what to write, for example: an email asking for a day off.',
    'Send it. The answer is the written text.'
  ],
  rewriterName: 'Rewriter',
  rewriterDescription: 'Rewrites the text you enter',
  rewriterNotes: [
    'Enter or paste the text in the prompt.',
    'Send it. The answer is the rewritten text.'
  ],
  proofreaderName: 'Proofreader',
  proofreaderDescription: 'Fixes grammar and spelling in the text you enter',
  proofreaderNotes: [
    'Enter or paste the text in the prompt.',
    'Send it. The answer is the corrected text.'
  ],
  translateTo: 'Translate to',
  downloadToolModel: 'Download the {tool} model',
  downloadingToolModel: 'Downloading the {tool} model... {percent}%',
  toolModelNeeded: 'The {tool} model must be downloaded before you can use it.',
  textTooLong: 'The text is too long for this tool.',
  toolUnavailable: '{tool} is not available in this browser.',
  imageDownloaderName: 'Image Downloader',
  imageDownloaderDescription:
    'Finds images on the screen that show what you describe',
  imageDownloaderNotes: [
    'Describe what the images should show, for example: Download all the images that contain sun or nature.',
    'Only images visible on the screen are checked, one by one.',
    'Use the download button to save the images as a zip file.'
  ],
  checkingImage: 'Checking image {current} of {total}...',
  imagesReady: '{count} image(s) ready to download.',
  noMatchingImages: 'No matching images were found.',
  noVisibleImages: 'No images are visible on the page.',
  imagesSkipped: '{skipped} image(s) could not be read.',
  imagesLimited: 'Only the first {max} images were checked.',
  subjectFinderName: 'Subject Finder',
  subjectFinderDescription:
    'Finds what you are looking for on the page and scrolls to it',
  subjectFinderNotes: [
    'Describe what you are looking for, for example: the text about the platform rules.',
    'Send it. The page scrolls to the best match and highlights it.'
  ],
  subjectFound: 'I scrolled to what you were looking for.',
  subjectNotFound: "I couldn't find what you were looking for.",
  selectionActions: 'AI actions for the selected text',
  summarizerAction: 'Summarize',
  translatorAction: 'Translate',
  writerAction: 'Write',
  rewriterAction: 'Rewrite',
  proofreaderAction: 'Proofread',

  appearance: 'Appearance',
  theme: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'System',
  palette: 'Color palette',
  personalization: 'Personalization',
  nickname: 'Nickname',
  nicknamePlaceholder: 'What should I call you?',
  customInstructions: 'Custom instructions',
  customInstructionsPlaceholder: 'Preferred writing style, tone and rules',
  bookmarksSetting: 'AI bookmarks',
  bookmarksSettingText:
    'Puts every page you open into a category and saves it on this device.',
  selectionActionsSetting: 'Actions on selected text',
  selectionActionsSettingText:
    'Shows Summarize, Translate and other actions when you select text on the page. Only tools with a downloaded model are shown.',
  saveSettings: 'Save settings',
  settingsSaved: 'Settings saved',

  bookmarksText:
    'Categories are created from the page content while AI bookmarks are on.',
  clearAll: 'Clear all',
  clearAllConfirm: 'Clear all saved bookmarks?',
  deleteCategory: 'Delete category',
  deleteBookmark: 'Delete bookmark',
  noBookmarks:
    'No bookmarks yet. Open pages while AI bookmarks are on and they show up here.',
  untitledPage: 'Untitled page',
  ...TOOL_STRINGS
}

export type BrowseAiCoreStrings = typeof DEFAULT_STRINGS

export type BrowseAiCoreStringKey = keyof BrowseAiCoreStrings

/** Replaces `{name}` in `template` with `values.name`. */
export function formatString(
  template: string,
  values: Record<string, string | number> = {}
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  )
}
