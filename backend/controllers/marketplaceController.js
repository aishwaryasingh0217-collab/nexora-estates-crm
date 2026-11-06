const crypto = require('crypto');
const pool = require('../config/db');
const { captureQuietly } = require('../services/enquiryService');

/**
 * 🏢 NEXORA MARKETPLACE & GROWTH ENGINE CONTROLLER
 * Powers Multi-Segment Listings (Primary Sale, Resale, Rental), 
 * Priority Pass (Pre-launch FOMO EOI), Group Buying (Pool & Save),
 * 7-Day Resale Deal Rooms, and Channel Partner 60-Day Lead Locks.
 * 
 * Features automatic database-first execution with seamless 
 * in-memory fallback for high-resilience development and demo sessions.
 */

// In-Memory Fallback Store (Used if MySQL connection is unavailable or tables are pending)
const memoryStore = {
  listings: [
    {
      id: 'u-sample-1',
      project_id: 'p1000000-0000-4000-8000-000000000001',
      project_name: 'Greenfield Heights',
      project_location: 'Whitefield Main Road, Bangalore',
      builder_developer: 'Nexora Infrastructure Ltd.',
      rera_number: 'PRM/KA/RERA/1251/446/PR/210312/004012',
      unit_number: 'Tower A - 402',
      unit_type: '3BHK',
      carpet_area_sqft: 1420,
      base_price: 12500000,
      status: 'AVAILABLE',
      listing_type: 'NEW_LAUNCH',
      is_verified_listing: 1
    },
    {
      id: 'u-sample-2',
      project_id: 'p1000000-0000-4000-8000-000000000001',
      project_name: 'Greenfield Heights',
      project_location: 'Whitefield Main Road, Bangalore',
      builder_developer: 'Nexora Infrastructure Ltd.',
      rera_number: 'PRM/KA/RERA/1251/446/PR/210312/004012',
      unit_number: 'Tower B - 702',
      unit_type: '3BHK',
      carpet_area_sqft: 1480,
      base_price: 13500000,
      status: 'AVAILABLE',
      listing_type: 'RESALE',
      owner_seller_name: 'Rajesh K. Singhania',
      is_verified_listing: 1
    },
    {
      id: 'u-sample-3',
      project_id: 'p2000000-0000-4000-8000-000000000002',
      project_name: 'Grand Horizon Plaza',
      project_location: 'BKC Corporate Zone, Mumbai',
      builder_developer: 'Nexora Horizon Realty',
      rera_number: 'P51800028912',
      unit_number: 'Suite 304-R',
      unit_type: '2BHK',
      carpet_area_sqft: 1050,
      base_price: 0,
      rental_monthly_rent: 45000,
      rental_deposit: 150000,
      furnishing_status: 'FULLY_FURNISHED',
      status: 'AVAILABLE',
      listing_type: 'RENTAL',
      owner_seller_name: 'Kavita Menon',
      is_verified_listing: 1
    }
  ],
  priorityPasses: [
    {
      id: 'pass-1',
      project_id: 'p1000000-0000-4000-8000-000000000001',
      project_name: 'Greenfield Heights',
      pass_number: 'NX-PASS-GFH-0001',
      buyer_name: 'Arjun Kapoor',
      buyer_phone: '+91 99201 12233',
      token_amount: 21000,
      discount_benefit_text: '₹500/sq.ft off Day-1 Launch Price',
      priority_rank: 1,
      status: 'ACTIVE',
      created_at: new Date()
    },
    {
      id: 'pass-2',
      project_id: 'p1000000-0000-4000-8000-000000000001',
      project_name: 'Greenfield Heights',
      pass_number: 'NX-PASS-GFH-0002',
      buyer_name: 'Sunita Reddy',
      buyer_phone: '+91 98402 23344',
      token_amount: 21000,
      discount_benefit_text: '₹500/sq.ft off Day-1 Launch Price',
      priority_rank: 2,
      status: 'ACTIVE',
      created_at: new Date()
    },
    {
      id: 'pass-3',
      project_id: 'p2000000-0000-4000-8000-000000000002',
      project_name: 'Grand Horizon Plaza',
      pass_number: 'NX-PASS-GHP-0001',
      buyer_name: 'Manish Goel',
      buyer_phone: '+91 98113 34455',
      token_amount: 21000,
      discount_benefit_text: 'VIP Floor Plate Allocation',
      priority_rank: 1,
      status: 'ACTIVE',
      created_at: new Date()
    }
  ],
  groupPools: [
    {
      id: 'pool-1',
      project_id: 'p1000000-0000-4000-8000-000000000001',
      project_name: 'Greenfield Heights',
      location: 'Whitefield Main Road, Bangalore',
      pool_title: 'Whitefield Techies 3BHK Group - Greenfield Heights',
      target_buyers: 5,
      current_buyers: 4,
      progress_percentage: 80,
      spots_remaining: 1,
      discount_percentage: 6,
      flat_discount_amount: 500000,
      status: 'OPEN',
      share_code: 'POOL-WFTECH',
      created_at: new Date()
    },
    {
      id: 'pool-2',
      project_id: 'p2000000-0000-4000-8000-000000000002',
      project_name: 'Grand Horizon Plaza',
      location: 'BKC Corporate Zone, Mumbai',
      pool_title: 'BKC Corporates Bulk Investor Pool',
      target_buyers: 6,
      current_buyers: 6,
      progress_percentage: 100,
      spots_remaining: 0,
      discount_percentage: 7.5,
      flat_discount_amount: 750000,
      status: 'DISCOUNT_UNLOCKED',
      share_code: 'POOL-BKCCORP',
      created_at: new Date()
    }
  ],
  dealRooms: [
    {
      id: 'room-1',
      unit_id: 'u-sample-2',
      unit_number: 'Tower B - 702',
      unit_type: '3BHK',
      carpet_area_sqft: 1480,
      project_name: 'Greenfield Heights',
      location: 'Whitefield, Bangalore',
      seller_name: 'Rajesh K. Singhania',
      seller_phone: '+91 98200 98765',
      reserve_price: 13000000,
      current_highest_bid: 13450000,
      bid_count: 4,
      hours_remaining: 46,
      status: 'ACTIVE'
    }
  ],
  cpLeadLocks: [
    {
      id: 'lock-1',
      channel_partner_id: 'cp100000-0000-4000-8000-000000000001',
      firm_name: 'Apex Realty Advisors',
      broker_name: 'Vikram Malhotra',
      client_name: 'Gaurav Khanna',
      client_phone: '+91 98450 99887',
      project_id: 'p1000000-0000-4000-8000-000000000001',
      project_name: 'Greenfield Heights',
      days_remaining: 48,
      status: 'ACTIVE_LOCKED',
      locked_until: new Date(Date.now() + 48 * 86400000)
    },
    {
      id: 'lock-2',
      channel_partner_id: 'cp200000-0000-4000-8000-000000000002',
      firm_name: 'Metro Square Properties',
      broker_name: 'Ramesh Shenoy',
      client_name: 'Anita Desai',
      client_phone: '+91 98201 55443',
      project_id: 'p2000000-0000-4000-8000-000000000002',
      project_name: 'Grand Horizon Plaza',
      days_remaining: 32,
      status: 'ACTIVE_LOCKED',
      locked_until: new Date(Date.now() + 32 * 86400000)
    }
  ]
};

