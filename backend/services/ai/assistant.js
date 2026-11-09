/**
 * AI assistant — natural-language questions about the CRM, answered from live data through the
 * tools in ./tools.js, as the signed-in person (same permissions and record limits as the app).
 *
 * Actions the assistant proposes (follow-ups, notes, assignments) are saved as PENDING and run only
 * when the person presses Confirm; each run re-checks permissions and is audited with source "AI".
 */
const crypto = require('crypto');
const pool = require('../../config/db');
const claude = require('./claude');
const tools = require('./tools');
const audit = require('../audit');
const { ROLE_INFO } = require('../permissions');
const leadService = require('../leadService');
const { logActivity, fullName } = require('../salesWorkspace');

const MAX_TURNS = 8;
const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { statusCode: status, extra });

function systemPrompt(user) {
  const role = ROLE_INFO[user.role] || { label: user.role, department: '' };
  return [
    `You are the assistant inside Nexora, a real-estate CRM. You are helping ${user.name}, who works as ${role.label}${user.jobLevel === 'HEAD' ? ' (department head)' : ''}.`,
    'Answer from the company\'s live records using the tools. Every figure you state must come from a tool result in this conversation; if the tools can\'t answer, say what is missing instead of estimating.',
    'The tools only return what this person is allowed to see. If something is outside their access, say so plainly.',
    'Tools marked ACTION change records. Calling one only prepares it: the person sees a Confirm button and nothing happens until they press it. Tell them what you prepared.',
    'Money is in Indian rupees; write amounts like ₹1,25,00,000 or ₹1.25 Cr. Times are India time.',
    'When a tool returns a table, the screen shows it with Excel and PDF export buttons — summarise the key points rather than repeating every row.',
    'Be brief and practical: lead with the answer, then the few details that matter.',
    `Today is ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`
  ].join('\n');
}

/** Only plain user/assistant text from the client; tool use is always re-run on the server. */
function cleanHistory(messages) {
  const out = [];
  for (const m of (Array.isArray(messages) ? messages : []).slice(-20)) {
    if (!m || !['user', 'assistant'].includes(m.role)) continue;
    const text = String(m.content || '').trim().slice(0, 8000);
    if (!text) continue;
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += `\n\n${text}`;
    else out.push({ role: m.role, content: text });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length || out[out.length - 1].role !== 'user') throw httpError(400, 'Ask a question first.');
  return out;
}

async function chat(user, messages, req = null) {
  const history = cleanHistory(messages);
  const available = tools.toolsFor(user);
  const convo = [...history];
  const tables = [];
  const pending = [];
  const used = [];
  let response;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    response = await claude.create({ system: systemPrompt(user), tools: available, messages: convo, max_tokens: 16000 });
    if (response.stop_reason === 'pause_turn') { convo.push({ role: 'assistant', content: response.content }); continue; }
    if (response.stop_reason !== 'tool_use') break;

    convo.push({ role: 'assistant', content: response.content });
    const results = [];
    for (const block of response.content.filter((b) => b.type === 'tool_use')) {
      const tool = tools.find(block.name);
      const allowed = available.some((t) => t.name === block.name);
      let content;
      let isError = false;
      try {
        if (!tool || !allowed) throw new Error('This tool is not available to this user.');
        const input = block.input && typeof block.input === 'object' ? block.input : {};
        if (tool.action) {
          const summary = await tool.describe(user, input);
          const id = crypto.randomUUID();
          await pool.query('INSERT INTO ai_actions (id, user_id, tool, input, summary) VALUES (?, ?, ?, ?, ?)', [id, user.id, tool.name, JSON.stringify(input), summary.slice(0, 500)]);
          pending.push({ id, tool: tool.name, summary });
          content = JSON.stringify({ status: 'prepared — waiting for the user to press Confirm', action_id: id, will_do: summary });
        } else {
          const result = await tool.run(user, input);
          if (result && result.table) tables.push(result.table);
          used.push(tool.name);
          content = JSON.stringify(result).slice(0, 60000);
        }
      } catch (err) {
        isError = true;
        content = `Error: ${err.message}`;
      }
      results.push({ type: 'tool_result', tool_use_id: block.id, content, ...(isError ? { is_error: true } : {}) });
    }
    convo.push({ role: 'user', content: results });
  }

  const reply = claude.textOf(response) || (pending.length ? 'I prepared the action below — press Confirm to run it.' : 'I couldn’t find an answer to that.');
  await audit.record({
    req, source: 'AI', action: 'AI_QUESTION', entityType: 'AI', entityId: null,
    summary: `Asked: “${history[history.length - 1].content.slice(0, 200)}”${used.length ? ` — used ${[...new Set(used)].join(', ')}` : ''}${pending.length ? `; prepared ${pending.length} action(s)` : ''}`
  });
  return { reply, tables, pendingActions: pending, model: response.model };
}

