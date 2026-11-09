/**
 * Manual testing environment — fictional data only. Every record is marked as TEST DATA:
 *   - leads, users, projects, partner firms, campaigns carry is_test_data = 1 (shown as a TEST badge)
 *   - names end with "[TEST]", emails use the reserved example.test domain
 *   - phone numbers use the 555 series, which isn't a valid Indian mobile series, so no real person
 *     can ever be called or messaged from the test data (put your own number on a test lead to try calling)
 * Record IDs (TL-01 … TL-50, TU-…, TP-…) appear in the Testing Center, the CSV export and lead notes.
 *
 * No bookings or payments are seeded: those are created by the tester during the workflow tests.
 */
const id = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PASSWORD = process.env.TEST_ACCOUNT_PASSWORD || 'Test@Nexora2026';

const USERS = [
  { ref: 'TU-OWNER', id: id('te100000', 1), username: 'test.owner', role: 'BUSINESS_OWNER', level: 'HEAD', first: 'Owen', last: 'Kapoor [TEST]', phone: '5550100001' },
  { ref: 'TU-SALESHEAD', id: id('te100000', 2), username: 'test.saleshead', role: 'SUPER_ADMIN', level: 'HEAD', first: 'Sana', last: 'Head [TEST]', phone: '5550100002' },
  { ref: 'TU-MANAGER', id: id('te100000', 3), username: 'test.manager', role: 'ADMIN', level: 'HEAD', first: 'Manav', last: 'Rao [TEST]', phone: '5550100003' },
  { ref: 'TU-TELE1', id: id('te100000', 4), username: 'test.tele1', role: 'INSIDE_SALES', level: 'EXECUTIVE', first: 'Tara', last: 'Iyer [TEST]', phone: '5550100004', manager: 'TU-MANAGER' },
  { ref: 'TU-TELE2', id: id('te100000', 5), username: 'test.tele2', role: 'INSIDE_SALES', level: 'EXECUTIVE', first: 'Tushar', last: 'Gill [TEST]', phone: '5550100005', manager: 'TU-MANAGER' },
  { ref: 'TU-FIELD1', id: id('te100000', 6), username: 'test.field1', role: 'OUTSIDE_SALES', level: 'EXECUTIVE', first: 'Farhan', last: 'Shaikh [TEST]', phone: '5550100006', manager: 'TU-MANAGER' },
  { ref: 'TU-FIELD2', id: id('te100000', 7), username: 'test.field2', role: 'OUTSIDE_SALES', level: 'EXECUTIVE', first: 'Fiona', last: 'D’Souza [TEST]', phone: '5550100007', manager: 'TU-MANAGER' },
  { ref: 'TU-PARTNER1', id: id('te100000', 8), username: 'test.partner1', role: 'CHANNEL_PARTNER', level: 'EXECUTIVE', first: 'Pranav', last: 'Mehta [TEST]', phone: '5550100008', firm: 'TP-FIRM-A' },
  { ref: 'TU-PARTNER2', id: id('te100000', 9), username: 'test.partner2', role: 'CHANNEL_PARTNER', level: 'EXECUTIVE', first: 'Priya', last: 'Nanda [TEST]', phone: '5550100009', firm: 'TP-FIRM-B' },
  { ref: 'TU-FINANCE', id: id('te100000', 10), username: 'test.finance', role: 'FINANCE', level: 'HEAD', first: 'Farah', last: 'Qureshi [TEST]', phone: '5550100010' },
  { ref: 'TU-ACCOUNTS', id: id('te100000', 11), username: 'test.accounts', role: 'FINANCE', level: 'EXECUTIVE', first: 'Abhay', last: 'Joshi [TEST]', phone: '5550100011' },
  { ref: 'TU-INVENTORY', id: id('te100000', 12), username: 'test.inventory', role: 'INVENTORY', level: 'HEAD', first: 'Ishaan', last: 'Verma [TEST]', phone: '5550100012' },
  { ref: 'TU-MARKETING', id: id('te100000', 13), username: 'test.marketing', role: 'MARKETING', level: 'HEAD', first: 'Mira', last: 'Sethi [TEST]', phone: '5550100013' },
  { ref: 'TU-CRM', id: id('te100000', 14), username: 'test.crm', role: 'CUSTOMER_RELATIONS', level: 'HEAD', first: 'Chitra', last: 'Menon [TEST]', phone: '5550100014' },
  { ref: 'TU-CRMEXEC', id: id('te100000', 15), username: 'test.crmexec', role: 'CUSTOMER_RELATIONS', level: 'EXECUTIVE', first: 'Kabir', last: 'Lal [TEST]', phone: '5550100015' }
];

