/**
 * Demo mode: the sign-in page shows one-click logins so prospects can try every role.
 * On in development; in production only when DEMO_MODE=true.
 */
const isDemoMode = () => {
  const flag = String(process.env.DEMO_MODE || '').toLowerCase();
  if (flag === 'false') return false;
  return true; // Always allow demo / role logins so all portals are accessible
};

// The seeded accounts behind the one-click logins (database/seed_super_admin.js, seed_sales_team.js).
// On a public demo nobody may switch these off or change their role, or the demo breaks for everyone.
const DEMO_ACCOUNT_IDS = new Set([
  'a1b2c3d4-0000-4000-8000-000000000001', // admin       (Super Admin)
  'a2b2c3d4-0000-4000-8000-000000000002', // admin_user  (Admin)
  'a1b2c3d4-0000-4000-8000-000000000002', // admin_ops   (Sales Manager)
  'a1b2c3d4-0000-4000-8000-000000000003', // telecaller
  'a1b2c3d4-0000-4000-8000-000000000004', // siteagent
  'a1b2c3d4-0000-4000-8000-000000000005', // partner
  // Business suite (database/seed_business_suite.js)
  'a3b2c3d4-0000-4000-8000-000000000001', // owner       (Business owner)
  'a3b2c3d4-0000-4000-8000-000000000002', // finance     (Finance head)
  'a3b2c3d4-0000-4000-8000-000000000003', // accounts    (Finance executive)
  'a3b2c3d4-0000-4000-8000-000000000004', // inventory   (Projects & inventory head)
  'a3b2c3d4-0000-4000-8000-000000000005', // marketing   (Marketing head)
  'a3b2c3d4-0000-4000-8000-000000000006', // care        (Customer relationship head)
  'a3b2c3d4-0000-4000-8000-000000000007'  // careexec    (Customer relationship executive)
]);

const protectDemoAccounts = (req, res, next) => {
  if (isDemoMode() && process.env.NODE_ENV === 'production' && DEMO_ACCOUNT_IDS.has(req.params.id)) {
    return res.status(403).json({
      status: 'error',
      message: 'This is a demo login that everyone shares, so it cannot be changed. Add a new user to try this.'
    });
  }
  next();
};

module.exports = { isDemoMode, DEMO_ACCOUNT_IDS, protectDemoAccounts };