// ==========================================
// 1. MULTI-SEGMENT MARKETPLACE LISTINGS
// ==========================================

const getMarketplaceListings = async (req, res, next) => {
  try {
    const { listing_type, unit_type, min_price, max_price, project_id } = req.query;

    try {
      let query = `
        SELECT u.*,
               p.name AS project_name,
               p.location AS project_location,
               p.builder_developer,
               p.rera_number,
               p.possession_date,
               p.hero_image_url AS project_image,
               b.name AS building_name
        FROM units u
        JOIN projects p ON u.project_id = p.id
        LEFT JOIN buildings b ON u.building_id = b.id
        WHERE 1=1
      `;
      const params = [];

      if (listing_type) {
        query += ` AND (u.listing_type = ? OR (u.listing_type IS NULL AND ? = 'NEW_LAUNCH'))`;
        params.push(listing_type.toUpperCase(), listing_type.toUpperCase());
      }
      if (unit_type) {
        query += ` AND u.unit_type = ?`;
        params.push(unit_type.toUpperCase());
      }
      if (project_id) {
        query += ` AND u.project_id = ?`;
        params.push(project_id);
      }

      query += ` ORDER BY u.created_at DESC LIMIT 100`;

      const [listings] = await pool.query(query, params);
      if (listings && listings.length > 0) {
        return res.status(200).json({ status: 'success', results: listings.length, data: listings });
      }
    } catch (dbErr) {
      console.warn('[Marketplace DB Fallback] Using memory listings store:', dbErr.message);
    }

    // In-memory filter fallback
    let results = [...memoryStore.listings];
    if (listing_type) {
      results = results.filter(l => l.listing_type === listing_type.toUpperCase());
    }
    if (unit_type) {
      results = results.filter(l => l.unit_type === unit_type.toUpperCase());
    }

    res.status(200).json({
      status: 'success',
      results: results.length,
      data: results
    });
  } catch (error) {
    next(error);
  }
};

