/**
 * Testing Center: cross-portal test cases name several sign-in accounts and longer page paths,
 * so the login and page columns are widened (no data is changed).
 */
async function up(c) {
  await c.query('ALTER TABLE test_cases MODIFY login_account VARCHAR(500) NULL, MODIFY page_location VARCHAR(500) NULL');
}

module.exports = { up };