const FIRMS = [
  { ref: 'TP-FIRM-A', id: id('te500000', 1), name: 'Alpha Realty Partners [TEST]', contact: 'Pranav Mehta', phone: '5550200001', tier: 'GOLD', rate: 2.0 },
  { ref: 'TP-FIRM-B', id: id('te500000', 2), name: 'Beta Homes Brokers [TEST]', contact: 'Priya Nanda', phone: '5550200002', tier: 'SILVER', rate: 1.5 }
];

const PROJECTS = [
  { ref: 'TPR-AURORA', id: id('te300000', 1), name: 'Aurora Residences [TEST]', code: 'TAUR', type: 'RESIDENTIAL', city: 'Bengaluru', location: 'Whitefield, Bengaluru', lat: 12.9698, lng: 77.7500, status: 'UNDER_CONSTRUCTION', possession: 'Dec 2027', rera: 'PRM/KA/RERA/TEST/0001', partner: 1 },
  { ref: 'TPR-CEDAR', id: id('te300000', 2), name: 'Cedar Greens Villas [TEST]', code: 'TCED', type: 'RESIDENTIAL', city: 'Pune', location: 'Hinjewadi, Pune', lat: 18.5913, lng: 73.7389, status: 'NEW_LAUNCH', possession: 'Jun 2028', rera: 'P52100TEST0002', partner: 1 },
  { ref: 'TPR-MERIDIAN', id: id('te300000', 3), name: 'Meridian Business Park [TEST]', code: 'TMER', type: 'COMMERCIAL', city: 'Gurugram', location: 'Golf Course Ext Rd, Gurugram', lat: 28.4089, lng: 77.0426, status: 'READY_TO_MOVE', possession: 'Ready', rera: 'HRERA-TEST-0003', partner: 0 }
];

const TOWERS = [
  { ref: 'TT-AUR-A', id: id('te700000', 1), project: 'TPR-AURORA', name: 'Tower A [TEST]', floors: 4, perFloor: 3 },
  { ref: 'TT-AUR-B', id: id('te700000', 2), project: 'TPR-AURORA', name: 'Tower B [TEST]', floors: 3, perFloor: 2 },
  { ref: 'TT-MER-1', id: id('te700000', 3), project: 'TPR-MERIDIAN', name: 'Block 1 [TEST]', floors: 2, perFloor: 3 }
];

