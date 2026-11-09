# AI assistant and AI features

The AI features use Claude through the official Anthropic SDK (`@anthropic-ai/sdk`). They work on the CRM's live data through the same permission checks as the rest of the app. The assistant can only see what the signed-in person can see.

## Setup

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | The company's Anthropic API key (server `.env` only). |
| `AI_MODEL` | Optional. Default `claude-opus-5-5`. |
| `AI_EFFORT` | Optional. `low`, `medium` (default), `high`, `xhigh` or `max` — higher is more thorough, slower and costs more. |

Without a key, every AI feature answers "AI not configured" (HTTP 503) and the rest of the CRM works normally. The assistant panel says so too. Restart the server after adding the key.

## Features

| Feature | Where | What it does |
|---|---|---|
| Assistant | Suite header → **Assistant** | Answers questions using CRM tools: leads, follow-ups, visits, bookings, payments (verified only), inventory, team productivity, campaigns. Owners get an executive summary. |
| Actions with confirmation | Assistant | Can propose: schedule a follow-up, add a note to a lead, assign leads. A proposal is stored as pending and runs only when you click **Confirm**. **Cancel** discards it. |
| Next step for a lead | Lead drawer → **Next step** | Suggests the next action, talking points and a message draft from the lead's real history. Nothing is sent. |
| Brochure → project | Inventory → Projects → **New from brochure (AI)** | Reads a PDF brochure and pre-fills the project form for review. It lists fields the brochure doesn't contain and never guesses. |
| Paste → leads | Import leads → **Paste text (AI)** | Turns pasted WhatsApp / email / notes text into lead rows for review. Duplicates are flagged. Nothing is saved until you import. |
| Smart distribution | Sales → Smart distribution | Scores who should take unassigned leads: conversion history, current load and response speed. It is a calculation, not a model call, so it works without the key. |

## Safeguards

- **Data access:** each AI tool runs with the signed-in user's permissions. A telecaller's assistant cannot read other agents' leads or company finances.
- **Confirmation:** changes are never made directly by the model. Every action goes through confirmation and is written to the audit history with source **AI** and the confirming person.
- **Extraction:** brochure reading and text-to-leads use structured output (a fixed JSON schema) and are shown for human review before anything is saved.
- **No pretending:** if the AI isn't configured, the features say so. There are no canned answers that pretend to do work.
