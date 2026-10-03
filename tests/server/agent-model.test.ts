import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRunRow, EvidenceItemRow } from '../../shared/database.js';
import { createAgentToolChooser, agentTools, activeToolNames } from '../../server/agent/model.js';
import { routingClient } from './routed-test-client.js';
import { investigationContext } from '../../server/agent/prompts.js';
import type { AgentSnapshot } from '../../server/agent/loop.js';

const run = { max_agent_steps: 10, agent_steps: 0, agent_state: { checked_guidance: [{ id: 'rule-1', title: 'Checked rule', body: 'Checked words', source_name: 'Primary', source_url: 'https://example.org/rule', checked_on: '2026-10-02', applies_to_steps: [1] }] } } as AgentRunRow;
const snapshot: AgentSnapshot = { documents: [], evidence: [], facts: [], questions: [] };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
beforeEach(()=> { vi.stubEnv('MODEL_COOLDOWN_SIGNING_SECRET','test-secret-with-at-least-32-characters'); vi.stubEnv('LLM_TEXT_LINEUP','gemini-3.5-flash-lite'); });
const chooseAgentTool=createAgentToolChooser(routingClient());
describe('tool selection through the actual SDK with fake HTTP', () => {
  it('keeps document quotes out of the tool context and restores checked guidance', () => {
    const context = JSON.parse(investigationContext({ ...snapshot, evidence: [{ quote: 'RAW DOCUMENT INSTRUCTION' } as EvidenceItemRow] }, run));
    expect(JSON.stringify(context)).not.toContain('RAW DOCUMENT INSTRUCTION');
    expect(context.guidance[0].id).toBe('rule-1');
    expect(Object.keys(agentTools())).toHaveLength(8);
    expect(Object.values(agentTools()).every(tool => tool.execute === undefined)).toBe(true);
  });
  it.each([1, 2])('accepts exactly one tool call (received %s)', async count => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'fake-key');
    const http = vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: RequestInit) => new Response(JSON.stringify({
      candidates: [{ content: { role: 'model', parts: Array.from({ length: count }, () => ({ functionCall: { name: 'get_next_step', args: {} } })) }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 8, totalTokenCount: 12 },
    }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', http);
    if (count === 1) expect(await chooseAgentTool(snapshot, run)).toMatchObject({ name: 'get_next_step', input: {} });
    else await expect(chooseAgentTool(snapshot, run)).rejects.toThrow('exactly one tool');
    expect(http).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(http.mock.calls[0]![1]?.body));
    expect(body.tools[0].functionDeclarations).toHaveLength(activeToolNames(snapshot,run).length);
    expect(body.toolConfig.functionCallingConfig.mode).toBe('ANY');
    expect(JSON.stringify(body.tools)).not.toContain('maxLength');
  });
  it('offers the relevant conflict actions without resending all eight schemas',()=>{
    const conflict={...snapshot,facts:[{field:'refund_amount',status:'conflict'}] as AgentSnapshot['facts']};
    expect(activeToolNames(conflict,run)).toEqual(['ask_user']);
    expect(JSON.stringify(agentTools(activeToolNames(conflict,run))).length).toBeLessThan(JSON.stringify(agentTools()).length);
  });
  it('does not retry a refused provider request', async () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'fake-key');
    const http = vi.fn(async () => new Response(JSON.stringify({ error: { code: 429, message: 'Rate limit' } }), { status: 429, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', http);
    await expect(chooseAgentTool(snapshot, run)).rejects.toThrow();
    expect(http).toHaveBeenCalledTimes(1);
  });
});