/** Runs a prepared action after the person confirms it — with their current permissions. */
async function confirmAction(user, actionId, req = null) {
  const [[a]] = await pool.query('SELECT * FROM ai_actions WHERE id = ? AND user_id = ?', [actionId, user.id]);
  if (!a) throw httpError(404, 'Action not found.');
  if (a.status !== 'PENDING') throw httpError(409, `This action was already ${a.status.toLowerCase()}.`);
  if (Date.now() - new Date(a.created_at).getTime() > 24 * 3600000) throw httpError(409, 'This suggestion is more than a day old. Ask the assistant again.');
  const tool = tools.find(a.tool);
  if (!tool || !tools.toolsFor(user).some((t) => t.name === tool.name)) throw httpError(403, 'Your role can no longer do this.');
  const input = JSON.parse(a.input);
  const [claim] = await pool.query("UPDATE ai_actions SET status = 'CONFIRMED', decided_at = NOW() WHERE id = ? AND status = 'PENDING'", [a.id]);
  if (!claim.affectedRows) throw httpError(409, 'This action was just handled.');

  let result;
  try {
    if (a.tool === 'schedule_follow_up') {
      const lead = await tools.visibleLead(user, input.lead_id);
      const when = new Date(input.when);
      if (Number.isNaN(when.getTime())) throw new Error('Invalid follow-up time.');
      await pool.query('UPDATE leads SET next_follow_up_at = ? WHERE id = ?', [when, lead.id]);
      await logActivity({ leadId: lead.id, userId: user.id, type: 'AI', outcome: 'FOLLOW_UP_SET', note: `Follow-up set for ${when.toLocaleString('en-IN')} (suggested by the assistant)${input.note ? ` — ${input.note}` : ''}` });
      await audit.record({ req, source: 'AI', action: 'LEAD_FOLLOW_UP_SET', entityType: 'LEAD', entityId: lead.id, summary: `${fullName(lead.first_name, lead.last_name)}: follow-up ${when.toLocaleString('en-IN')} (AI-suggested, confirmed by ${user.name})`, before: { next_follow_up_at: lead.next_follow_up_at }, after: { next_follow_up_at: when } });
      result = `Follow-up set for ${when.toLocaleString('en-IN')}.`;
    } else if (a.tool === 'add_lead_note') {
      const lead = await tools.visibleLead(user, input.lead_id);
      await logActivity({ leadId: lead.id, userId: user.id, type: 'NOTE', outcome: 'NOTE', note: String(input.note).slice(0, 2000) });
      await audit.record({ req, source: 'AI', action: 'LEAD_NOTE_ADDED', entityType: 'LEAD', entityId: lead.id, summary: `${fullName(lead.first_name, lead.last_name)}: note added (AI-suggested, confirmed by ${user.name})` });
      result = 'Note added.';
    } else if (a.tool === 'assign_leads') {
      const sales = require('../../controllers/suite/salesController');
      const team = await sales.teamOf(user);
      if (team && !team.includes(input.to_user_id)) throw new Error('You can assign leads to your own team only.');
      const r = await leadService.bulkAssign(input.lead_ids, { toUserId: input.to_user_id, by: { id: user.id, name: user.name, role: user.role }, reason: input.reason || 'Suggested by the assistant', req, method: 'AI' });
      result = `${r.assigned} assigned${r.unchanged ? `, ${r.unchanged} already with them` : ''}${r.failed.length ? `, ${r.failed.length} failed` : ''}.`;
    } else {
      throw new Error('Unknown action.');
    }
    await pool.query('UPDATE ai_actions SET result = ? WHERE id = ?', [result, a.id]);
    return { id: a.id, result };
  } catch (err) {
    await pool.query("UPDATE ai_actions SET status = 'FAILED', result = ? WHERE id = ?", [String(err.message).slice(0, 500), a.id]);
    throw httpError(err.statusCode || 400, err.message);
  }
}

async function cancelAction(user, actionId) {
  const [r] = await pool.query("UPDATE ai_actions SET status = 'CANCELLED', decided_at = NOW() WHERE id = ? AND user_id = ? AND status = 'PENDING'", [actionId, user.id]);
  if (!r.affectedRows) throw httpError(404, 'No pending action with that id.');
  return { id: actionId };
}

module.exports = { chat, confirmAction, cancelAction, systemPrompt };
