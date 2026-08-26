/**
 * `/agents` detail view: one subagent child's own transcript, drilled into
 * from `AgentsOverlay` (Enter on a `child` row). Read-only — reuses
 * `render.ts`'s `formatEvent`, the exact renderer the main transcript uses,
 * against the child's own event log instead of the live session's. A
 * `tool/call`'s name/arguments are resolved from a map built locally from
 * that same log, since the main store's own `getToolCall` only knows about
 * the live session's calls.
 * @module @tomowang/dsh-tui/tui/agents/AgentDetailOverlay
 */

import type { Component, TUI } from '@earendil-works/pi-tui'
import { Key, matchesKey } from '@earendil-works/pi-tui'
import type { RenderOptions } from '../../render.js'
import type { TuiActions } from '../actions.js'
import type { TuiStore } from '../store.js'
import { theme, fg } from '../theme.js'
import { buildAgentDetailLines } from './detailLines.js'

const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`
const secondary = fg(theme.secondary)
const muted = fg(theme.muted)
const errorColor = fg(theme.error)
const success = fg(theme.success)

export class AgentDetailOverlay implements Component {
  private scrollOffset = 0
  /** Auto-follow new lines while live, until the reader scrolls away on purpose. */
  private pinnedToBottom = true

  constructor(
    private readonly tui: TUI,
    private readonly store: TuiStore,
    private readonly actions: TuiActions,
    private readonly getTool: RenderOptions['getTool'],
  ) {}

  invalidate(): void {}

  private listHeight(): number {
    const availableRows = Math.max(10, this.tui.terminal.rows - 1)
    const chrome = 2 // header line + footer line
    return Math.max(3, availableRows - chrome)
  }

  render(_width: number): string[] {
    const overlay = this.store.getSnapshot().overlay
    if (overlay.kind !== 'agentDetail') return []
    const { label, events, live, busy, error } = overlay.agentDetail
    const bodyLines = buildAgentDetailLines(events, this.getTool)
    const listHeight = this.listHeight()
    const maxOffset = Math.max(0, bodyLines.length - listHeight)
    if (this.pinnedToBottom) this.scrollOffset = maxOffset
    else this.scrollOffset = Math.min(this.scrollOffset, maxOffset)
    const windowed = bodyLines.slice(this.scrollOffset, this.scrollOffset + listHeight)

    const statusTag = live ? success('● live') : muted('finished')
    const lines: string[] = [`${bold(secondary(`Subagent — ${label}`))} ${statusTag}`]
    if (error !== undefined) lines.push(errorColor(error))
    if (busy && events.length === 0) lines.push(muted('Loading…'))
    lines.push(...windowed)
    if (events.length === 0 && !busy && error === undefined) lines.push(muted('No transcript yet.'))
    lines.push(muted('↑↓ scroll · esc back'))
    return lines
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || data === 'q') {
      this.actions.closeAgentDetail()
      return
    }
    const overlay = this.store.getSnapshot().overlay
    if (overlay.kind !== 'agentDetail') return
    const bodyLines = buildAgentDetailLines(overlay.agentDetail.events, this.getTool)
    const listHeight = this.listHeight()
    const maxOffset = Math.max(0, bodyLines.length - listHeight)
    if (matchesKey(data, Key.up)) {
      this.pinnedToBottom = false
      this.scrollOffset = Math.max(0, this.scrollOffset - 1)
      return
    }
    if (matchesKey(data, Key.down)) {
      this.scrollOffset = Math.min(maxOffset, this.scrollOffset + 1)
      this.pinnedToBottom = this.scrollOffset >= maxOffset
      return
    }
    if (matchesKey(data, Key.pageUp)) {
      this.pinnedToBottom = false
      this.scrollOffset = Math.max(0, this.scrollOffset - listHeight)
      return
    }
    if (matchesKey(data, Key.pageDown)) {
      this.scrollOffset = Math.min(maxOffset, this.scrollOffset + listHeight)
      this.pinnedToBottom = this.scrollOffset >= maxOffset
    }
  }
}
