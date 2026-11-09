/**
 * Database-level guarantees that back up the application's own checks.
 *
 * ensureBookingGuard: a unit can have only one live booking. Every booking path already locks the
 * unit row inside a transaction; this unique index makes the database refuse a second live booking
 * even if some future code path forgets to. Deals that are CANCELLED or REJECTED don't count.
 *
 * If a database already contains two live bookings for one unit (old data), the index can't be
 * created. The guard then reports those units instead of failing, and is retried on every start
 * (backend/services/bootTasks.js) so it switches on as soon as the data is cleaned up.
 */
async function ensureBookingGuard(conn) {
  const [col] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND COLUMN_NAME = 'active_unit_id'`
  );
  if (!col.length) {
    await conn.query(
      `ALTER TABLE deals ADD COLUMN active_unit_id VARCHAR(36)
         GENERATED ALWAYS AS (CASE WHEN status IN ('CANCELLED', 'REJECTED') THEN NULL ELSE unit_id END) STORED`
    );
  }
  const [idx] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND INDEX_NAME = 'uq_deals_active_unit' LIMIT 1`
  );
  if (idx.length) return { guarded: true, duplicates: [] };

  const [dups] = await conn.query(
    `SELECT d.active_unit_id AS unit_id, u.unit_number, COUNT(*) AS live_bookings
       FROM deals d LEFT JOIN units u ON u.id = d.active_unit_id
      WHERE d.active_unit_id IS NOT NULL
      GROUP BY d.active_unit_id, u.unit_number HAVING COUNT(*) > 1`
  );
  if (dups.length) {
    return { guarded: false, duplicates: dups.map((d) => ({ unitId: d.unit_id, unit: d.unit_number, liveBookings: Number(d.live_bookings) })) };
  }
  await conn.query('ALTER TABLE deals ADD UNIQUE INDEX uq_deals_active_unit (active_unit_id)');
  return { guarded: true, duplicates: [] };
}

module.exports = { ensureBookingGuard };
