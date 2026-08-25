/**
 * `/agents` overlay: a scrollable, read-only list of the current session's
 * direct subagent children (`ctx.subagents.listChildren`), loaded once on
 * open — matches `PluginsOverlay`'s snapshot-not-live shape. Visibility
 * only: no drill-down into a child's own transcript yet.
 * @module @tomowang/dsh-tui/tui/agents/AgentsOverlay
 */

import type { Component, TUI } from '@earendil-works/pi-tui'
import { Key, matchesKey } from '@earendil-works/pi-tui'
import type { TuiActions } from '../actions.js'
import type { TuiStore } from '../store.js'
import type { SubagentRow } from './types.js'
import { theme, fg } from '../theme.js'

const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`
const secondary = fg(theme.secondary)
const muted = fg(theme.muted)
const errorColor = fg(theme.error)
const success = fg(theme.success)

const CHILD_MODE_LABEL: Record<'one-shot' | 'continuable', string> = {
  'one-shot': 'one-shot',
  continuable: 'continuable',
}

const DIAGNOSTIC_LABEL: Record<'corrupt' | 'unsupported' | 'unavailable', string> = {
  corrupt: 'corrupt',
  unsupported: 'unsupported',
  unavailable: 'unavailable',
}

/** One rendered row's status marker, color, and kind text. */
function describeRow(row: SubagentRow): { marker: string; color: (s: string) => string; kind: string } {
  if (row.kind === 'diagnostic') return { marker: '✖', color: errorColor, kind: DIAGNOSTIC_LABEL[row.diagnostic] }
  return {
    marker: row.activity === 'running' ? '●' : '✓',
    color: row.activity === 'running' ? success : muted,
    kind: CHILD_MODE_LABEL[row.mode],
  }
}

export class AgentsOverlay implements Component {
  private scrollOffset = 0

  constructor(
    private readonly tui: TUI,
    private readonly store: TuiStore,
    private readonly actions: TuiActions,
  ) {}

  invalidate(): void {}

  private listHeight(): number {
    const availableRows = Math.max(10, this.tui.terminal.rows - 1)
    const chrome = 2 // header line + footer line
    return Math.max(3, availableRows - chrome)
  }

  private maxOffset(rows: readonly SubagentRow[]): number {
    return Math.max(0, rows.length - this.listHeight())
  }

  render(_width: number): string[] {
    const overlay = this.store.getSnapshot().overlay
    if (overlay.kind !== 'agents') return []
    const { rows, busy, error } = overlay.agents
    const listHeight = this.listHeight()
    const offset = Math.min(this.scrollOffset, this.maxOffset(rows))
    const windowedRows = rows.slice(offset, offset + listHeight)
    const runningCount = rows.filter(row => row.kind === 'child' && row.activity === 'running').length

    const lines: string[] = [
      bold(secondary(`Subagents${rows.length === 0 ? '' : ` (${rows.length}, ${runningCount} running)`}`)),
    ]
    if (error !== undefined) lines.push(errorColor(error))
    if (busy && rows.length === 0) lines.push(muted('Loading…'))
    for (const row of windowedRows) {
      const { marker, color, kind } = describeRow(row)
      const label = row.kind === 'diagnostic' ? row.id : row.label
      const hasChildren = row.kind === 'child' && row.hasChildren
      lines.push(`${color(marker)} ${kind.padEnd(11)} ${label}${hasChildren ? muted(' ›') : ''}`)
    }
    if (rows.length === 0 && !busy && error === undefined) lines.push(muted('No subagents in this session yet.'))
    lines.push(muted('↑↓ scroll · esc close'))
    return lines
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || data === 'q') {
      this.actions.closeAgents()
      return
    }
    const overlay = this.store.getSnapshot().overlay
    if (overlay.kind !== 'agents') return
    const { rows } = overlay.agents
    const listHeight = this.listHeight()
    const maxOffset = this.maxOffset(rows)
    if (matchesKey(data, Key.up)) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1)
      return
    }
    if (matchesKey(data, Key.down)) {
      this.scrollOffset = Math.min(maxOffset, this.scrollOffset + 1)
      return
    }
    if (matchesKey(data, Key.pageUp)) {
      this.scrollOffset = Math.max(0, this.scrollOffset - listHeight)
      return
    }
    if (matchesKey(data, Key.pageDown)) {
      this.scrollOffset = Math.min(maxOffset, this.scrollOffset + listHeight)
    }
  }
}
