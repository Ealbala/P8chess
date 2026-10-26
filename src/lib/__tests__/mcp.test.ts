import { describe, expect, it } from 'vitest'
import { POST, handleRpc, movesFromPgn } from '../../../api/mcp'

describe('api/mcp (MCP server)', () => {
  it('initializes and lists tools', async () => {
    const init = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })
    expect(init).toMatchObject({ result: { protocolVersion: '2025-06-18', serverInfo: { name: 'pocho-chess' } } })
    const list = (await handleRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' })) as { result: { tools: { name: string }[] } }
    expect(list.result.tools.map((t) => t.name)).toEqual(['get_player_overview', 'get_recent_games', 'get_rating_history'])
  })

  it('answers notifications with 202 and unknown methods with an error', async () => {
    const res = await POST(new Request('https://x/api/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) }))
    expect(res.status).toBe(202)
    expect(await handleRpc({ jsonrpc: '2.0', id: 3, method: 'foo' })).toMatchObject({ error: { code: -32601 } })
  })

  it('exposes the app tools only with the app password', async () => {
    const names = async (url: string) => {
      const res = await POST(new Request(url, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }))
      return ((await res.json()) as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name)
    }
    process.env.COACH_PASSWORD = 'secret'
    process.env.BLOB_READ_WRITE_TOKEN = 'x'
    try {
      expect(await names('https://x/api/mcp')).not.toContain('send_coach_message')
      expect(await names('https://x/api/mcp?key=wrong')).not.toContain('send_coach_message')
      expect(await names('https://x/api/mcp?key=secret')).toEqual(
        expect.arrayContaining(['get_app_training_data', 'send_coach_message', 'assign_training', 'set_training_goal']),
      )
      const call = (await handleRpc(
        { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'assign_training', arguments: { track: 'nope', minutes: 30 } } },
        true,
      )) as { result: { isError?: boolean } }
      expect(call.result.isError).toBe(true)
      expect(await handleRpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'assign_training', arguments: {} } })).toMatchObject({
        error: { code: -32602 },
      })
    } finally {
      delete process.env.COACH_PASSWORD
      delete process.env.BLOB_READ_WRITE_TOKEN
    }
  })

  it('strips clocks and numbers from PGN moves', () => {
    expect(movesFromPgn('[Event "x"]\n\n1. e4 {[%clk 0:09:58]} 1... e5 {[%clk 0:09:50]} 2. Nf3 1-0')).toBe('1. e4 e5 2. Nf3 1-0')
  })
})