/** Units: generated per tower plus Cedar villas/plots. A few are reserved or archived to test status rules. */
function units() {
  const out = [];
  let n = 0;
  const add = (u) => { n++; out.push({ id: id('te400000', n), ref: `TUN-${String(n).padStart(2, '0')}`, ...u }); };
  for (let f = 1; f <= 4; f++) for (let k = 1; k <= 3; k++) {
    add({ project: 'TPR-AURORA', tower: 'TT-AUR-A', number: `A-${f}0${k}`, floor: f, type: k === 3 ? '3BHK' : '2BHK', category: 'RESIDENTIAL', carpet: k === 3 ? 1350 : 980, superArea: k === 3 ? 1750 : 1280, facing: ['EAST', 'NORTH', 'WEST'][k - 1], price: (k === 3 ? 13500000 : 9200000) + f * 150000, plc: k === 1 ? 200000 : 0 });
  }
  for (let f = 1; f <= 3; f++) for (let k = 1; k <= 2; k++) {
    add({ project: 'TPR-AURORA', tower: 'TT-AUR-B', number: `B-${f}0${k}`, floor: f, type: k === 2 ? '4BHK' : '3BHK', category: 'RESIDENTIAL', carpet: k === 2 ? 2100 : 1420, superArea: k === 2 ? 2650 : 1820, facing: k === 2 ? 'NORTH_EAST' : 'SOUTH', price: (k === 2 ? 21500000 : 14200000) + f * 200000, plc: k === 2 ? 350000 : 0 });
  }
  for (let v = 1; v <= 6; v++) {
    add({ project: 'TPR-CEDAR', tower: null, number: v <= 4 ? `VILLA-${v}` : `PLOT-${v}`, floor: 0, type: v <= 4 ? 'PENTHOUSE' : 'PLOT', category: v <= 4 ? 'RESIDENTIAL' : 'PLOT', carpet: v <= 4 ? 2800 : null, superArea: v <= 4 ? 3400 : null, plot: v <= 4 ? 2400 : 1800, facing: v % 2 ? 'EAST' : 'NORTH', price: v <= 4 ? 32000000 + v * 500000 : 9800000, plc: v === 1 ? 800000 : 0, corner: v === 1 || v === 4 });
  }
  for (let f = 1; f <= 2; f++) for (let k = 1; k <= 3; k++) {
    add({ project: 'TPR-MERIDIAN', tower: 'TT-MER-1', number: `M-${f}0${k}`, floor: f, type: f === 1 ? 'RETAIL' : 'OFFICE', category: 'COMMERCIAL', carpet: f === 1 ? 650 : 1200, superArea: f === 1 ? 900 : 1600, facing: 'NORTH', price: f === 1 ? 18500000 : 16500000, plc: 0 });
  }
  // Status scenarios: one manually reserved unit, one archived unit (everything else available)
  out[11].status = 'HOLD';
  out[11].holdNote = 'Reserved for management quota (manual hold)';
  out[17].status = 'ARCHIVED';
  return out;
}

const CAMPAIGNS = [
  { ref: 'TC-FB', id: id('te600000', 1), name: 'Festive Facebook Leads [TEST]', code: 'TEST-FB-FESTIVE', source: 'FACEBOOK_ADS', project: 'TPR-AURORA', budget: 200000, spend: [[-14, 45000]] },
  { ref: 'TC-GOOGLE', id: id('te600000', 2), name: 'Google Search 3BHK [TEST]', code: 'TEST-GSEARCH', source: 'GOOGLE_ADS', project: 'TPR-AURORA', budget: 150000, spend: [] }
];

// Lead scenarios. f = follow-up in hours from now (negative = overdue), v = site-visit scenario.
// owner refs are users; partner refs are firms. Budgets in rupees.
const L = (n, first, last, src, stage, extra = {}) => ({ ref: `TL-${String(n).padStart(2, '0')}`, id: id('te200000', n), first, last: `${last} [TEST]`, phone: `55503${String(n).padStart(5, "0")}`, email: `tl${String(n).padStart(2, '0')}@example.test`, source: src, stage, ...extra });

