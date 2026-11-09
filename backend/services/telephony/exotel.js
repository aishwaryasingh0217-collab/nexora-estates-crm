/**
 * Exotel provider (https://developer.exotel.com).
 *
 * Click-to-call uses "Connect Two Numbers": Exotel rings the agent (From) first, and when the agent
 * answers it rings the customer (To) and bridges the two, showing the company's ExoPhone (CallerId)
 * to the customer. Exotel then POSTs the result to our StatusCallback.
 *
 * Settings (environment variables — never sent to the browser):
 *   EXOTEL_ACCOUNT_SID    account SID (in the API path)
 *   EXOTEL_API_KEY        API key   (HTTP Basic user)
 *   EXOTEL_API_TOKEN      API token (HTTP Basic password)
 *   EXOTEL_CALLER_ID      the ExoPhone / virtual number customers see
 *   EXOTEL_SUBDOMAIN      api.exotel.com (Singapore, default) or api.in.exotel.com (Mumbai)
 *   EXOTEL_API_BASE       optional full base URL instead of the subdomain
 *   TELEPHONY_RECORD      "true" to record calls (tell customers, as the law requires)
 *
 * Exotel does not sign webhooks, so ours carry a secret in the URL (TELEPHONY_WEBHOOK_SECRET)
 * and can be limited to Exotel's IP addresses (TELEPHONY_ALLOWED_IPS). Exotel may resend a
 * callback; every event is stored once (telephony_events.event_key).
 */
const name = 'exotel';

function settings() {
  return {
    sid: process.env.EXOTEL_ACCOUNT_SID || '',
    key: process.env.EXOTEL_API_KEY || '',
    token: process.env.EXOTEL_API_TOKEN || '',
    callerId: process.env.EXOTEL_CALLER_ID || '',
    host: (process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com').replace(/^https?:\/\//, '').replace(/\/+$/, ''),
    // Full API base, e.g. https://api.in.exotel.com — overrides EXOTEL_SUBDOMAIN (also used to point tests at a stand-in)
    base: (process.env.EXOTEL_API_BASE || '').replace(/\/+$/, ''),
    record: String(process.env.TELEPHONY_RECORD || '').toLowerCase() === 'true'
  };
}

function configured() {
  const s = settings();
  return Boolean(s.sid && s.key && s.token && s.callerId);
}

/** 10-digit Indian numbers → +91XXXXXXXXXX; anything already in international form is kept. */
function e164(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+') && digits.length >= 10) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  return null;
}

/**
 * Asks Exotel to place the call. Returns { providerCallId, raw } or throws with a readable message.
 */
async function startCall({ agentPhone, customerPhone, statusCallbackUrl, customField }) {
  const s = settings();
  const from = e164(agentPhone);
  const to = e164(customerPhone);
  if (!from) throw Object.assign(new Error('Your registered mobile number is not valid for calling.'), { statusCode: 400 });
  if (!to) throw Object.assign(new Error('The customer’s number is not a valid phone number.'), { statusCode: 400 });

  const body = new URLSearchParams();
  body.append('From', from);
  body.append('To', to);
  body.append('CallerId', s.callerId);
  body.append('CallType', 'trans');
  body.append('TimeLimit', '3600');
  body.append('TimeOut', '45');
  if (s.record) body.append('Record', 'true');
  body.append('StatusCallback', statusCallbackUrl);
  body.append('StatusCallbackEvents[]', 'terminal');
  body.append('StatusCallbackEvents[]', 'answered');
  body.append('StatusCallbackContentType', 'application/json');
  if (customField) body.append('CustomField', String(customField).slice(0, 128));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res;
  let data = {};
  try {
    res = await fetch(`${s.base || `https://${s.host}`}/v1/Accounts/${encodeURIComponent(s.sid)}/Calls/connect.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${s.key}:${s.token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body,
      signal: controller.signal
    });
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      // Some Exotel endpoints answer in XML; take the call id from it rather than lose a placed call
      const sid = /<Sid>([^<]+)<\/Sid>/i.exec(text);
      const st = /<Status>([^<]+)<\/Status>/i.exec(text);
      const msg = /<Message>([^<]+)<\/Message>/i.exec(text);
      data = sid ? { Call: { Sid: sid[1], Status: st ? st[1] : null } } : { RestException: msg ? { Message: msg[1] } : undefined };
    }
  } catch (err) {
    throw Object.assign(new Error(err.name === 'AbortError' ? 'The calling service did not respond in time.' : 'Could not reach the calling service.'), { statusCode: 502 });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok || !data.Call || !data.Call.Sid) {
    const msg = (data.RestException && data.RestException.Message) || `Calling service error (HTTP ${res.status}).`;
    const err = new Error(res.status === 401 ? 'The calling service rejected our credentials — ask the administrator to check the Exotel API key.' : msg);
    err.statusCode = res.status === 429 ? 429 : 502;
    err.providerStatus = res.status;
    throw err;
  }
  return { providerCallId: data.Call.Sid, providerStatus: data.Call.Status || null, raw: data.Call };
}

