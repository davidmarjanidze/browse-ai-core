/** UI text for the form, voice, speed and safety tools. Part of `TOOL_STRINGS`. */
export const TOOL_STRINGS_PAGE = {
  formValidatorName: 'Form Validator',
  formValidatorDescription: 'Checks the form on this page before you send it',
  formValidatorNotes: [
    "Fill in the form on the page, but don't submit it yet.",
    'Click any field in the form, then send. Text is optional.',
    'Fix the fields marked on the page. Markers go away when a field is fixed.'
  ],
  formLooksValid: 'No problems found in the form.',
  formProblems: '{count} problem(s) found in the form:',
  ruleValueMissing: 'This field is required.',
  ruleTypeMismatch: 'The value is not in the right format.',
  rulePatternMismatch: 'The value does not match the format this field needs.',
  ruleTooShort: 'The value is too short.',
  ruleTooLong: 'The value is too long.',
  ruleRangeUnderflow: 'The value is too small.',
  ruleRangeOverflow: 'The value is too big.',
  ruleStepMismatch: 'The value is not one of the allowed steps.',
  ruleEmail: 'This does not look like an email address.',
  ruleConfirm: 'This does not match the field before it.',
  ruleSpaces: 'The value starts or ends with a space.',
  rulePastDate: 'This date is in the past.',

  voiceInputNotes: [
    'Click the mic and speak. Click Stop when you are done.',
    'Check the text in the box, then send it.',
    'Recordings stop after 60 seconds.'
  ],
  voiceInputHelp: 'How to use voice input',
  startRecording: 'Speak your message',
  stopRecording: 'Stop',
  cancelRecording: 'Cancel',
  recording: 'Recording {time}',
  transcribing: 'Turning speech into text...',
  micDenied: 'Microphone access was denied.',
  noSpeechHeard: 'No speech was heard.',
  dictationName: 'Dictation',
  dictationDescription: 'Types what you say into a text box on this page',
  dictationNotes: [
    'Click the text box on the page where the text should go.',
    'Click the mic and speak. Click Stop when you are done.',
    'The text is typed into the box. Add an instruction first if you want it changed, for example: make it formal.'
  ],
  dictationNeedsAudio: 'Click the mic to record what you want to type.',
  dictationInserted: 'Text typed into the box.',
  dictationNoField: 'No text box was picked, so here is the text:',

  performanceExplainerName: 'Performance Explainer',
  performanceExplainerDescription:
    'Shows how fast this page is, in live charts, and explains it',
  performanceExplainerNotes: [
    "Send to see the page's speed numbers and live charts.",
    'Keep using the page: scroll, click, type. The charts update every second.',
    'Read the explanation under the charts, or ask a question about the numbers.',
    'Numbers start when the chat loads. Reload the page with the chat open for full load data.'
  ],
  ratingGood: 'Good',
  ratingNeedsWork: 'Needs work',
  ratingPoor: 'Poor',
  notAvailable: 'Not available',
  interactToMeasure: 'Interact with the page to measure',
  mainThreadBusy: 'Main thread busy (ms per second)',
  interactionTime: 'Interaction time (ms)',
  layoutShifts: 'Layout shifts',
  memoryUsed: 'Memory used (MB)',
  largestFiles: 'Largest files',
  pause: 'Pause',
  resume: 'Resume',
  reset: 'Reset',
  explainAgain: 'Explain again',
  chartSummary: '{name}: now {last}, min {min}, max {max}',
  seconds: 'Second',
  value: 'Value',

  phishingCheckName: 'Scam Check',
  phishingCheckDescription: 'Looks for phishing and scam signs on this page',
  phishingCheckNotes: [
    'Open the page you are not sure about.',
    'Send. Text is optional.',
    "Read the risk level and the reasons. Don't enter passwords or card details if the risk is Medium or High."
  ],
  riskLow: 'Low risk',
  riskMedium: 'Medium risk',
  riskHigh: 'High risk',
  riskSignals: 'What was found',
  noPhishingSignals: 'No warning signs were found on this page.',
  phishingDisclaimer:
    "This is a quick check, not a guarantee. When unsure, don't enter your details.",
  signalInsecureForm:
    'The page is not secure (no HTTPS) but asks for a password or card.',
  signalForeignAction: 'A form sends data to another website: {detail}',
  signalOddHost: 'The web address looks unusual: {detail}',
  signalBrandMismatch:
    'The page uses the name {detail} but is not on its website.',
  signalLonelyLogin: 'A login form on a page with no other links to this site.',
  signalLinkMismatch: 'A link shows one address but goes to another: {detail}',
  signalUrgentText: 'Pressure or scam wording: {detail}',
  signalBlockedPaste: 'Pasting or right-click is blocked on a field.',

  darkPatternDetectorName: 'Dark Pattern Detector',
  darkPatternDetectorDescription:
    'Finds tricks that push you into choices, like pre-checked boxes',
  darkPatternDetectorNotes: [
    'Open a checkout, sign-up or cancel page.',
    'Send. Text is optional.',
    'Check the numbered marks on the page. Use Uncheck to turn off pre-checked extras.'
  ],
  checkingTimers: 'Checking countdown timers...',
  noDarkPatterns: 'No dark patterns were found on this page.',
  darkPatternsFound: '{count} possible dark pattern(s) found:',
  uncheck: 'Uncheck',
  unchecked: 'Unchecked.',
  patternPrechecked: 'Pre-checked box',
  patternPrecheckedWhy: 'This extra is already turned on. You may not want it.',
  patternTimer: 'Countdown timer',
  patternTimerWhy: 'Timers push you to decide fast. This one may be fake.',
  patternTimerFake:
    'This timer started over after a reload, so it is likely fake.',
  patternScarcity: 'Scarcity claim',
  patternScarcityWhy:
    'Claims like this push you to buy now. They are hard to check.',
  patternShaming: 'Confirmshaming',
  patternShamingWhy: 'The decline option is worded to make you feel bad.',
  patternWeakDecline: 'Hidden decline',
  patternWeakDeclineWhy:
    'The option to say no is much smaller or fainter than the yes option.',
  patternSneak: 'Added to basket',
  patternSneakWhy: 'This item or fee may have been added without you asking.',
  patternHardCancel: 'Hard to cancel',
  patternHardCancelWhy:
    'This looks like a cancel page, but no cancel button is visible.'
}
