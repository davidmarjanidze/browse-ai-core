/** Every Agent Mode tool, by the name the model uses. */
export const AGENT_TOOL_NAMES = [
  'get_page_state',
  'screenshot',
  'query_selector',
  'find_text',
  'find_images',
  'extract_list',
  'read_element',
  'read_selection',
  'click',
  'type_text',
  'set_value',
  'select_option',
  'set_checked',
  'press_key',
  'hover',
  'right_click',
  'scroll',
  'close_overlay',
  'go_back',
  'go_forward',
  'open_in_new_tab',
  'read_page_text',
  'read_table',
  'scroll_inside',
  'double_click',
  'fill_form',
  'show_user',
  'remember',
  'wait',
  'wait_for',
  'wait_for_idle',
  'wait_for_url',
  'ask_user',
  'done',
  'fail'
] as const

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number]

/** Tools that `agent.disabledTools` can't turn off. */
export const REQUIRED_AGENT_TOOLS: readonly AgentToolName[] = ['done', 'fail']
