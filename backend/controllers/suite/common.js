/**
 * Helpers shared by the Business Suite controllers.
 */
const pool = require('../../config/db');
const { fullName } = require('../../services/salesWorkspace');

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { statusCode: status, extra });

/** Wraps an async handler so thrown errors reach the error handler (with their status code). */
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

const ok = (res, data, message = undefined, status = 200) =>
  res.status(status).json({ status: 'success', ...(message ? { message } : {}), data });

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD → [from 00:00, to+1 00:00). Defaults to the last `days` days. */
function dateRange(q, days = 30) {
  const parse = (v) => {
    if (!v) return null;
    const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  let to = parse(q.to);
  let from = parse(q.from);
  if (to) to = new Date(to.getTime() + 86400000);
  else { to = new Date(); to.setHours(0, 0, 0, 0); to = new Date(to.getTime() + 86400000); }
  if (!from) from = new Date(to.getTime() - days * 86400000);
  if (from >= to) throw httpError(400, 'The start date must be before the end date.');
  const span = to.getTime() - from.getTime();
  return { from, to, prevFrom: new Date(from.getTime() - span), prevTo: from, days: Math.round(span / 86400000) };
}

function page(q, max = 200) {
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 50, 1), max);
  const offset = Math.max(parseInt(q.offset, 10) || 0, 0);
  return { limit, offset };
}

const num = (v) => Number(v) || 0;
const pct = (a, b) => (num(b) ? Math.round((num(a) / num(b)) * 1000) / 10 : 0);

async function userName(id) {
  if (!id) return null;
  const [[u]] = await pool.query('SELECT first_name, last_name FROM users WHERE id = ?', [id]);
  return u ? fullName(u.first_name, u.last_name) : null;
}

module.exports = { httpError, wrap, ok, dateRange, page, num, pct, userName, fullName, pool };