const LEG_FAIL = { 'no-answer': 'MISSED', busy: 'BUSY', failed: 'FAILED', canceled: 'REJECTED' };

/**
 * Normalises an Exotel StatusCallback into our call statuses.
 *   answered event → the agent picked up (the customer is rung next)
 *   terminal event → COMPLETED when both talked; otherwise MISSED / BUSY / FAILED / REJECTED,
 *                    with which side didn't pick up (Legs[0] = agent, Legs[1] = customer)
 */
function parseStatusCallback(body) {
  const b = body || {};
  const legs = Array.isArray(b.Legs) ? b.Legs : [];
  const providerCallId = b.CallSid || b.callsid || null;
  const eventType = String(b.EventType || 'terminal').toLowerCase();
  const status = String(b.Status || '').toLowerCase();
  const talk = parseInt(b.ConversationDuration, 10) || 0;
  const out = {
    providerCallId,
    eventType,
    providerStatus: status || null,
    recordingUrl: b.RecordingUrl || null,
    startTime: b.StartTime || null,
    endTime: b.EndTime || null,
    durationSec: talk,
    customField: b.CustomField || null,
    legs: legs.map((l) => ({ status: l && l.Status ? String(l.Status).toLowerCase() : null, seconds: parseInt(l && l.OnCallDuration, 10) || 0 }))
  };
  if (eventType === 'answered') {
    out.status = 'AGENT_ANSWERED';
    return out;
  }
  const agentLeg = out.legs[0] ? out.legs[0].status : null;
  const customerLeg = out.legs[1] ? out.legs[1].status : null;
  if (status === 'completed' && talk > 0) {
    out.status = 'COMPLETED';
  } else if (agentLeg && agentLeg !== 'completed') {
    out.status = LEG_FAIL[agentLeg] || 'FAILED';
    out.failureReason = agentLeg === 'no-answer' ? 'You didn’t answer the call on your phone' : agentLeg === 'busy' ? 'Your phone was busy' : 'Your phone could not be reached';
  } else if (customerLeg && customerLeg !== 'completed') {
    out.status = LEG_FAIL[customerLeg] || 'FAILED';
    out.failureReason = customerLeg === 'no-answer' ? 'Customer didn’t answer' : customerLeg === 'busy' ? 'Customer’s line was busy' : customerLeg === 'canceled' ? 'Call was cancelled before the customer answered' : 'Customer could not be reached';
  } else {
    out.status = LEG_FAIL[status] || (status === 'completed' ? 'MISSED' : 'FAILED');
    out.failureReason = status === 'completed' ? 'Call ended before both sides spoke' : `Call ${status || 'ended'}`;
  }
  return out;
}

/**
 * Incoming calls arrive through a Passthru applet placed in the ExoPhone's call flow.
 * Exotel's guide documents CallSid, CallFrom, CallTo, Direction, CurrentTime and DialWhomNumber;
 * other fields (CallType, DialCallDuration, RecordingUrl) are read only when present.
 */
function parseIncoming(params) {
  const p = params || {};
  const callType = String(p.CallType || '').toLowerCase();
  const done = { completed: 'COMPLETED', 'client-hangup': 'MISSED', incomplete: 'MISSED', voicemail: 'MISSED' }[callType] || null;
  return {
    providerCallId: p.CallSid || null,
    from: p.CallFrom || p.From || null,
    to: p.CallTo || p.To || null,
    direction: String(p.Direction || 'incoming').toLowerCase(),
    agentNumber: p.DialWhomNumber || null,
    finalStatus: done,
    durationSec: parseInt(p.DialCallDuration, 10) || null,
    recordingUrl: p.RecordingUrl || null
  };
}

module.exports = { name, configured, startCall, parseStatusCallback, parseIncoming, e164, settings };
