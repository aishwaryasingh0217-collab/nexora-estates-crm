// ============================================================================
// NEXORA ESTATES — APARTMENTS & PROPERTIES LISTING ENGINE (99ACRES STYLE)
// ============================================================================

(function () {
  'use strict';

  // Master Verified Listings Database
  const MASTER_PROPERTY_LISTINGS = [
    {
      id: 'alp-prop-1',
      title: '2 BHK Luxury Apartment in Samethanahalli',
      project: 'Jupiter Homes',
      type: 'Apartment',
      bhk: '2 BHK',
      price: 8500000,
      priceDisplay: '₹ 85.0 L',
      pricePerSqft: '₹ 6,800/sq.ft.',
      emiDisplay: 'Starts at ₹42,500/mo',
      areaSqft: 1250,
      carpetArea: '1,020 sq.ft.',
      facing: 'East Facing',
      status: 'READY_TO_MOVE',
      statusText: 'Ready to Move (Jan 2024)',
      locality: 'Samethanahalli, Near Whitefield',
      city: 'Bangalore East',
      address: 'Samethanahalli Main Road, Whitefield Extension, Bangalore',
      postedBy: 'Builder',
      postedByType: 'builder',
      postedTime: 'Verified 2 days ago',
      rera: 'PRM/KA/RERA/1251/446/PR/210312/004012',
      verified: true,
      images: [
        '/assets/project_jupiter.jpg',
        '/assets/card_apartment_clean.jpg',
        '/assets/buy_home_showcase.jpg'
      ],
      amenities: ['Clubhouse', 'Swimming Pool', 'Gymnasium', '24/7 Security', 'Power Backup', 'Covered Parking', 'Kids Play Area', 'EV Charging'],
      description: 'Spacious 2 BHK home with vaastu-compliant layout, premium vitrified flooring, panoramic balcony views, and access to a 15,000 sq.ft. designer clubhouse.'
    },
    {
      id: 'alp-prop-2',
      title: '2 BHK Premium High-Rise Apartment',
      project: 'Shriram WYT Field',
      type: 'Apartment',
      bhk: '2 BHK',
      price: 9200000,
      priceDisplay: '₹ 92.0 L',
      pricePerSqft: '₹ 7,150/sq.ft.',
      emiDisplay: 'Starts at ₹46,000/mo',
      areaSqft: 1285,
      carpetArea: '1,060 sq.ft.',
      facing: 'North-East',
      status: 'UNDER_CONSTRUCTION',
      statusText: 'Possession Nov 2025',
      locality: 'Budigere Cross, Whitefield',
      city: 'Bangalore East',
      address: 'Whitefield Youth Town, Off Old Madras Road, Bangalore',
      postedBy: 'Builder',
      postedByType: 'builder',
      postedTime: 'Featured Launch',
      rera: 'PRM/KA/RERA/1250/304/PR/200123/003215',
      verified: true,
      images: [
        '/assets/project_shriram.jpg',
        '/assets/card_builder_floor_clean.jpg',
        '/assets/buy_home_showcase.jpg'
      ],
      amenities: ['Rooftop Infinity Pool', 'Co-Working Lounge', 'Tennis Court', 'Squash Court', 'Jogging Track', 'Amphitheatre', 'Badminton Courts'],
      description: 'Iconic 14-story towers featuring smart 2 BHK living units with 78% open green landscaped grounds, 40+ lifestyle amenities, and direct arterial highway connectivity.'
    },
    {
      id: 'alp-prop-3',
      title: '2 BHK Independent House/Villa, 3 Baths',
      project: 'Prasanth Enclave',
      type: 'Villa',
      bhk: '2 BHK',
      price: 7500000,
      priceDisplay: '₹ 75.0 L',
      pricePerSqft: '₹ 5,350/sq.ft.',
      emiDisplay: 'Starts at ₹37,800/mo',
      areaSqft: 1400,
      carpetArea: '1,180 sq.ft.',
      facing: 'East Facing',
      status: 'READY_TO_MOVE',
      statusText: 'Ready to Move',
      locality: 'Prasanth Layout, Whitefield',
      city: 'Bangalore East',
      address: 'Prasanth Layout, Inner Circle, Whitefield, Bangalore',
      postedBy: 'Owner (Zero Brokerage)',
      postedByType: 'owner',
      postedTime: 'Posted by Owner 2 months ago',
      rera: 'RERA Acknowledged',
      verified: true,
      images: [
        '/assets/card_villa_clean.jpg',
        '/assets/buy_home_showcase.jpg'
      ],
      amenities: ['Private Gated Courtyard', 'Borewell & Kaveri Water', 'Solar Water Heater', 'Covered Car Porch', 'Terrace Access'],
      description: 'Well-maintained independent duplex villa with 3 full attached bathrooms, private front garden, modular kitchen, and no monthly maintenance overheads.'
    },
    {
      id: 'alp-prop-4',
      title: '2 BHK Independent Villa with Garden',
      project: 'SKH Echium',
      type: 'Villa',
      bhk: '2 BHK',
      price: 4800000,
      priceDisplay: '₹ 48.0 L',
      pricePerSqft: '₹ 4,360/sq.ft.',
      emiDisplay: 'Starts at ₹24,200/mo',
      areaSqft: 1100,
      carpetArea: '920 sq.ft.',
      facing: 'North Facing',
      status: 'READY_TO_MOVE',
      statusText: 'Ready to Move',
      locality: 'Whitefield Main Road',
      city: 'Bangalore East',
      address: 'SKH Echium Community, Near ITPL, Whitefield, Bangalore',
      postedBy: 'Certified Dealer',
      postedByType: 'dealer',
      postedTime: 'Posted 4 days ago',
      rera: 'RERA Registered',
      verified: true,
      images: [
        '/assets/buy_home_showcase.jpg',
        '/assets/card_villa_clean.jpg'
      ],
      amenities: ['Gated Security', 'Paved Internal Roads', 'Street Lights', '24/7 Water Supply'],
      description: 'Affordable modern villa in a calm gated community close to top tech parks, offering freehold land ownership with private terrace rights.'
    },
    {
      id: 'alp-prop-5',
      title: '3 BHK High-End Luxury Garden Apartment',
      project: 'Prestige Boulevard Vista',
      type: 'Apartment',
      bhk: '3 BHK',
      price: 14500000,
      priceDisplay: '₹ 1.45 Cr',
      pricePerSqft: '₹ 8,050/sq.ft.',
      emiDisplay: 'Starts at ₹73,000/mo',
      areaSqft: 1800,
      carpetArea: '1,490 sq.ft.',
      facing: 'East Facing',
      status: 'READY_TO_MOVE',
      statusText: 'Ready to Move',
      locality: 'ITPL Main Road, Whitefield',
      city: 'Bangalore East',
      address: 'Near Prestige Shantiniketan, Whitefield, Bangalore',
      postedBy: 'Certified Dealer',
      postedByType: 'dealer',
      postedTime: 'Posted 1 week ago',
      rera: 'PRM/KA/RERA/1251/446/PR/171015/000450',
      verified: true,
      images: [
        '/assets/card_apartment_clean.jpg',
        '/assets/buy_home_showcase.jpg'
      ],
      amenities: ['Olympic Pool', 'Squash Courts', 'Multi-cuisine Restaurant', 'Concierge Desk', '2 Covered Parkings', 'Full Backup'],
      description: 'Ultra-luxury 3 BHK corner apartment with expansive floor-to-ceiling windows, Italian marble flooring in living areas, and walking distance to Metro.'
    },
    {
      id: 'alp-prop-6',
      title: 'Premium Residential Villa Plot',
      project: 'White Field Ville',
      type: 'Plot',
      bhk: 'Plot',
      price: 4440000,
      priceDisplay: '₹ 44.4 L',
      pricePerSqft: '₹ 3,700/sq.ft.',
      emiDisplay: 'Starts at ₹22,400/mo',
      areaSqft: 1200,
      carpetArea: '1,200 sq.ft.',
      facing: 'East Facing',
      status: 'READY_TO_MOVE',
      statusText: 'Immediate Registration',
      locality: 'Whitefield Extension',
      city: 'Bangalore East',
      address: 'White Field Ville Gated Layout, Whitefield, Bangalore',
      postedBy: 'Certified Dealer',
      postedByType: 'dealer',
      postedTime: 'Posted 2 weeks ago',
      rera: 'BMRDA & RERA Approved',
      verified: true,
      images: [
        '/assets/card_plot_clean.jpg',
        '/assets/plot_showcase.jpg'
      ],
      amenities: ['Underground Cabling', 'Storm Water Drains', 'Compound Wall', 'Sewage Treatment Plant', 'Clubhouse'],
      description: 'Clear title, BMRDA approved residential villa plot in a luxury gated enclave. Ready for immediate villa construction with 100% bank loan approval.'
    },
    {
      id: 'alp-prop-7',
      title: 'Modern Independent Builder Floor',
      project: 'Whitefield Haven Floors',
      type: 'Builder Floor',
      bhk: '3 BHK',
      price: 8800000,
      priceDisplay: '₹ 88.0 L',
      pricePerSqft: '₹ 5,860/sq.ft.',
      emiDisplay: 'Starts at ₹44,200/mo',
      areaSqft: 1500,
      carpetArea: '1,260 sq.ft.',
      facing: 'North Facing',
      status: 'READY_TO_MOVE',
      statusText: 'Ready to Move',
      locality: 'Hoodi Junction, Whitefield',
      city: 'Bangalore East',
      address: 'Hoodi Metro Station Corridor, Bangalore',
      postedBy: 'Certified Dealer',
      postedByType: 'dealer',
      postedTime: 'Posted 3 days ago',
      rera: 'RERA Approved',
      verified: true,
      images: [
        '/assets/card_builder_floor_clean.jpg',
        '/assets/card_apartment_clean.jpg'
      ],
      amenities: ['Lift with Power Backup', '1 Dedicated Stilt Parking', 'Terrace Garden', 'CCTV Surveillance'],
      description: 'Stand-alone 4-story low-rise builder floor with undivided share of land (UDS), zero common walls, and individual private balconies.'
    },
    {
      id: 'alp-prop-8',
      title: '1 RK / Designer Studio Suite',
      project: 'Urban Pod Residences',
      type: 'Studio',
      bhk: '1 BHK',
      price: 3200000,
      priceDisplay: '₹ 32.0 L',
      pricePerSqft: '₹ 6,400/sq.ft.',
      emiDisplay: 'Starts at ₹16,100/mo',
      areaSqft: 500,
      carpetArea: '410 sq.ft.',
      facing: 'West Facing',
      status: 'READY_TO_MOVE',
      statusText: 'Ready to Move',
      locality: 'ITPL Tech Park Zone',
      city: 'Bangalore East',
      address: 'Near ITPL Gate 2, Whitefield, Bangalore',
      postedBy: 'Owner (Zero Brokerage)',
      postedByType: 'owner',
      postedTime: 'Posted by Owner 1 week ago',
      rera: 'RERA Registered',
      verified: true,
      images: [
        '/assets/card_studio_clean.jpg',
        '/assets/card_builder_floor_clean.jpg'
      ],
      amenities: ['High Speed Fiber', 'Laundromat', 'Gym & Fitness Center', 'Cafeteria on Rooftop', 'Keycard Access'],
      description: 'Fully furnished studio apartment generating high rental yield (₹22,000/month) from tech professionals. High return on investment.'
    },
    {
      id: 'alp-prop-9',
      title: '3 BHK Duplex Villa in KR Puram',
      project: 'Lakeview County',
      type: 'Villa',
      bhk: '3 BHK',
      price: 9500000,
      priceDisplay: '₹ 95.0 L',
      pricePerSqft: '₹ 5,420/sq.ft.',
      emiDisplay: 'Starts at ₹47,800/mo',
      areaSqft: 1750,
      carpetArea: '1,480 sq.ft.',
      facing: 'East Facing',
      status: 'READY_TO_MOVE',
      statusText: 'Ready to Move',
      locality: 'KR Puram Lake Ring Road',
      city: 'Bangalore East',
      address: 'KR Puram Near Hanging Bridge, Bangalore',
      postedBy: 'Owner (Zero Brokerage)',
      postedByType: 'owner',
      postedTime: 'Posted by Owner 3 weeks ago',
      rera: 'RERA Approved',
      verified: true,
      images: [
        '/assets/card_villa_clean.jpg',
        '/assets/buy_home_showcase.jpg'
      ],
      amenities: ['Private Garden', '2 Car Parks', 'Solar Rooftop', 'Lake Promenade Access', 'Gated Security'],
      description: 'Stunning 3 BHK lake-facing duplex villa with open sky terrace, Italian modular kitchen, and quick 10-minute commute to KR Puram Railway Station.'
    },
    {
      id: 'alp-prop-10',
      title: 'Residential Land Plot in Varthur',
      project: 'Green Meadows Layout',
      type: 'Plot',
      bhk: 'Plot',
      price: 4600000,
      priceDisplay: '₹ 46.0 L',
      pricePerSqft: '₹ 3,830/sq.ft.',
      emiDisplay: 'Starts at ₹23,100/mo',
      areaSqft: 1200,
      carpetArea: '1,200 sq.ft.',
      facing: 'North-East',
      status: 'READY_TO_MOVE',
      statusText: 'Ready for Registration',
      locality: 'Varthur - Sarjapur Road',
      city: 'Bangalore East',
      address: 'Varthur Circle, Bangalore East',
      postedBy: 'Owner (Zero Brokerage)',
      postedByType: 'owner',
      postedTime: 'Posted by Owner 3 weeks ago',
      rera: 'RERA Approved',
      verified: true,
      images: [
        '/assets/card_plot_clean.jpg',
        '/assets/plot_showcase.jpg'
      ],
      amenities: ['Wide 40ft Asphalt Roads', 'Water Connection to Plot', 'Underground Sewage Lines', 'Park with Children Play Area'],
      description: 'Excellent investment plot located on the upcoming Varthur to Sarjapur 100ft road corridor with rapid appreciation potential.'
    },
    {
      id: 'alp-prop-11',
      title: '4 BHK Luxury Sky Penthouse',
      project: 'Nexora Crystal Horizons',
      type: 'Apartment',
      bhk: '4+ BHK',
      price: 24500000,
      priceDisplay: '₹ 2.45 Cr',
      pricePerSqft: '₹ 8,750/sq.ft.',
      emiDisplay: 'Starts at ₹1,23,000/mo',
      areaSqft: 2800,
      carpetArea: '2,350 sq.ft.',
      facing: 'East Facing',
      status: 'NEW_LAUNCH',
      statusText: 'New Launch · Pre-booking',
      locality: 'EPIP Zone, Whitefield',
      city: 'Bangalore East',
      address: 'EPIP Industrial Area, Whitefield, Bangalore',
      postedBy: 'Builder',
      postedByType: 'builder',
      postedTime: 'Exclusive Preview',
      rera: 'PRM/KA/RERA/1251/446/PR/230115/005612',
      verified: true,
      images: [
        '/assets/mahindra_aquavista.jpg',
        '/assets/card_apartment_clean.jpg'
      ],
      amenities: ['Private Plunge Pool', 'Double Height Ceilings', 'Home Automation', '3 Car Parks', 'Helipad Access', 'Valet Concierge'],
      description: 'Ultra-exclusive 28th-floor penthouse with unobstructed 360-degree city views, private jacuzzi deck, and imported German fixtures.'
    },
    {
      id: 'alp-prop-12',
      title: 'Country Farmhouse with Mango Orchards',
      project: 'Nandi Whispering Woods',
      type: 'Farmhouse',
      bhk: '4+ BHK',
      price: 18500000,
      priceDisplay: '₹ 1.85 Cr',
      pricePerSqft: '₹ 1,850/sq.ft.',
      emiDisplay: 'Starts at ₹93,000/mo',
      areaSqft: 10000,
      carpetArea: '3,200 sq.ft.',
      facing: 'East Facing',
      status: 'READY_TO_MOVE',
      statusText: 'Ready to Move',
      locality: 'Outer Ring Countryside',
      city: 'Bangalore East Peripheral',
      address: 'Hoskote - Whitefield Country Road, Bangalore',
      postedBy: 'Owner (Zero Brokerage)',
      postedByType: 'owner',
      postedTime: 'Posted 1 month ago',
      rera: 'Verified Estate',
      verified: true,
      images: [
        '/assets/card_farmhouse_clean.jpg',
        '/assets/card_villa_clean.jpg'
      ],
      amenities: ['Organic Vegetable Garden', 'Gazebo & Firepit', 'Private Well', 'Fencing & Security Guard', 'Solar Electricity'],
      description: 'Rustic luxury estate spanning quarter acre with 25 mature fruit trees, 4-bedroom stone cottage, and serene green countryside ambiance.'
    }
  ];

  // Active filter state
  window.alpFilterState = {
    searchQuery: '',
    city: 'Bangalore East',
    type: 'ALL',
    bhk: [],
    minPrice: 0,
    maxPrice: 30000000,
    status: 'ALL',
    postedBy: 'ALL',
    sortBy: 'relevance'
  };

  // Open the Apartment Listings Page
  window.openApartmentListingPage = function (prefillType = 'ALL') {
    if (prefillType && prefillType !== 'ALL') {
      window.alpFilterState.type = prefillType;
    }
    if (window.state) {
      window.state.viewMode = 'properties';
    }
    window.location.hash = '#/properties';
    if (typeof window.renderApp === 'function') {
      window.renderApp();
    } else {
      const root = document.getElementById('app');
      if (root) window.renderApartmentListingPage(root);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Close listings and return to home
  window.closeApartmentListingPage = function () {
    if (window.state) {
      window.state.viewMode = 'website';
    }
    window.location.hash = '';
    if (typeof window.renderApp === 'function') {
      window.renderApp();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter setters
  window.setAlpTypeFilter = function (type) {
    window.alpFilterState.type = type;
    window.updateAlpListingsView();
  };

  window.toggleAlpBhk = function (bhk) {
    const idx = window.alpFilterState.bhk.indexOf(bhk);
    if (idx > -1) {
      window.alpFilterState.bhk.splice(idx, 1);
    } else {
      window.alpFilterState.bhk.push(bhk);
    }
    window.updateAlpListingsView();
  };

  window.setAlpBudget = function (maxPrice) {
    window.alpFilterState.maxPrice = maxPrice;
    window.updateAlpListingsView();
  };

  window.setAlpPostedBy = function (postedBy) {
    window.alpFilterState.postedBy = postedBy;
    window.updateAlpListingsView();
  };

  window.setAlpStatus = function (status) {
    window.alpFilterState.status = status;
    window.updateAlpListingsView();
  };

  window.setAlpSort = function (sortBy) {
    window.alpFilterState.sortBy = sortBy;
    window.updateAlpListingsView();
  };

  window.clearAllAlpFilters = function () {
    window.alpFilterState = {
      searchQuery: '',
      city: 'Bangalore East',
      type: 'ALL',
      bhk: [],
      minPrice: 0,
      maxPrice: 30000000,
      status: 'ALL',
      postedBy: 'ALL',
      sortBy: 'relevance'
    };
    window.updateAlpListingsView();
  };

  // Filter evaluation logic
  function getFilteredListings() {
    return MASTER_PROPERTY_LISTINGS.filter(item => {
      const state = window.alpFilterState;

      // Search Query
      if (state.searchQuery && state.searchQuery.trim() !== '') {
        const q = state.searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchLoc = item.locality.toLowerCase().includes(q);
        const matchProj = (item.project || '').toLowerCase().includes(q);
        if (!matchTitle && !matchLoc && !matchProj) return false;
      }

      // Property Type
      if (state.type !== 'ALL') {
        const itemType = item.type.toLowerCase();
        const targetType = state.type.toLowerCase();
        if (!itemType.includes(targetType) && !targetType.includes(itemType)) return false;
      }

      // BHK
      if (state.bhk && state.bhk.length > 0) {
        if (!state.bhk.includes(item.bhk)) return false;
      }

      // Price Range
      if (item.price > state.maxPrice || item.price < state.minPrice) return false;

      // Status
      if (state.status !== 'ALL') {
        if (item.status !== state.status) return false;
      }

      // Posted By
      if (state.postedBy !== 'ALL') {
        if (item.postedByType !== state.postedBy) return false;
      }

      return true;
    }).sort((a, b) => {
      if (window.alpFilterState.sortBy === 'price-low') return a.price - b.price;
      if (window.alpFilterState.sortBy === 'price-high') return b.price - a.price;
      if (window.alpFilterState.sortBy === 'area-high') return b.areaSqft - a.areaSqft;
      return 0; // relevance
    });
  }

  // Render Listing View
  window.renderApartmentListingPage = function (root) {
    if (!root) root = document.getElementById('app');
    if (!root) return;

    root.innerHTML = `
      <div class="alp-page-wrapper">
        <!-- TOP STICKY SEARCH & FILTER HEADER -->
        <header class="alp-top-navbar">
          <div class="alp-nav-inner">
            <div class="alp-nav-left">
              <button class="alp-back-btn" onclick="closeApartmentListingPage()" title="Back to Home">
                <span>←</span>
                <span>Home</span>
              </button>
              <div class="alp-brand-badge" onclick="closeApartmentListingPage()">
                <span class="alp-logo-pill">NX</span>
                <span class="alp-brand-title">Nexora<span style="color: #38bdf8;">.</span></span>
              </div>
            </div>

            <!-- SEARCH BAR IN HEADER -->
            <div class="alp-search-box">
              <span class="alp-search-icon">🔍</span>
              <input type="text" 
                     id="alp-search-input" 
                     class="alp-search-input" 
                     placeholder="Search Whitefield, ITPL, Jupiter Homes, or 2 BHK apartments..." 
                     value="${window.alpFilterState.searchQuery}" 
                     oninput="window.alpFilterState.searchQuery = this.value; window.updateAlpListingsView();" />
              ${window.alpFilterState.searchQuery ? `<button class="alp-search-clear" onclick="document.getElementById('alp-search-input').value=''; window.alpFilterState.searchQuery=''; window.updateAlpListingsView();">✕</button>` : ''}
            </div>

            <div class="alp-nav-right">
              <div class="alp-city-selector">
                <span>📍 Bangalore East</span>
              </div>
              <button class="alp-post-btn" onclick="openPostPropertyPage()">+ Post Property <span style="font-size: 0.72rem; background: #059669; padding: 2px 5px; border-radius: 4px; font-weight: 700;">FREE</span></button>
            </div>
          </div>

          <!-- QUICK CATEGORY SCROLL PILLS -->
          <div class="alp-quick-pills-row">
            <button class="alp-pill-btn ${window.alpFilterState.type === 'ALL' ? 'active' : ''}" onclick="setAlpTypeFilter('ALL')">All Properties</button>
            <button class="alp-pill-btn ${window.alpFilterState.type === 'Apartment' ? 'active' : ''}" onclick="setAlpTypeFilter('Apartment')">🏢 Apartments</button>
            <button class="alp-pill-btn ${window.alpFilterState.type === 'Villa' ? 'active' : ''}" onclick="setAlpTypeFilter('Villa')">🏡 Villas & Houses</button>
            <button class="alp-pill-btn ${window.alpFilterState.type === 'Plot' ? 'active' : ''}" onclick="setAlpTypeFilter('Plot')">🌱 Land & Plots</button>
            <button class="alp-pill-btn ${window.alpFilterState.type === 'Builder Floor' ? 'active' : ''}" onclick="setAlpTypeFilter('Builder Floor')">🏗️ Builder Floors</button>
            <button class="alp-pill-btn ${window.alpFilterState.type === 'Studio' ? 'active' : ''}" onclick="setAlpTypeFilter('Studio')">🛋️ Studio / 1 RK</button>
            <button class="alp-pill-btn ${window.alpFilterState.postedBy === 'owner' ? 'active' : ''}" onclick="setAlpPostedBy(window.alpFilterState.postedBy === 'owner' ? 'ALL' : 'owner')">⚡ Owner (0 Brokerage)</button>
            <button class="alp-pill-btn ${window.alpFilterState.status === 'READY_TO_MOVE' ? 'active' : ''}" onclick="setAlpStatus(window.alpFilterState.status === 'READY_TO_MOVE' ? 'ALL' : 'READY_TO_MOVE')">🔑 Ready to Move</button>
          </div>
        </header>

        <!-- MAIN LAYOUT: SIDEBAR + RESULTS FEED -->
        <main class="alp-main-container">
          <!-- LEFT FILTERS SIDEBAR -->
          <aside class="alp-sidebar">
            <div class="alp-sidebar-header">
              <span class="alp-sidebar-title">Filters</span>
              <button class="alp-reset-link" onclick="clearAllAlpFilters()">Reset All</button>
            </div>

            <!-- BHK TYPE FILTER -->
            <div class="alp-filter-section">
              <h4 class="alp-filter-heading">BHK Configuration</h4>
              <div class="alp-bhk-grid">
                ${['1 BHK', '2 BHK', '3 BHK', '4+ BHK'].map(bhk => `
                  <button class="alp-bhk-btn ${window.alpFilterState.bhk.includes(bhk) ? 'active' : ''}" 
                          onclick="toggleAlpBhk('${bhk}')">${bhk}</button>
                `).join('')}
              </div>
            </div>

            <!-- BUDGET FILTER -->
            <div class="alp-filter-section">
              <h4 class="alp-filter-heading">Budget Max</h4>
              <div class="alp-budget-list">
                <label class="alp-radio-label">
                  <input type="radio" name="alp-budget" ${window.alpFilterState.maxPrice >= 30000000 ? 'checked' : ''} onchange="setAlpBudget(30000000)" />
                  <span>Any Budget</span>
                </label>
                <label class="alp-radio-label">
                  <input type="radio" name="alp-budget" ${window.alpFilterState.maxPrice === 5000000 ? 'checked' : ''} onchange="setAlpBudget(5000000)" />
                  <span>Under ₹50 Lakhs</span>
                </label>
                <label class="alp-radio-label">
                  <input type="radio" name="alp-budget" ${window.alpFilterState.maxPrice === 10000000 ? 'checked' : ''} onchange="setAlpBudget(10000000)" />
                  <span>Under ₹1.0 Crore</span>
                </label>
                <label class="alp-radio-label">
                  <input type="radio" name="alp-budget" ${window.alpFilterState.maxPrice === 15000000 ? 'checked' : ''} onchange="setAlpBudget(15000000)" />
                  <span>Under ₹1.5 Crore</span>
                </label>
                <label class="alp-radio-label">
                  <input type="radio" name="alp-budget" ${window.alpFilterState.maxPrice === 25000000 ? 'checked' : ''} onchange="setAlpBudget(25000000)" />
                  <span>Under ₹2.5 Crore</span>
                </label>
              </div>
            </div>

            <!-- POSTED BY (OWNER VS DEALER) -->
            <div class="alp-filter-section">
              <h4 class="alp-filter-heading">Posted By</h4>
              <div class="alp-budget-list">
                <label class="alp-radio-label">
                  <input type="radio" name="alp-posted" ${window.alpFilterState.postedBy === 'ALL' ? 'checked' : ''} onchange="setAlpPostedBy('ALL')" />
                  <span>All Sellers</span>
                </label>
                <label class="alp-radio-label">
                  <input type="radio" name="alp-posted" ${window.alpFilterState.postedBy === 'owner' ? 'checked' : ''} onchange="setAlpPostedBy('owner')" />
                  <span style="font-weight: 700; color: #059669;">Direct Owner (0 Brokerage)</span>
                </label>
                <label class="alp-radio-label">
                  <input type="radio" name="alp-posted" ${window.alpFilterState.postedBy === 'builder' ? 'checked' : ''} onchange="setAlpPostedBy('builder')" />
                  <span>Reputed Builder</span>
                </label>
                <label class="alp-radio-label">
                  <input type="radio" name="alp-posted" ${window.alpFilterState.postedBy === 'dealer' ? 'checked' : ''} onchange="setAlpPostedBy('dealer')" />
                  <span>Certified Dealer</span>
                </label>
              </div>
            </div>

            <!-- POSSESSION STATUS -->
            <div class="alp-filter-section">
              <h4 class="alp-filter-heading">Possession Status</h4>
              <div class="alp-budget-list">
                <label class="alp-radio-label">
                  <input type="radio" name="alp-status" ${window.alpFilterState.status === 'ALL' ? 'checked' : ''} onchange="setAlpStatus('ALL')" />
                  <span>All Statuses</span>
                </label>
                <label class="alp-radio-label">
                  <input type="radio" name="alp-status" ${window.alpFilterState.status === 'READY_TO_MOVE' ? 'checked' : ''} onchange="setAlpStatus('READY_TO_MOVE')" />
                  <span>Ready to Move</span>
                </label>
                <label class="alp-radio-label">
                  <input type="radio" name="alp-status" ${window.alpFilterState.status === 'UNDER_CONSTRUCTION' ? 'checked' : ''} onchange="setAlpStatus('UNDER_CONSTRUCTION')" />
                  <span>Under Construction</span>
                </label>
                <label class="alp-radio-label">
                  <input type="radio" name="alp-status" ${window.alpFilterState.status === 'NEW_LAUNCH' ? 'checked' : ''} onchange="setAlpStatus('NEW_LAUNCH')" />
                  <span>New Launch</span>
                </label>
              </div>
            </div>

            <!-- TRUST GUARANTEE BOX -->
            <div class="alp-trust-box">
              <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🛡️</div>
              <h5 style="margin: 0 0 0.35rem 0; font-size: 0.95rem; font-weight: 750; color: #091e42;">100% Verified Inventory</h5>
              <p style="margin: 0; font-size: 0.8rem; line-height: 1.45; color: #64748b;">Every property is verified with RERA documents, geotagged photographs, and active owner identity.</p>
            </div>
          </aside>

          <!-- RIGHT LISTINGS FEED -->
          <section class="alp-results-pane">
            <!-- RESULTS HEADER & SORTING -->
            <div class="alp-results-header">
              <div>
                <h1 class="alp-results-title" id="alp-results-title">Apartments & Properties in Bangalore East</h1>
                <p class="alp-results-sub" id="alp-results-counter">Loading verified properties...</p>
              </div>

              <div class="alp-sort-box">
                <span style="font-size: 0.85rem; color: #64748b; font-weight: 600;">Sort By:</span>
                <select class="alp-sort-select" onchange="setAlpSort(this.value)">
                  <option value="relevance" ${window.alpFilterState.sortBy === 'relevance' ? 'selected' : ''}>Relevance</option>
                  <option value="price-low" ${window.alpFilterState.sortBy === 'price-low' ? 'selected' : ''}>Price: Low to High</option>
                  <option value="price-high" ${window.alpFilterState.sortBy === 'price-high' ? 'selected' : ''}>Price: High to Low</option>
                  <option value="area-high" ${window.alpFilterState.sortBy === 'area-high' ? 'selected' : ''}>Area: Largest First</option>
                </select>
              </div>
            </div>

            <!-- PROPERTY CARDS LIST -->
            <div class="alp-cards-stream" id="alp-cards-stream">
              <!-- Dynamically populated by updateAlpListingsView() -->
            </div>
          </section>
        </main>

        <!-- PROPERTY DETAILS MODAL CONTAINER -->
        <div id="alp-details-modal-root"></div>
      </div>
    `;

    window.updateAlpListingsView();
  };

  // Update dynamic listing cards
  window.updateAlpListingsView = function () {
    const stream = document.getElementById('alp-cards-stream');
    const counter = document.getElementById('alp-results-counter');
    const title = document.getElementById('alp-results-title');
    if (!stream) return;

    const list = getFilteredListings();

    if (counter) {
      counter.innerText = `Showing ${list.length} Verified Properties in ${window.alpFilterState.city}`;
    }
    if (title) {
      const typeLabel = window.alpFilterState.type === 'ALL' ? 'Apartments & Properties' : window.alpFilterState.type + 's';
      title.innerText = `${typeLabel} for Sale in ${window.alpFilterState.city}`;
    }

    if (list.length === 0) {
      stream.innerHTML = `
        <div class="alp-empty-state">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
          <h3 style="color: #091e42; font-size: 1.35rem; margin: 0 0 0.5rem 0;">No matching properties found</h3>
          <p style="color: #64748b; font-size: 0.95rem; margin: 0 0 1.5rem 0;">Try broadening your budget, clearing selected BHK options, or resetting filters.</p>
          <button class="btn btn-primary" onclick="clearAllAlpFilters()" style="background: #0078db; color: #fff; padding: 0.75rem 1.75rem; border-radius: 8px; font-weight: 700; border: none; cursor: pointer;">Reset All Filters</button>
        </div>
      `;
      return;
    }

    stream.innerHTML = list.map(item => `
      <article class="alp-prop-card" id="card-${item.id}">
        <!-- LEFT: THUMBNAIL PHOTO & BADGES -->
        <div class="alp-card-media" onclick="openAlpPropertyDetails('${item.id}')">
          <img src="${item.images[0]}" alt="${item.title}" class="alp-card-thumb" loading="lazy" />
          <div class="alp-card-badges">
            <span class="alp-badge ${item.postedByType}">${item.postedBy.toUpperCase()}</span>
            ${item.rera ? `<span class="alp-badge rera">RERA VERIFIED</span>` : ''}
          </div>
          <button class="alp-card-fav" onclick="event.stopPropagation(); toggleAlpFavorite(this)" title="Save to Shortlist">♥</button>
          <div class="alp-card-media-counter">📷 1 of ${item.images.length}</div>
        </div>

        <!-- RIGHT: INFORMATION & PRICING -->
        <div class="alp-card-content">
          <div class="alp-card-top-row">
            <div>
              <div class="alp-card-price-row">
                <span class="alp-card-price">${item.priceDisplay}</span>
                <span class="alp-card-sqft">${item.pricePerSqft}</span>
                <span class="alp-card-emi">${item.emiDisplay}</span>
              </div>
              <h2 class="alp-card-title" onclick="openAlpPropertyDetails('${item.id}')" title="${item.title}">${item.title}</h2>
              <div class="alp-card-loc">
                <span>📍</span>
                <span>${item.locality}</span>
                ${item.project ? `<span style="color: #cbd5e1;">•</span> <strong style="color: #091e42;">${item.project}</strong>` : ''}
              </div>
            </div>
          </div>

          <!-- HIGHLIGHTS STRIP -->
          <div class="alp-highlights-row">
            <div class="alp-hl-box">
              <span class="alp-hl-label">Super Area</span>
              <span class="alp-hl-val">${item.areaSqft} sq.ft.</span>
            </div>
            <div class="alp-hl-box">
              <span class="alp-hl-label">Configuration</span>
              <span class="alp-hl-val">${item.bhk}</span>
            </div>
            <div class="alp-hl-box">
              <span class="alp-hl-label">Facing</span>
              <span class="alp-hl-val">${item.facing}</span>
            </div>
            <div class="alp-hl-box">
              <span class="alp-hl-label">Status</span>
              <span class="alp-hl-val" style="color: #059669; font-weight: 700;">${item.statusText}</span>
            </div>
          </div>

          <p class="alp-card-desc">${item.description}</p>

          <!-- AMENITIES PILLS -->
          <div class="alp-amenities-row">
            ${item.amenities.slice(0, 4).map(a => `<span class="alp-am-tag">✓ ${a}</span>`).join('')}
            ${item.amenities.length > 4 ? `<span class="alp-am-tag more">+${item.amenities.length - 4} more</span>` : ''}
          </div>

          <!-- FOOTER ACTION BUTTONS -->
          <div class="alp-card-actions">
            <div class="alp-card-posted">${item.postedTime}</div>
            <div class="alp-card-btn-group">
              <button class="alp-action-btn outline" onclick="openAlpPropertyDetails('${item.id}')">View Details</button>
              <button class="alp-action-btn whatsapp" onclick="contactAlpWhatsApp('${item.title.replace(/'/g, "\\'")}', '${item.priceDisplay}', '${item.locality.replace(/'/g, "\\'")}')">
                <span>💬 WhatsApp</span>
              </button>
              <button class="alp-action-btn primary" onclick="scheduleAlpVisit('${item.id}', '${item.title.replace(/'/g, "\\'")}')">Schedule Visit</button>
            </div>
          </div>
        </div>
      </article>
    `).join('');
  };

  // Open property details modal
  window.openAlpPropertyDetails = function (id) {
    const item = MASTER_PROPERTY_LISTINGS.find(p => p.id === id);
    if (!item) return;

    const modalRoot = document.getElementById('alp-details-modal-root');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="alp-modal-backdrop" onclick="closeAlpDetailsModal(event)">
        <div class="alp-modal-card" onclick="event.stopPropagation()">
          <button class="alp-modal-close" onclick="closeAlpDetailsModal()">✕</button>

          <!-- MODAL HEADER -->
          <div class="alp-modal-header">
            <div>
              <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
                <span class="alp-badge ${item.postedByType}">${item.postedBy.toUpperCase()}</span>
                ${item.rera ? `<span class="alp-badge rera">${item.rera}</span>` : ''}
              </div>
              <h2 style="font-size: 1.5rem; font-weight: 850; color: #091e42; margin: 0 0 0.25rem 0;">${item.title}</h2>
              <p style="font-size: 0.92rem; color: #64748b; margin: 0;">📍 ${item.address}</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.85rem; font-weight: 850; color: #0078db;">${item.priceDisplay}</div>
              <div style="font-size: 0.85rem; color: #64748b;">${item.pricePerSqft} • ${item.emiDisplay}</div>
            </div>
          </div>

          <!-- PHOTO GALLERY ROW -->
          <div class="alp-modal-gallery">
            ${item.images.map(img => `
              <div class="alp-modal-img-wrap">
                <img src="${img}" alt="${item.title}" class="alp-modal-img" />
              </div>
            `).join('')}
          </div>

          <!-- BODY SPECIFICATIONS & AMENITIES -->
          <div class="alp-modal-body-grid">
            <div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: #091e42; margin: 0 0 1rem 0;">Property Specifications</h3>
              <div class="alp-spec-table">
                <div class="alp-spec-item">
                  <span class="alp-spec-lbl">Super Built-up Area:</span>
                  <span class="alp-spec-val">${item.areaSqft} sq.ft.</span>
                </div>
                <div class="alp-spec-item">
                  <span class="alp-spec-lbl">Carpet Area:</span>
                  <span class="alp-spec-val">${item.carpetArea}</span>
                </div>
                <div class="alp-spec-item">
                  <span class="alp-spec-lbl">Configuration:</span>
                  <span class="alp-spec-val">${item.bhk}</span>
                </div>
                <div class="alp-spec-item">
                  <span class="alp-spec-lbl">Facing:</span>
                  <span class="alp-spec-val">${item.facing}</span>
                </div>
                <div class="alp-spec-item">
                  <span class="alp-spec-lbl">Possession / Status:</span>
                  <span class="alp-spec-val" style="color: #059669; font-weight: 700;">${item.statusText}</span>
                </div>
                <div class="alp-spec-item">
                  <span class="alp-spec-lbl">RERA Registration:</span>
                  <span class="alp-spec-val">${item.rera}</span>
                </div>
              </div>

              <h3 style="font-size: 1.15rem; font-weight: 800; color: #091e42; margin: 1.5rem 0 0.85rem 0;">Society Amenities</h3>
              <div class="alp-modal-amenities-grid">
                ${item.amenities.map(a => `
                  <div class="alp-modal-am-item">
                    <span style="color: #059669; font-weight: bold;">✓</span>
                    <span>${a}</span>
                  </div>
                `).join('')}
              </div>

              <h3 style="font-size: 1.15rem; font-weight: 800; color: #091e42; margin: 1.5rem 0 0.6rem 0;">Overview</h3>
              <p style="font-size: 0.92rem; line-height: 1.6; color: #475569; margin: 0;">${item.description}</p>
            </div>

            <!-- INQUIRY / SCHEDULE VISIT FORM -->
            <div class="alp-modal-inquiry-box">
              <h4 style="margin: 0 0 0.5rem 0; font-size: 1.15rem; font-weight: 800; color: #091e42;">Inquire About This Property</h4>
              <p style="margin: 0 0 1.25rem 0; font-size: 0.85rem; color: #64748b;">Direct connection with verified seller. Zero spam guarantee.</p>

              <form onsubmit="event.preventDefault(); submitAlpInquiry('${item.title.replace(/'/g, "\\'")}', '${item.priceDisplay}')">
                <div style="margin-bottom: 0.85rem;">
                  <label style="display: block; font-size: 0.82rem; font-weight: 600; color: #334155; margin-bottom: 0.35rem;">Your Name</label>
                  <input type="text" id="alp-inq-name" required placeholder="e.g. Rahul Sharma" style="width: 100%; padding: 0.65rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box;" />
                </div>
                <div style="margin-bottom: 0.85rem;">
                  <label style="display: block; font-size: 0.82rem; font-weight: 600; color: #334155; margin-bottom: 0.35rem;">Phone Number (WhatsApp)</label>
                  <input type="tel" id="alp-inq-phone" required placeholder="+91 98765 43210" style="width: 100%; padding: 0.65rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box;" />
                </div>
                <button type="submit" style="width: 100%; background: #0078db; color: #fff; padding: 0.85rem; border-radius: 8px; font-weight: 700; border: none; cursor: pointer; margin-bottom: 0.75rem;">
                  Instant Callback & Cost Sheet
                </button>
                <button type="button" onclick="contactAlpWhatsApp('${item.title.replace(/'/g, "\\'")}', '${item.priceDisplay}', '${item.locality.replace(/'/g, "\\'")}')" style="width: 100%; background: #25D366; color: #fff; padding: 0.85rem; border-radius: 8px; font-weight: 700; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                  <span>Connect on WhatsApp</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  window.closeAlpDetailsModal = function (ev) {
    const modalRoot = document.getElementById('alp-details-modal-root');
    if (modalRoot) modalRoot.innerHTML = '';
  };

  window.toggleAlpFavorite = function (btn) {
    btn.classList.toggle('active');
    if (btn.classList.contains('active')) {
      btn.style.color = '#ef4444';
      btn.style.background = '#ffffff';
    } else {
      btn.style.color = '#64748b';
    }
  };

  window.contactAlpWhatsApp = function (title, price, loc) {
    const msg = encodeURIComponent(`Hi Nexora, I found this listing on Nexora Estates:\n*${title}*\nPrice: ${price}\nLocation: ${loc}\nPlease share the brochure and arrange a site visit.`);
    window.open(`https://wa.me/919876543210?text=${msg}`, '_blank');
  };

  window.scheduleAlpVisit = function (id, title) {
    if (typeof window.openScheduleVisitModal === 'function') {
      window.openScheduleVisitModal({ notes: 'Interested in ' + title });
    } else {
      window.contactAlpWhatsApp(title, 'Inquire Visit', 'Bangalore East');
    }
  };

  window.submitAlpInquiry = function (title, price) {
    const name = document.getElementById('alp-inq-name').value;
    const phone = document.getElementById('alp-inq-phone').value;
    alert(`Thank you ${name}! Your callback request for "${title}" (${price}) has been assigned to our relationship manager. You will receive the cost sheet on ${phone} within 15 minutes.`);
    window.closeAlpDetailsModal();
  };

})();
