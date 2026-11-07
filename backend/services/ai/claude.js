/**
 * Claude API access for the CRM's AI features (official @anthropic-ai/sdk).
 *
 *   ANTHROPIC_API_KEY  required — without it every AI feature reports that it isn't set up
 *   AI_MODEL           optional, default claude-opus-5-5
 *   AI_EFFORT          optional, default medium (low | medium | high | xhigh | max)
 *
 * Requests opt into server-side refusal fallbacks ("default" routing), so a request the model's
 * safety classifiers decline is retried on Anthropic's recommended fallback model instead of failing.
 */
const Anthropic = require('@anthropic-ai/sdk');

const AnthropicClient = Anthropic.default || Anthropic;
const MODEL = () => process.env.AI_MODEL || 'claude-opus-5-5';
const EFFORT = () => (['low', 'medium', 'high', 'xhigh', 'max'].includes(process.env.AI_EFFORT) ? process.env.AI_EFFORT : 'medium');
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

let client = null;
const configured = () => Boolean(process.env.ANTHROPIC_API_KEY);

function getClient() {
  if (!configured()) {
    throw Object.assign(new Error('The AI assistant isn’t set up yet. Ask the administrator to add the company’s Anthropic API key (ANTHROPIC_API_KEY).'), { statusCode: 503, extra: { code: 'AI_NOT_CONFIGURED' } });
  }
  if (!client) client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120 * 1000 });
  return client;
}

/** Turns SDK errors into messages people can act on (and keeps the status code sensible). */
function friendly(err) {
  if (err && err.statusCode) return err;
  const A = AnthropicClient;
  let message = 'The AI service had a problem. Please try again.';
  let status = 502;
  if (err instanceof A.AuthenticationError || err instanceof A.PermissionDeniedError) { message = 'The AI service rejected the company’s API key. Ask the administrator to check ANTHROPIC_API_KEY.'; status = 503; }
  else if (err instanceof A.RateLimitError) { message = 'The AI service is busy right now. Please try again in a minute.'; status = 429; }
  else if (err instanceof A.BadRequestError) { message = `The AI request was not accepted: ${err.message}`; status = 400; }
  else if (err instanceof A.APIConnectionError) { message = 'Could not reach the AI service.'; status = 502; }
  else if (err instanceof A.APIError) { message = `AI service error (${err.status}).`; status = 502; }
  console.error('[ai]', err && err.message);
  return Object.assign(new Error(message), { statusCode: status, extra: { code: 'AI_ERROR' } });
}

/**
 * One Messages API call with the house defaults. `params` may set system, messages, tools,
 * max_tokens, output_config (effort is added unless given).
 */
async function create(params) {
  const c = getClient();
  try {
    const response = await c.beta.messages.create({
      model: MODEL(),
      max_tokens: params.max_tokens || 16000,
      ...params,
      output_config: { effort: EFFORT(), ...(params.output_config || {}) },
      betas: [FALLBACK_BETA],
      fallbacks: 'default'
    });
    if (response.stop_reason === 'refusal') {
      throw Object.assign(new Error('The AI declined this request. Try rephrasing it.'), { statusCode: 422, extra: { code: 'AI_REFUSED' } });
    }
    return response;
  } catch (err) {
    throw friendly(err);
  }
}

/** Text of a response (thinking and tool blocks skipped). */
const textOf = (response) => response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

/** Structured output: the response is JSON matching `schema`. */
async function extract({ system, content, schema, max_tokens = 16000 }) {
  const response = await create({
    system,
    max_tokens,
    messages: [{ role: 'user', content }],
    output_config: { format: { type: 'json_schema', schema } }
  });
  const text = textOf(response);
  try {
    return { data: JSON.parse(text), usage: response.usage };
  } catch {
    throw Object.assign(new Error('The AI returned an unreadable answer. Please try again.'), { statusCode: 502, extra: { code: 'AI_BAD_OUTPUT' } });
  }
}

module.exports = { configured, create, extract, textOf, MODEL, EFFORT };
