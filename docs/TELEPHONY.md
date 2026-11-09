# Cloud telephony (click-to-call)

Staff call leads and customers through the company's cloud telephony number. The CRM keeps the call record: status, talk time, outcome and an optional recording. The telephony provider is pluggable. Exotel is the one built in (`backend/services/telephony/exotel.js`), and adding another provider means adding one adapter file.

**Status:** the integration is built and tested against a local stand-in that imitates Exotel's API and callbacks. It has **not** been run against a live Exotel account. Until the settings below are filled in:
- the Call button falls back to the phone's own dialler,
- the suite shows that calling isn't set up,
- no call is ever reported as connected.

## How a call works

1. The agent taps **Call** on a lead.
2. The CRM asks Exotel to connect two numbers, using the company number (ExoPhone) as caller ID:
   - first the **agent's** registered mobile (`users.phone`),
   - then, when the agent answers, the **customer**.
3. Exotel reports progress to the CRM's status webhook. The call widget shows each stage as Exotel reports it:
   Initiated → Ringing agent → Agent answered → Ringing customer → Connected → Completed. A call can also end as Missed, Busy, Failed or Rejected.
4. When the call ends, the agent fills the **outcome form**: outcome, remarks, next follow-up and interest. The lead's history and follow-up are updated.
5. **Incoming calls:** with a Passthru applet in the Exotel call flow, the CRM identifies the caller by phone number and notifies the lead's owner. An unknown number can be turned into a new lead.

Each agent may have one outbound call in progress at a time. Agents can only call their own leads; managers and customer-care staff can call more widely.

## Settings (server `.env`, never in the browser)

| Variable | Value |
|---|---|
| `TELEPHONY_PROVIDER` | `exotel` (default) |
| `EXOTEL_ACCOUNT_SID` | Exotel account SID |
| `EXOTEL_API_KEY` / `EXOTEL_API_TOKEN` | API key and token (Exotel dashboard → API settings) |
| `EXOTEL_CALLER_ID` | Your ExoPhone (virtual number), e.g. `08047xxxxxx` |
| `EXOTEL_SUBDOMAIN` | `api.exotel.com` (Singapore, default) or `api.in.exotel.com` (Mumbai cluster) |
| `EXOTEL_API_BASE` | Optional full API base URL instead of the subdomain |
| `PUBLIC_BASE_URL` | The CRM's public HTTPS address, e.g. `https://crm.yourcompany.com`. Exotel must be able to reach it. |
| `TELEPHONY_WEBHOOK_SECRET` | A long random string (e.g. `openssl rand -hex 24`). It is part of the webhook URLs. |
| `TELEPHONY_ALLOWED_IPS` | Optional comma-separated list of Exotel's callback IPs. Other addresses are refused. |
| `TELEPHONY_RECORD` | `true` to ask Exotel to record calls. Check your consent and disclosure obligations first. |

Restart the server after changing these. **Sales head → Reports → Calls** and the suite's call widget show whether calling is ready.

## Webhook URLs to configure in Exotel

```
Status callback:  {PUBLIC_BASE_URL}/api/telephony/webhooks/exotel/status/{TELEPHONY_WEBHOOK_SECRET}
Incoming (Passthru applet URL): {PUBLIC_BASE_URL}/api/telephony/webhooks/exotel/incoming/{TELEPHONY_WEBHOOK_SECRET}
```

- The CRM sends the status callback URL with each outgoing call. You only need to set it in Exotel for incoming flows.
- Requests with a wrong secret get `404`, and nothing is recorded.
- Every callback is stored once, keyed by call and event. A repeated callback does not change the call twice.
- Use HTTPS. The secret is in the URL, so keep it out of screenshots and tickets.

## What to verify on a live account

These are the manual test cases TEL-02 … TEL-06. Before going live, confirm:

- **Field names:** the Passthru field names your account sends (`CallSid`, `CallFrom`, `CallTo`, `Direction`, `DialWhomNumber`) match what `exotel.parseIncoming` reads.
- **Leg order:** in the status callback `Legs[]`, the first leg is the agent and the second is the customer.
- **Phone format:** agents' phone numbers in **People & access** are stored in a format Exotel accepts (10-digit Indian mobile or E.164).
- **Recordings:** if enabled, they open from the call history (the link is fetched by the server, so Exotel credentials never reach the browser).
