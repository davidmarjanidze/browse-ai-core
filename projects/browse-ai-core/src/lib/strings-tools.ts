import { TOOL_STRINGS_AGENTS } from './strings-tools-agents'
import { TOOL_STRINGS_PAGE } from './strings-tools-page'

/**
 * UI text for the tools added after the first release. Spread into
 * `DEFAULT_STRINGS`, so it can be changed the same way.
 */
export const TOOL_STRINGS = {
  toolGroupForms: 'Forms',
  toolGroupAgents: 'Agents',
  toolGroupRead: 'Read & understand',
  toolGroupWrite: 'Write',
  toolGroupSave: 'Save & extract',
  toolGroupSafety: 'Safety',
  toolGroupDeveloper: 'Developer',

  showOnPage: 'Show on page',
  openLink: 'Open link',
  pickField: 'Pick field',
  clearMarks: 'Clear marks',
  copyMarkdown: 'Copy as Markdown',
  exportMarkdown: 'Export',
  showAsTable: 'Show as table',
  showAsChart: 'Show as chart',
  targetField: 'Text box:',
  noTargetField: 'No text box picked. Click one on the page.',
  fieldPickerActive: 'Click a text box on the page.',

  linkInspectorName: 'Link Inspector',
  linkInspectorDescription:
    'Lists the links on this page and finds the one you ask for',
  linkInspectorNotes: [
    'Send without text to see all links on the page in groups.',
    'Or ask for a link, for example: where is the pricing page?',
    'Click Show on page to scroll to a link.'
  ],
  linkGroupInternal: 'Internal',
  linkGroupExternal: 'External',
  linkGroupDownload: 'Downloads',
  linkGroupContact: 'Email and phone',
  linkGroupSuspicious: 'Suspicious',
  linksFound: '{count} link(s) on this page.',
  linksMatched: 'These links match what you asked for:',
  noLinks: 'No links were found on this page.',
  noMatchingLinks: 'No link matches what you asked for. Here are all links.',
  linkTimes: '{count} times',

  replyDrafterName: 'Reply Drafter',
  replyDrafterDescription: 'Drafts a reply for a text box on this page',
  replyDrafterNotes: [
    'Click the box on the page where the reply should go, or use Pick field.',
    'Pick the tone and length. Add instructions if you want, for example: thank them and say no.',
    'Send. Check the draft, then click Insert to put it in the box.'
  ],
  tone: 'Tone',
  toneFormal: 'Formal',
  toneNeutral: 'Neutral',
  toneCasual: 'Casual',
  length: 'Length',
  lengthShort: 'Short',
  lengthMedium: 'Medium',
  lengthLong: 'Long',
  insert: 'Insert',
  redo: 'Redo',
  replace: 'Replace',
  addToEnd: 'Add to end',
  replaceOrAdd:
    'The box already has text. Replace it or add the draft at the end?',
  noReplyField: 'Pick the text box for the reply first.',
  replyInserted: 'Reply inserted.',
  replyFieldGone:
    'The text box is no longer on the page. Copy the reply instead.',
  replyCut: 'The reply was cut to fit the box ({max} characters).',

  notes: 'Notes',
  notesName: 'Notes',
  notesDescription: 'Makes notes for this page and saves them',
  notesNotes: [
    'Send to make notes for this whole page. Add text to focus on one topic.',
    'Or select text on the page and click Save note.',
    'Open Notes from the menu (three dots) to see notes by website and page.'
  ],
  saveNote: 'Save note',
  noteSaved: 'Note saved.',
  noteSavedWithoutAi: 'Text saved. The AI note could not be made.',
  notesSaved: '{count} note(s) saved for this page.',
  openInNotes: 'Open in Notes',
  noNotes: 'No notes yet.',
  searchNotes: 'Search notes',
  notesPages: '{count} page(s)',
  notesCount: '{count} note(s)',
  deleteNote: 'Delete note',
  deletePage: 'Delete page',
  deletePageConfirm: 'Delete all notes for this page?',
  copyNote: 'Copy note',
  notesSaveFailed: 'Could not save the notes.',
  noNotesMade: 'No notes could be made for this page.',

  reviewSummarizerName: 'Review Summarizer',
  reviewSummarizerDescription: 'Sums up the reviews on this page',
  reviewSummarizerNotes: [
    'Open a page with reviews. Scroll or click Show more first if you want more reviews included.',
    'Send without text for a full summary, or name a topic, for example: battery life.',
    'Only reviews loaded on the page are read.'
  ],
  noReviews: 'No reviews were found on this page.',
  reviewsBasis: 'Based on {count} reviews visible on this page.',
  reviewsRead: 'Reviews read',
  averageRating: 'Average rating',
  pros: 'Pros',
  cons: 'Cons',
  complaints: 'Common complaints',
  verdict: 'Verdict',
  ratingBreakdown: 'Rating breakdown',
  stars: '{count} stars',

  researchNotesName: 'Research Notes',
  researchNotesDescription:
    'Saves pages into a topic and answers questions across them',
  researchNotesNotes: [
    'Pick a topic or make a new one.',
    'On each page you read, send without text to add the page to the topic.',
    'Ask a question to get an answer from all saved pages, with links to the sources.'
  ],
  topic: 'Topic',
  newTopic: 'New topic…',
  topicName: 'Topic name',
  createTopic: 'Create',
  renameTopic: 'Rename topic',
  deleteTopic: 'Delete topic',
  deleteTopicConfirm: 'Delete this topic and all its pages?',
  showPages: 'Show pages',
  removePage: 'Remove page',
  noTopic: 'Pick or create a topic first.',
  researchPageAdded: 'Page added to {topic}. {count} page(s) in {topic}.',
  researchPageUpdated: 'Page updated in {topic}. {count} page(s) in {topic}.',
  researchTopicFull: 'This topic has the maximum of {max} pages.',
  researchTopicEmpty:
    'This topic has no pages yet. Send without text to add this page.',
  researchPageShort:
    'This page has very little text, so its summary may be thin.',
  researchSaveFailed: 'Could not save the research topic.',
  sources: 'Sources',

  argumentMapperName: 'Argument Mapper',
  argumentMapperDescription:
    'Shows the main claim with the points for and against it',
  argumentMapperNotes: [
    'Open an opinion piece or discussion. Select a part of it if you only want that part.',
    'Send. You get the main claim with points for and against it.',
    'Click Show on page to see where a point is in the text.'
  ],
  mainClaim: 'Main claim',
  supportPoints: 'Points for',
  counterPoints: 'Points against',
  evidenceQuote: 'Quote',
  evidenceData: 'Data',
  evidenceSource: 'Source',
  evidenceNone: 'No evidence',
  noArgumentFound: 'No clear argument was found in this text.',

  ...TOOL_STRINGS_PAGE,
  ...TOOL_STRINGS_AGENTS
}
