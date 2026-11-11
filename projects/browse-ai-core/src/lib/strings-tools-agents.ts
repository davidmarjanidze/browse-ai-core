/** UI text for Agent Mode and Watch Mode. Part of `TOOL_STRINGS`. */
export const TOOL_STRINGS_AGENTS = {
  agentModeName: 'Agent Mode',
  agentModeDescription: 'Does a task on this page for you, step by step',
  agentModeNotes: [
    'Describe the task, for example "Add the cheapest red shirt in size M to the cart".',
    'The assistant looks at the page, then clicks, types and scrolls. Each step is listed below.',
    'It asks before it pays, sends, deletes, submits or leaves the page. Click Stop at any time.'
  ],
  agentRunning: 'Working on the task…',
  agentSteps: 'Steps',
  agentStopped: 'Stopped. {count} step(s) were done.',
  agentDone: 'Done',
  agentFailed: 'The task could not be finished: {reason}',
  agentLimitSteps:
    'Stopped after {count} steps (the limit). The task may not be finished.',
  agentLimitTime:
    'Stopped after {minutes} minute(s) (the limit). The task may not be finished.',
  agentBadAnswers: 'The model did not answer with a valid step. Try again.',
  agentConfirmTitle: 'Allow this step?',
  agentConfirmNavigate: 'The task ends when the page loads a new address.',
  agentAllow: 'Allow',
  agentDeny: 'Deny',
  agentQuestion: 'The assistant asks: {question}',
  agentAnswerPlaceholder: 'Answer the assistant',
  agentScreenAccess:
    'The browser may ask to share your screen so the assistant can see the page.',
  agentResultOk: 'ok',
  agentResultError: 'error',
  agentResultDenied: 'denied',
  /** Words that make a click or Enter need the user's OK. Lower case. */
  agentRiskWords: [
    'buy',
    'pay',
    'purchase',
    'order',
    'checkout',
    'check out',
    'place order',
    'delete',
    'remove',
    'send',
    'post',
    'publish',
    'submit',
    'confirm',
    'subscribe',
    'unsubscribe',
    'transfer',
    'donate',
    'sign out',
    'log out',
    'cancel subscription'
  ],

  watchModeName: 'Watch Mode',
  watchModeDescription:
    'Watches a part of the page and tells you when its text changes',
  watchModeNotes: [
    'Click Select element and click the part of the page to watch, like a price or a status. Arrow Up and Arrow Down pick the parent or child.',
    'Describe what to look for, for example "Tell me when the price is below 100".',
    'The text is checked every 15 seconds (the site can change this). Checks can be slower when the tab is in the background.',
    'Watching goes on after a change is found, until you click Stop.'
  ],
  watchSelectElement: 'Select element',
  watchChangeElement: 'Change',
  watchRemoveElement: 'Remove',
  watchPicking: 'Click the part of the page to watch. Press Esc to cancel.',
  watchSelected: 'Watching:',
  watchNoElement: 'Select an element to watch.',
  watchNeedInstruction: 'Describe what change to look for.',
  watchNoText: 'This element has no text to watch.',
  watchTooLong:
    'This element has a lot of text. Only the first {count} characters are watched. Pick a smaller part for better results.',
  watchStarted:
    'Watching {element}. I will tell you when this happens: {instruction}',
  watchStatus: 'Watching {element}',
  watchChecks: '{checks} check(s), {matches} change(s) found',
  watchStop: 'Stop watching',
  watchStopped:
    'Stopped watching. {checks} check(s) were made and {matches} change(s) were found.',
  watchMatched: 'Change found at {time}: {message}',
  watchWas: 'Was: {text}',
  watchNow: 'Now: {text}',
  watchElementGone:
    'The watched element is gone from the page. I keep looking for it.',
  watchElementBack: 'The watched element is back. Watching again.',
  watchCheckFailed:
    'Checks are failing: {error}. I keep trying on the next checks.',
  watchActiveBadge: 'Watching',
  watchUnread: 'Watch Mode found a change'
}