const LEADS = [
  // --- Website enquiries (8)
  L(1, 'Aarav', 'Malhotra', 'WEBSITE', 'Fresh Lead', { scenario: 'New website enquiry, not yet assigned', project: 'TPR-AURORA', budget: [9000000, 11000000], config: '2BHK', location: 'Whitefield', temp: 'WARM' }),
  L(2, 'Diya', 'Kulkarni', 'WEBSITE', 'Fresh Lead', { scenario: 'New website enquiry, not yet assigned (assignment test)', project: 'TPR-CEDAR', budget: [30000000, 36000000], config: 'Villa', location: 'Hinjewadi', temp: 'HOT', timeline: 'IMMEDIATE' }),
  L(3, 'Kabir', 'Anand', 'WEBSITE', 'Fresh Lead', { scenario: 'Assigned to Tele 1, never contacted (untouched lead)', owner: 'TU-TELE1', project: 'TPR-AURORA', budget: [12000000, 15000000], config: '3BHK', createdHoursAgo: 6 }),
  L(4, 'Meera', 'Bhatt', 'WEBSITE', 'Contacted', { scenario: 'Follow-up overdue by 30 hours (escalation test)', owner: 'TU-TELE1', f: -30, project: 'TPR-AURORA', budget: [9500000, 10500000], config: '2BHK', contacted: true }),
  L(5, 'Rohan', 'Saxena', 'WEBSITE', 'Contacted', { priority: 'HIGH', scenario: 'Follow-up due today', owner: 'TU-TELE1', f: 3, project: 'TPR-AURORA', budget: [13000000, 14500000], config: '3BHK', contacted: true }),
  L(6, 'Ishita', 'Rao', 'WEBSITE', 'Site Visit Scheduled', { scenario: 'Visit ASSIGNED to Field 1, waiting for acceptance', owner: 'TU-TELE1', v: 'ASSIGNED', project: 'TPR-AURORA', budget: [9000000, 10000000], config: '2BHK', contacted: true }),
  L(7, 'Vihaan', 'Chopra', 'WEBSITE', 'In Negotiation', { scenario: 'Negotiation — ready for booking test (unit A-303)', owner: 'TU-TELE1', f: 20, project: 'TPR-AURORA', budget: [13000000, 14200000], config: '3BHK', contacted: true, qualified: true, temp: 'HOT', visited: true }),
  L(8, 'Anaya', 'Joshi', 'WEBSITE', 'Lost', { scenario: 'Lost — budget mismatch', owner: 'TU-TELE1', lost: 'Budget mismatch', project: 'TPR-AURORA', budget: [5000000, 6000000], config: '2BHK', contacted: true }),
  // --- Facebook campaign (8)
  L(9, 'Arjun', 'Nair', 'FACEBOOK_ADS', 'Fresh Lead', { scenario: 'Facebook campaign lead, unassigned', campaign: 'TC-FB', project: 'TPR-AURORA', budget: [8500000, 9500000], config: '2BHK' }),
  L(10, 'Sara', 'Khan', 'FACEBOOK_ADS', 'Fresh Lead', { scenario: 'Facebook lead assigned to Tele 2, untouched', campaign: 'TC-FB', owner: 'TU-TELE2', project: 'TPR-AURORA', budget: [9000000, 9800000], config: '2BHK', createdHoursAgo: 3 }),
  L(11, 'Reyansh', 'Gupta', 'FACEBOOK_ADS', 'Contacted', { scenario: 'Follow-up overdue by 5 hours', campaign: 'TC-FB', owner: 'TU-TELE2', f: -5, project: 'TPR-AURORA', budget: [12500000, 14000000], config: '3BHK', contacted: true }),
  L(12, 'Myra', 'Pillai', 'FACEBOOK_ADS', 'Contacted', { scenario: 'Follow-up tomorrow; original of duplicate TL-50', campaign: 'TC-FB', owner: 'TU-TELE2', f: 26, project: 'TPR-AURORA', budget: [9200000, 10000000], config: '2BHK', contacted: true }),
  L(13, 'Atharv', 'Reddy', 'FACEBOOK_ADS', 'Site Visit Scheduled', { scenario: 'Visit SCHEDULED (accepted, confirmed) with Field 1 tomorrow', campaign: 'TC-FB', owner: 'TU-TELE2', v: 'SCHEDULED', project: 'TPR-AURORA', budget: [13500000, 15000000], config: '3BHK', contacted: true }),
  L(14, 'Kiara', 'Menon', 'FACEBOOK_ADS', 'Site Visit Done', { scenario: 'Visit completed, client warm', campaign: 'TC-FB', owner: 'TU-TELE2', v: 'COMPLETED', f: 22, project: 'TPR-AURORA', budget: [9000000, 9800000], config: '2BHK', contacted: true, temp: 'WARM' }),
  L(15, 'Vivaan', 'Das', 'FACEBOOK_ADS', 'In Negotiation', { scenario: 'Negotiation — booking with discount above threshold (approval test)', campaign: 'TC-FB', owner: 'TU-TELE2', f: 24, project: 'TPR-AURORA', budget: [9200000, 9600000], config: '2BHK', contacted: true, qualified: true, visited: true, temp: 'HOT' }),
  L(16, 'Aadhya', 'Iyer', 'FACEBOOK_ADS', 'Lost', { scenario: 'Lost — bought elsewhere', campaign: 'TC-FB', owner: 'TU-TELE2', lost: 'Bought elsewhere', project: 'TPR-AURORA', budget: [8000000, 9000000], config: '2BHK', contacted: true }),
  // --- Google Ads (7)
  L(17, 'Ayaan', 'Bose', 'GOOGLE_ADS', 'Fresh Lead', { scenario: 'Google lead, unassigned (bulk assignment test)', campaign: 'TC-GOOGLE', project: 'TPR-AURORA', budget: [13000000, 15000000], config: '3BHK' }),
  L(18, 'Navya', 'Shetty', 'GOOGLE_ADS', 'Fresh Lead', { scenario: 'Google lead, unassigned (bulk assignment test)', campaign: 'TC-GOOGLE', project: 'TPR-AURORA', budget: [14000000, 16000000], config: '3BHK' }),
  L(19, 'Krishna', 'Pandey', 'GOOGLE_ADS', 'Contacted', { priority: 'HIGH', scenario: 'Follow-up due today (call test)', campaign: 'TC-GOOGLE', owner: 'TU-TELE1', f: 1, project: 'TPR-AURORA', budget: [13800000, 14800000], config: '3BHK', contacted: true }),
  L(20, 'Zara', 'Ahmed', 'GOOGLE_ADS', 'Site Visit Scheduled', { scenario: 'Visit REQUESTED with no field agent (allocation test)', campaign: 'TC-GOOGLE', owner: 'TU-TELE1', v: 'REQUESTED', project: 'TPR-AURORA', budget: [14000000, 15500000], config: '3BHK', contacted: true }),
  L(21, 'Shaurya', 'Kapoor', 'GOOGLE_ADS', 'Site Visit Done', { scenario: 'Visit MISSED (client no-show), needs re-fix', campaign: 'TC-GOOGLE', owner: 'TU-TELE1', v: 'MISSED', f: -2, project: 'TPR-AURORA', budget: [13000000, 14000000], config: '3BHK', contacted: true }),
  L(22, 'Anika', 'Sinha', 'GOOGLE_ADS', 'In Negotiation', { scenario: 'Negotiation — 4BHK, high budget (booking + finance test)', campaign: 'TC-GOOGLE', owner: 'TU-TELE1', f: 18, project: 'TPR-AURORA', budget: [21000000, 23000000], config: '4BHK', contacted: true, qualified: true, visited: true, temp: 'HOT', timeline: 'IMMEDIATE' }),
  L(23, 'Dhruv', 'Mishra', 'GOOGLE_ADS', 'Lost', { scenario: 'Lost — location', campaign: 'TC-GOOGLE', owner: 'TU-TELE1', lost: 'Location', project: 'TPR-AURORA', budget: [12000000, 13000000], config: '3BHK', contacted: true }),
  // --- Walk-ins (6)
  L(24, 'Saanvi', 'Agarwal', 'WALK_IN', 'Fresh Lead', { scenario: 'Walk-in, assigned to Field 1, untouched', owner: 'TU-FIELD1', project: 'TPR-CEDAR', budget: [9500000, 10000000], config: 'Plot', location: 'Hinjewadi', createdHoursAgo: 2 }),
  L(25, 'Arnav', 'Thakur', 'WALK_IN', 'Contacted', { scenario: 'Walk-in, follow-up in 3 days', owner: 'TU-FIELD1', f: 72, project: 'TPR-CEDAR', budget: [32000000, 34000000], config: 'Villa', contacted: true }),
  L(26, 'Pari', 'Chauhan', 'WALK_IN', 'Site Visit Scheduled', { scenario: 'Visit CANCELLED earlier, lead back to follow-up', owner: 'TU-FIELD1', v: 'CANCELLED', f: 6, project: 'TPR-CEDAR', budget: [33000000, 35000000], config: 'Villa', contacted: true }),
  L(27, 'Rudra', 'Yadav', 'WALK_IN', 'Site Visit Done', { scenario: 'Visit completed at Meridian (commercial buyer)', owner: 'TU-FIELD2', v: 'COMPLETED_MER', f: 30, project: 'TPR-MERIDIAN', budget: [16000000, 19000000], config: 'Office', property: 'COMMERCIAL', contacted: true }),
  L(28, 'Avni', 'Patil', 'WALK_IN', 'In Negotiation', { scenario: 'Negotiation — commercial office M-201', owner: 'TU-FIELD2', f: 20, project: 'TPR-MERIDIAN', budget: [16000000, 17000000], config: 'Office', property: 'COMMERCIAL', contacted: true, qualified: true, visited: true }),
  L(29, 'Laksh', 'Dubey', 'WALK_IN', 'Lost', { scenario: 'Lost — not reachable', owner: 'TU-FIELD2', lost: 'Not reachable', project: 'TPR-MERIDIAN', budget: [15000000, 16000000], config: 'Retail', property: 'COMMERCIAL', contacted: true }),
  // --- Referrals (6)
  L(30, 'Ira', 'Bajaj', 'REFERRAL', 'Fresh Lead', { scenario: 'Referral, unassigned, high priority', project: 'TPR-CEDAR', budget: [34000000, 36000000], config: 'Villa', temp: 'HOT', timeline: 'IMMEDIATE' }),
  L(31, 'Advik', 'Sood', 'REFERRAL', 'Contacted', { scenario: 'Referral, follow-up overdue 50 hours', owner: 'TU-TELE2', f: -50, project: 'TPR-CEDAR', budget: [32000000, 33500000], config: 'Villa', contacted: true }),
  L(32, 'Riya', 'Tandon', 'REFERRAL', 'Contacted', { priority: 'HIGH', scenario: 'Referral, qualified, follow-up today', owner: 'TU-TELE2', f: 5, project: 'TPR-AURORA', budget: [14000000, 15000000], config: '3BHK', contacted: true, qualified: true }),
  L(33, 'Yuvan', 'Ghosh', 'REFERRAL', 'Site Visit Scheduled', { scenario: 'Visit SCHEDULED with Field 2 (reschedule test)', owner: 'TU-TELE2', v: 'SCHEDULED_F2', project: 'TPR-CEDAR', budget: [31000000, 33000000], config: 'Villa', contacted: true }),
  L(34, 'Tanvi', 'Arora', 'REFERRAL', 'Site Visit Done', { scenario: 'Visit completed, hot', owner: 'TU-TELE2', v: 'COMPLETED', f: 12, project: 'TPR-AURORA', budget: [13500000, 14500000], config: '3BHK', contacted: true, temp: 'HOT' }),
  L(35, 'Neel', 'Bhasin', 'REFERRAL', 'Lost', { scenario: 'Lost — just browsing', owner: 'TU-TELE2', lost: 'Just browsing', project: 'TPR-AURORA', budget: [9000000, 9500000], config: '2BHK', contacted: true }),
  // --- Channel partners (8: Alpha 5, Beta 3)
  L(36, 'Om', 'Prakash', 'CHANNEL_PARTNER', 'Fresh Lead', { scenario: 'Alpha partner client, assigned to Tele 1 (partner visibility test)', partner: 'TP-FIRM-A', owner: 'TU-TELE1', project: 'TPR-AURORA', budget: [9000000, 10000000], config: '2BHK', createdHoursAgo: 1 }),
  L(37, 'Kavya', 'Rastogi', 'CHANNEL_PARTNER', 'Contacted', { priority: 'HIGH', scenario: 'Alpha client, follow-up today', partner: 'TP-FIRM-A', owner: 'TU-TELE1', f: 4, project: 'TPR-AURORA', budget: [13000000, 14000000], config: '3BHK', contacted: true }),
  L(38, 'Aryan', 'Kohli', 'CHANNEL_PARTNER', 'Site Visit Scheduled', { scenario: 'Alpha client, visit SCHEDULED with Field 1', partner: 'TP-FIRM-A', owner: 'TU-TELE1', v: 'SCHEDULED', project: 'TPR-AURORA', budget: [9200000, 10200000], config: '2BHK', contacted: true }),
  L(39, 'Mahi', 'Sharma', 'CHANNEL_PARTNER', 'In Negotiation', { scenario: 'Alpha client in negotiation — booking earns partner commission', partner: 'TP-FIRM-A', owner: 'TU-TELE1', f: 16, project: 'TPR-AURORA', budget: [9300000, 9900000], config: '2BHK', contacted: true, qualified: true, visited: true, temp: 'HOT' }),
  L(40, 'Veer', 'Malik', 'CHANNEL_PARTNER', 'Lost', { scenario: 'Alpha client lost (partner may re-register after protection)', partner: 'TP-FIRM-A', owner: 'TU-TELE1', lost: 'Loan not approved', project: 'TPR-AURORA', budget: [9000000, 9500000], config: '2BHK', contacted: true, protectionExpired: true }),
  L(41, 'Siya', 'Batra', 'CHANNEL_PARTNER', 'Fresh Lead', { scenario: 'Beta partner client, unassigned', partner: 'TP-FIRM-B', project: 'TPR-CEDAR', budget: [32000000, 34000000], config: 'Villa' }),
  L(42, 'Kian', 'Ahuja', 'CHANNEL_PARTNER', 'Contacted', { priority: 'HIGH', scenario: 'Beta client, follow-up tomorrow', partner: 'TP-FIRM-B', owner: 'TU-TELE2', f: 28, project: 'TPR-CEDAR', budget: [9500000, 10000000], config: 'Plot', contacted: true }),
  L(43, 'Ahana', 'Dutta', 'CHANNEL_PARTNER', 'Site Visit Done', { scenario: 'Beta client, visit completed', partner: 'TP-FIRM-B', owner: 'TU-TELE2', v: 'COMPLETED_CEDAR', f: 20, project: 'TPR-CEDAR', budget: [33000000, 34500000], config: 'Villa', contacted: true }),
  // --- Manual entries (7)
  L(44, 'Ritvik', 'Jain', 'DIRECT_CALL', 'Fresh Lead', { scenario: 'Manual entry, unassigned, low budget (low priority)', project: 'TPR-AURORA', budget: [7000000, 8000000], config: '2BHK', temp: 'COLD' }),
  L(45, 'Prisha', 'Goel', 'DIRECT_CALL', 'Contacted', { scenario: 'Manual entry, not qualified', owner: 'TU-TELE1', f: 48, project: 'TPR-AURORA', budget: [6000000, 7000000], config: '2BHK', contacted: true, notQualified: true }),
  L(46, 'Darsh', 'Vohra', 'DIRECT_CALL', 'Contacted', { scenario: 'Manual entry, follow-up overdue 2 hours', owner: 'TU-TELE2', f: -2, project: 'TPR-MERIDIAN', budget: [17000000, 19000000], config: 'Retail', property: 'COMMERCIAL', contacted: true }),
  L(47, 'Inaya', 'Chawla', 'DIRECT_CALL', 'Contacted', { scenario: 'Manual entry, no follow-up set (stale lead)', owner: 'TU-TELE2', f: null, project: 'TPR-AURORA', budget: [9000000, 9600000], config: '2BHK', contacted: true }),
  L(48, 'Yash', 'Mathur', 'DIRECT_CALL', 'Contacted', { scenario: 'Duplicate check: shares email with TL-49', owner: 'TU-TELE1', f: 30, project: 'TPR-AURORA', budget: [12000000, 13000000], config: '3BHK', contacted: true, email: 'shared.family@example.test' }),
  L(49, 'Nisha', 'Mathur', 'DIRECT_CALL', 'Fresh Lead', { scenario: 'Duplicate check: same email as TL-48, different phone', project: 'TPR-AURORA', budget: [12000000, 13000000], config: '3BHK', email: 'shared.family@example.test' }),
  L(50, 'Myra', 'Pillai', 'FACEBOOK_ADS', 'Duplicate', { scenario: 'Marked as duplicate of TL-12 (imported twice)', campaign: 'TC-FB', owner: 'TU-TELE2', duplicateOf: 'TL-12', lost: 'Duplicate of TL-12', project: 'TPR-AURORA', budget: [9200000, 10000000], config: '2BHK', email: 'tl12.alt@example.test' })
];

module.exports = { PASSWORD, USERS, FIRMS, PROJECTS, TOWERS, units, CAMPAIGNS, LEADS, id };