const getMarketplaceSummary = async (req, res, next) => {
  try {
    try {
      const [counts] = await pool.query(`
        SELECT 
          COUNT(CASE WHEN listing_type = 'NEW_LAUNCH' OR listing_type IS NULL THEN 1 END) AS primary_units,
          COUNT(CASE WHEN listing_type = 'RESALE' THEN 1 END) AS resale_units,
          COUNT(CASE WHEN listing_type = 'RENTAL' THEN 1 END) AS rental_units,
          COUNT(CASE WHEN is_verified_listing = TRUE THEN 1 END) AS verified_listings
        FROM units
      `);

      return res.status(200).json({
        status: 'success',
        data: {
          segments: counts[0] || { primary_units: 3, resale_units: 1, rental_units: 1, verified_listings: 5 },
          priority_passes: { total_passes: memoryStore.priorityPasses.length, total_eoi_escrow: memoryStore.priorityPasses.length * 21000 },
          group_pools: { active_pools: memoryStore.groupPools.length, pooled_buyers: 10 }
        }
      });
    } catch (dbErr) {
      // Fallback
      return res.status(200).json({
        status: 'success',
        data: {
          segments: { primary_units: 4, resale_units: 2, rental_units: 2, verified_listings: 8 },
          priority_passes: { total_passes: memoryStore.priorityPasses.length, total_eoi_escrow: memoryStore.priorityPasses.length * 21000 },
          group_pools: { active_pools: memoryStore.groupPools.length, pooled_buyers: 10 }
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. PRIORITY PASS (PRE-LAUNCH FOMO ENGINE)
// ==========================================

const getPriorityPasses = async (req, res, next) => {
  try {
    try {
      const [passes] = await pool.query(`
        SELECT pp.*, p.name AS project_name, p.builder_developer, p.location
        FROM priority_passes pp
        JOIN projects p ON pp.project_id = p.id
        ORDER BY pp.priority_rank ASC
      `);
      if (passes && passes.length > 0) {
        return res.status(200).json({ status: 'success', results: passes.length, data: passes });
      }
    } catch (dbErr) {
      console.warn('[PriorityPass DB Fallback]:', dbErr.message);
    }

    res.status(200).json({
      status: 'success',
      results: memoryStore.priorityPasses.length,
      data: memoryStore.priorityPasses
    });
  } catch (error) {
    next(error);
  }
};

const createPriorityPass = async (req, res, next) => {
  try {
    const { project_id, buyer_name, buyer_phone, buyer_email, token_amount, discount_benefit_text } = req.body;

    if (!project_id || !buyer_name || !buyer_phone) {
      return res.status(400).json({ status: 'error', message: 'project_id, buyer_name, and buyer_phone are mandatory.' });
    }

    const priorityRank = memoryStore.priorityPasses.length + 1;
    const passNumber = `NX-PASS-${project_id.substring(0, 4).toUpperCase()}-${String(priorityRank).padStart(4, '0')}`;
    const token = token_amount ? parseFloat(token_amount) : 21000.00;

    const newPass = {
      id: crypto.randomUUID(),
      project_id,
      project_name: project_id.includes('p2') ? 'Grand Horizon Plaza' : 'Greenfield Heights',
      pass_number: passNumber,
      buyer_name,
      buyer_phone,
      buyer_email: buyer_email || null,
      token_amount: token,
      discount_benefit_text: discount_benefit_text || '₹500/sq.ft off Day-1 Launch Price',
      priority_rank: priorityRank,
      status: 'ACTIVE',
      created_at: new Date()
    };

    try {
      await pool.query(
        `INSERT INTO priority_passes 
         (id, project_id, pass_number, buyer_name, buyer_phone, buyer_email, token_amount, discount_benefit_text, priority_rank, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
        [newPass.id, project_id, passNumber, buyer_name, buyer_phone, buyer_email || null, token, newPass.discount_benefit_text, priorityRank]
      );
    } catch (dbErr) {
      console.warn('[Create PriorityPass DB Fallback]:', dbErr.message);
    }

    memoryStore.priorityPasses.unshift(newPass);
    // A buyer who paid a token is the hottest lead there is — put them in front of the sales team now
    captureQuietly({ full_name: buyer_name, phone: buyer_phone, email: buyer_email, project_id, source: 'PRIORITY_PASS', temperature: 'HOT',
      message: `Took priority pass ${passNumber} (token ₹${token.toLocaleString('en-IN')})` });

    res.status(201).json({
      status: 'success',
      message: 'Priority Pass issued successfully with 48h early allocation rights.',
      data: newPass
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. GROUP BUYING ("POOL & SAVE" VIRAL ENGINE)
// ==========================================

const getGroupPools = async (req, res, next) => {
  try {
    try {
      const [pools] = await pool.query(`
        SELECT gbp.*, p.name AS project_name, p.location,
               ROUND((gbp.current_buyers / gbp.target_buyers) * 100, 1) AS progress_percentage,
               (gbp.target_buyers - gbp.current_buyers) AS spots_remaining
        FROM group_buying_pools gbp
        JOIN projects p ON gbp.project_id = p.id
        ORDER BY gbp.created_at DESC
      `);
      if (pools && pools.length > 0) {
        return res.status(200).json({ status: 'success', results: pools.length, data: pools });
      }
    } catch (dbErr) {
      console.warn('[GroupPool DB Fallback]:', dbErr.message);
    }

    res.status(200).json({
      status: 'success',
      results: memoryStore.groupPools.length,
      data: memoryStore.groupPools
    });
  } catch (error) {
    next(error);
  }
};

const createGroupPool = async (req, res, next) => {
  try {
    const { project_id, pool_title, target_buyers, discount_percentage, flat_discount_amount } = req.body;

    if (!project_id || !pool_title) {
      return res.status(400).json({ status: 'error', message: 'project_id and pool_title are required.' });
    }

    const shareCode = `POOL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const newPool = {
      id: crypto.randomUUID(),
      project_id,
      project_name: project_id.includes('p2') ? 'Grand Horizon Plaza' : 'Greenfield Heights',
      location: project_id.includes('p2') ? 'BKC Corporate Zone, Mumbai' : 'Whitefield Main Road, Bangalore',
      pool_title,
      target_buyers: target_buyers ? parseInt(target_buyers) : 5,
      current_buyers: 1,
      progress_percentage: 20,
      spots_remaining: (target_buyers ? parseInt(target_buyers) : 5) - 1,
      discount_percentage: discount_percentage ? parseFloat(discount_percentage) : 6.00,
      flat_discount_amount: flat_discount_amount ? parseFloat(flat_discount_amount) : 500000.00,
      status: 'OPEN',
      share_code: shareCode,
      created_at: new Date()
    };

    try {
      // The pool list reads the database, so a pool that only lived in memory never appeared
      await pool.query(
        `INSERT INTO group_buying_pools (id, project_id, pool_title, target_buyers, current_buyers, discount_percentage,
                                         flat_discount_amount, deadline, status, share_code)
         VALUES (?, ?, ?, ?, 1, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), 'OPEN', ?)`,
        [newPool.id, project_id, String(pool_title).slice(0, 150), newPool.target_buyers, newPool.discount_percentage, newPool.flat_discount_amount, shareCode]
      );
    } catch (dbErr) {
      console.warn('[Create GroupPool DB Fallback]:', dbErr.message);
      memoryStore.groupPools.unshift(newPool);
    }

    res.status(201).json({
      status: 'success',
      message: 'Group buying pool launched successfully.',
      data: newPool
    });
  } catch (error) {
    next(error);
  }
};

const joinGroupPool = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { buyer_name, buyer_phone, unit_type_preference } = req.body || {};
    if (!buyer_name || String(buyer_phone || '').replace(/\D/g, '').length < 10) {
      return res.status(400).json({ status: 'error', message: 'Name and a valid 10-digit mobile number are required to join.' });
    }
    const phoneKey = String(buyer_phone).replace(/\D/g, '').slice(-10);

    let gp = null;
    try { [[gp]] = await pool.query('SELECT * FROM group_buying_pools WHERE id = ?', [id]); } catch (dbErr) { console.warn('[GroupPool DB]', dbErr.message); }

    if (gp) {
      if (!['OPEN', 'DISCOUNT_UNLOCKED'].includes(gp.status) || new Date(gp.deadline) < new Date()) {
        return res.status(400).json({ status: 'error', message: 'This pool has closed.' });
      }
      const [[already]] = await pool.query(
        `SELECT id FROM group_pool_members WHERE pool_id = ? AND RIGHT(REGEXP_REPLACE(buyer_phone, '[^0-9]', ''), 10) = ? LIMIT 1`,
        [gp.id, phoneKey]
      );
      if (!already) {
        await pool.query(
          `INSERT INTO group_pool_members (id, pool_id, buyer_name, buyer_phone, unit_type_preference) VALUES (?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), gp.id, String(buyer_name).slice(0, 100), String(buyer_phone).slice(0, 20), unit_type_preference || '3BHK']
        );
        await pool.query(
          `UPDATE group_buying_pools SET current_buyers = current_buyers + 1,
                  status = IF(current_buyers >= target_buyers, 'DISCOUNT_UNLOCKED', status) WHERE id = ?`,
          [gp.id]
        );
        captureQuietly({ full_name: buyer_name, phone: buyer_phone, project_id: gp.project_id, source: 'GROUP_BUY', temperature: 'HOT', message: `Joined group-buy pool "${gp.pool_title}"` });
      }
      const [[fresh]] = await pool.query(
        `SELECT gbp.*, ROUND((gbp.current_buyers / gbp.target_buyers) * 100, 1) AS progress_percentage,
                GREATEST(gbp.target_buyers - gbp.current_buyers, 0) AS spots_remaining
           FROM group_buying_pools gbp WHERE gbp.id = ?`,
        [gp.id]
      );
      return res.status(already ? 200 : 201).json({
        status: 'success',
        message: already
          ? "You're already in this pool — we'll keep you posted."
          : fresh.status === 'DISCOUNT_UNLOCKED'
            ? `Group discount of ₹${Number(fresh.flat_discount_amount).toLocaleString('en-IN')} is unlocked for all members!`
            : `You're in! ${fresh.spots_remaining} more buyer${Number(fresh.spots_remaining) === 1 ? '' : 's'} needed to unlock the discount.`,
        data: fresh
      });
    }

    // Demo data without a database row (development fallback)
    const poolData = memoryStore.groupPools.find((x) => x.id === id);
    if (!poolData) return res.status(404).json({ status: 'error', message: 'Pool not found.' });
    poolData.current_buyers += 1;
    poolData.spots_remaining = Math.max(0, poolData.target_buyers - poolData.current_buyers);
    poolData.progress_percentage = Math.min(100, Math.round((poolData.current_buyers / poolData.target_buyers) * 100));
    if (poolData.current_buyers >= poolData.target_buyers) poolData.status = 'DISCOUNT_UNLOCKED';
    captureQuietly({ full_name: buyer_name, phone: buyer_phone, project_id: poolData.project_id, source: 'GROUP_BUY', temperature: 'HOT', message: `Joined group-buy pool "${poolData.pool_title}"` });
    res.status(201).json({ status: 'success', message: `You're in! ${poolData.spots_remaining} more buyers needed to unlock the discount.`, data: poolData });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. 7-DAY RESALE DEAL ROOM (TRANSPARENT OFFERS)
// ==========================================

const getResaleDealRooms = async (req, res, next) => {
  try {
    try {
      const [rooms] = await pool.query(`
        SELECT rdr.*, u.unit_number, u.unit_type, u.carpet_area_sqft, p.name AS project_name, p.location
        FROM resale_deal_rooms rdr
        JOIN units u ON rdr.unit_id = u.id
        JOIN projects p ON u.project_id = p.id
      `);
      if (rooms && rooms.length > 0) {
        return res.status(200).json({ status: 'success', results: rooms.length, data: rooms });
      }
    } catch (dbErr) {
      console.warn('[DealRooms DB Fallback]:', dbErr.message);
    }

    res.status(200).json({
      status: 'success',
      results: memoryStore.dealRooms.length,
      data: memoryStore.dealRooms
    });
  } catch (error) {
    next(error);
  }
};

const placeResaleBid = async (req, res, next) => {
  const { id } = req.params;
  const { bidder_name, bidder_phone, bid_amount, is_preapproved_loan } = req.body || {};
  const amount = parseFloat(bid_amount);
  if (!bidder_name || String(bidder_phone || '').replace(/\D/g, '').length < 10 || !(amount > 0)) {
    return res.status(400).json({ status: 'error', message: 'Name, a valid mobile number and an offer amount are required.' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[room]] = await conn.query(
      `SELECT rdr.*, u.unit_number, u.project_id FROM resale_deal_rooms rdr LEFT JOIN units u ON u.id = rdr.unit_id WHERE rdr.id = ? FOR UPDATE`,
      [id]
    );
    if (room) {
      if (room.status !== 'ACTIVE' || new Date(room.ends_at) < new Date()) {
        await conn.rollback();
        return res.status(400).json({ status: 'error', message: 'This deal room is closed for offers.' });
      }
      const floor = Math.max(Number(room.current_highest_bid) || 0, Number(room.reserve_price) || 0);
      if (amount <= Number(room.current_highest_bid)) {
        await conn.rollback();
        return res.status(400).json({ status: 'error', message: `Your offer must be higher than the current top offer of ₹${Number(room.current_highest_bid).toLocaleString('en-IN')}.` });
      }
      await conn.query(`UPDATE resale_bids SET status = 'OUTBID' WHERE deal_room_id = ? AND status = 'SUBMITTED'`, [room.id]);
      await conn.query(
        `INSERT INTO resale_bids (id, deal_room_id, bidder_name, bidder_phone, bid_amount, is_preapproved_loan) VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), room.id, String(bidder_name).slice(0, 100), String(bidder_phone).slice(0, 20), amount, Boolean(is_preapproved_loan)]
      );
      await conn.query('UPDATE resale_deal_rooms SET current_highest_bid = ?, bid_count = bid_count + 1 WHERE id = ?', [amount, room.id]);
      await conn.commit();
      captureQuietly({ full_name: bidder_name, phone: bidder_phone, project_id: room.project_id, source: 'RESALE_OFFER', temperature: 'HOT',
        message: `Made an offer of ₹${amount.toLocaleString('en-IN')} on resale unit ${room.unit_number || room.unit_id}${amount < floor ? ' (below the seller\'s reserve)' : ''}` });
      return res.status(201).json({
        status: 'success',
        message: amount < Number(room.reserve_price)
          ? "Offer recorded. It's below the seller's reserve price, so our advisor will call you to discuss."
          : 'Offer placed — you are the top bidder. Our advisor will call you shortly.',
        data: { new_highest_bid: amount, bid_count: Number(room.bid_count) + 1 }
      });
    }
    await conn.rollback();

    // Demo data without a database row (development fallback)
    const mem = memoryStore.dealRooms.find((r) => r.id === id);
    if (!mem) return res.status(404).json({ status: 'error', message: 'Deal room not found.' });
    if (amount <= mem.current_highest_bid) {
      return res.status(400).json({ status: 'error', message: `Your offer must be higher than the current top offer of ₹${mem.current_highest_bid.toLocaleString('en-IN')}.` });
    }
    mem.current_highest_bid = amount;
    mem.bid_count += 1;
    captureQuietly({ full_name: bidder_name, phone: bidder_phone, source: 'RESALE_OFFER', temperature: 'HOT', message: `Made an offer of ₹${amount.toLocaleString('en-IN')} on resale unit ${mem.unit_number || id}` });
    res.status(201).json({ status: 'success', message: 'Offer placed. Our advisor will call you shortly.', data: { new_highest_bid: amount, bid_count: mem.bid_count } });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    next(error);
  } finally {
    if (conn) conn.release();
  }
};

// ==========================================
// 5. CHANNEL PARTNER 60-DAY LEAD LOCK ENGINE
// ==========================================

const getCPLeadLocks = async (req, res, next) => {
  try {
    try {
      const [locks] = await pool.query(`
        SELECT cll.*, cp.firm_name, cp.contact_person AS broker_name, p.name AS project_name
        FROM cp_lead_locks cll
        JOIN channel_partners cp ON cll.channel_partner_id = cp.id
        JOIN projects p ON cll.project_id = p.id
      `);
      if (locks && locks.length > 0) {
        return res.status(200).json({ status: 'success', results: locks.length, data: locks });
      }
    } catch (dbErr) {
      console.warn('[CP LeadLock DB Fallback]:', dbErr.message);
    }

    res.status(200).json({
      status: 'success',
      results: memoryStore.cpLeadLocks.length,
      data: memoryStore.cpLeadLocks
    });
  } catch (error) {
    next(error);
  }
};

const createCPLeadLock = async (req, res, next) => {
  try {
    const { channel_partner_id, client_name, client_phone, project_id } = req.body;

    if (!channel_partner_id || !client_name || !client_phone || !project_id) {
      return res.status(400).json({
        status: 'error',
        message: 'channel_partner_id, client_name, client_phone, and project_id are required.'
      });
    }

    // Check collision in memory store
    const existing = memoryStore.cpLeadLocks.find(
      l => l.client_phone.replace(/\s+/g, '') === client_phone.replace(/\s+/g, '') && l.project_id === project_id
    );

    if (existing) {
      return res.status(409).json({
        status: 'conflict',
        message: `Client ${client_phone} is already protected & locked by '${existing.firm_name}'. Lead protection prevents duplicate attribution.`
      });
    }

    const newLock = {
      id: crypto.randomUUID(),
      channel_partner_id,
      firm_name: channel_partner_id.includes('cp2') ? 'Metro Square Properties' : 'Apex Realty Advisors',
      broker_name: 'Registered Partner Agent',
      client_name,
      client_phone,
      project_id,
      project_name: project_id.includes('p2') ? 'Grand Horizon Plaza' : 'Greenfield Heights',
      days_remaining: 60,
      status: 'ACTIVE_LOCKED',
      locked_until: new Date(Date.now() + 60 * 86400000)
    };

    memoryStore.cpLeadLocks.unshift(newLock);

    res.status(201).json({
      status: 'success',
      message: `Client ${client_name} successfully locked for 60 days. Commission attribution is guaranteed under RERA partner rules.`,
      data: newLock
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMarketplaceListings,
  getMarketplaceSummary,
  getPriorityPasses,
  createPriorityPass,
  getGroupPools,
  createGroupPool,
  joinGroupPool,
  getResaleDealRooms,
  placeResaleBid,
  getCPLeadLocks,
  createCPLeadLock
};
