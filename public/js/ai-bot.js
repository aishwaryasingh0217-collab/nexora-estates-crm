/**
 * Nexora AI Floating Video Assistant & Luxury Glassmorphic Chat Widget
 * - Real-time transparent canvas chroma-keying for the video bot (zero circle, zero outline, transparent background)
 * - Medium attractive size, prominent center of attraction (flush at bottom-right)
 * - Pure luxury glassmorphism chat window
 * - Ready for custom bot iframe code / URL embedding
 */

(function () {
  'use strict';

  // Storage can be blocked (some private modes); the widget must still work
  const readStored = (store, key) => { try { return store.getItem(key); } catch { return null; } };

  // The trained Kratu bot ("nexora"), as Kratu hosts it for iframes. It runs on iamkratu.ai, so it works
  // on any website without adding that site to the widget's allowed domains in Kratu.
  // The in-page settings can switch this browser to another bot URL, or to the built-in concierge (saved as '').
  const DEFAULT_IFRAME_URL = 'https://iamkratu.ai/customer-chat/?key=3b381ebe07ec22f42ee075e82e45e330';
  const savedIframeUrl = readStored(localStorage, 'nexora_ai_iframe_url');

  window.NEXORA_AI_BOT_CONFIG = {
    iframeUrl: savedIframeUrl !== null ? savedIframeUrl : DEFAULT_IFRAME_URL,
    videoSrc: '/video/gemini_generated_video_759b32b2.mp4',
    title: 'Nexora AI Assistant',
    subtitle: 'Live AI Concierge • Instant Help',
  };

  const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  let isOpen = false;
  let bubbleDismissed = readStored(sessionStorage, 'nx_bot_bubble_dismissed') === 'true';
  let videoEl = null;
  let canvasEl = null;
  let ctx = null;
  let animationId = null;
  let isVideoPlaying = false;

  // Local fallback chat history if no iframe is set
  const chatMessages = [
    { sender: 'assistant', text: 'Hello! 👋 I am your Nexora AI Concierge. How can I assist you today? You can ask me about newly launched projects, pricing, floor plans, or site visits.' }
  ];

  function createWidgetElements() {
    if (document.getElementById('nx-ai-bot-root')) return;

    const root = document.createElement('div');
    root.id = 'nx-ai-bot-root';
    root.className = 'nx-ai-bot-root';
    root.innerHTML = `
      <!-- Hidden Video Element for Real-time Chroma Keying -->
      <video id="nx-bot-video" src="${window.NEXORA_AI_BOT_CONFIG.videoSrc}" autoplay muted loop playsinline crossorigin="anonymous" preload="auto" style="display: none;"></video>

      <!-- Floating Bot Container (Flush at bottom right) -->
      <div class="nx-bot-trigger-wrapper" id="nx-bot-trigger-wrapper">
        <!-- Luxury Glassmorphic Callout Speech Bubble -->
        <div class="nx-bot-speech-bubble" id="nx-bot-speech-bubble" style="${bubbleDismissed ? 'display: none;' : ''}">
          <button class="nx-bot-bubble-close" id="nx-bot-bubble-close" title="Dismiss message" aria-label="Dismiss">&times;</button>
          <div class="nx-bot-bubble-content" id="nx-bot-bubble-content">
            <div class="nx-bot-bubble-title">✨ Nexora AI Assistant</div>
            <p>Looking for verified projects, price lists, or floor plans? Tap to chat with me!</p>
          </div>
          <div class="nx-bot-bubble-tail"></div>
        </div>

        <!-- Transparent Chroma Video Canvas Avatar (Full Body & Waving Hand Visible, No Outline) -->
        <button class="nx-bot-avatar-btn" id="nx-bot-avatar-btn" aria-label="Open Nexora AI Assistant Chat">
          <canvas id="nx-bot-canvas" class="nx-bot-canvas" width="220" height="172"></canvas>
          <div class="nx-bot-status-pill">
            <span class="nx-bot-pulse-dot"></span>
            <span class="nx-bot-status-text">AI Online</span>
          </div>
        </button>
      </div>

      <!-- Luxury Glassmorphic Chat Drawer -->
      <div class="nx-bot-chat-drawer" id="nx-bot-chat-drawer" style="display: none;">
        <!-- Glass Header -->
        <div class="nx-bot-chat-header">
          <div class="nx-bot-chat-header-left">
            <div class="nx-bot-header-avatar-wrap">
              <canvas id="nx-bot-header-canvas" width="100" height="100"></canvas>
              <span class="nx-bot-online-badge"></span>
            </div>
            <div>
              <div class="nx-bot-header-title-row">
                <h3 class="nx-bot-header-title">${window.NEXORA_AI_BOT_CONFIG.title}</h3>
                <span class="nx-bot-header-ai-tag">✨ AI</span>
              </div>
              <p class="nx-bot-header-subtitle">
                <span class="nx-bot-pulse-dot-inline"></span>
                ${window.NEXORA_AI_BOT_CONFIG.subtitle}
              </p>
            </div>
          </div>
          <div class="nx-bot-header-actions">
            <button class="nx-bot-header-btn" id="nx-bot-settings-toggle" title="Connect Trained Bot / Iframe Code" aria-label="Bot Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
            <button class="nx-bot-header-btn" id="nx-bot-close-btn" title="Close Chat" aria-label="Close Chat">&times;</button>
          </div>
        </div>

        <!-- Optional Iframe Settings Bar (Foldable) -->
        <div class="nx-bot-config-bar" id="nx-bot-config-bar" style="display: none;">
          <div class="nx-bot-config-inner">
            <div class="nx-bot-config-label">🔗 Embed Your Trained Bot (Paste Iframe Code or URL):</div>
            <div class="nx-bot-config-input-group">
              <input type="text" id="nx-bot-iframe-input" class="nx-bot-config-input" placeholder="e.g. https://... or <iframe src=...></iframe>" value="${attr(window.NEXORA_AI_BOT_CONFIG.iframeUrl)}">
              <button type="button" class="nx-bot-config-save-btn" id="nx-bot-config-save-btn">Embed</button>
            </div>
            ${window.NEXORA_AI_BOT_CONFIG.iframeUrl ? `<button type="button" class="nx-bot-config-reset-btn" id="nx-bot-config-reset-btn">Reset to Built-in AI Concierge</button>` : ''}
          </div>
        </div>

        <!-- Chat Body: Either Iframe OR Native Luxury Glass Conversation -->
        <div class="nx-bot-chat-body" id="nx-bot-chat-body">
          ${renderChatBodyContent()}
        </div>

        <!-- Footer Advisory -->
        <div class="nx-bot-chat-footer-notice">
          <span>🔒 Verified RERA Architecture • Instant AI Property Intelligence</span>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // Setup Video and Canvas Chroma-key Processing
    videoEl = document.getElementById('nx-bot-video');
    canvasEl = document.getElementById('nx-bot-canvas');
    if (canvasEl) {
      ctx = canvasEl.getContext('2d', { willReadFrequently: true });
    }

    attachEvents();
    startChromaLoop();

    // Check if URL specifies auto-opening the bot for testing
    if (window.location.search.includes('openbot=1') || window.location.hash.includes('openbot=1')) {
      setTimeout(openChat, 400);
    }
  }

  function renderChatBodyContent() {
    if (window.NEXORA_AI_BOT_CONFIG.iframeUrl) {
      // Loaded when the chat first opens (openChat), so visitors who never open it don't load the bot
      return `
        <div class="nx-bot-iframe-container">
          <iframe
            ${isOpen ? 'src' : 'data-src'}="${attr(window.NEXORA_AI_BOT_CONFIG.iframeUrl)}"
            title="Nexora AI Assistant"
            class="nx-bot-iframe"
            allow="clipboard-write; microphone; camera"
          ></iframe>
        </div>
      `;
    }

    // Default Fallback: Luxury Native AI Conversation connected to /api/ai/chat
    return `
      <div class="nx-bot-native-chat">
        <!-- Quick Starter Prompts -->
        <div class="nx-bot-quick-chips">
          <button class="nx-bot-chip" data-prompt="What newly launched projects are available?">🏢 Newly Launched Projects</button>
          <button class="nx-bot-chip" data-prompt="Show 2 BHK & 3 BHK floor plans and pricing">📐 Floor Plans & Pricing</button>
          <button class="nx-bot-chip" data-prompt="How do I book a site visit?">📅 Schedule Site Visit</button>
          <button class="nx-bot-chip" data-prompt="Tell me about Greenfield Heights project">🌟 Greenfield Heights</button>
        </div>

        <div class="nx-bot-messages" id="nx-bot-messages">
          ${chatMessages.map(m => `
            <div class="nx-bot-msg ${m.sender === 'user' ? 'is-user' : 'is-bot'}">
              <div class="nx-bot-msg-bubble">${m.text}</div>
            </div>
          `).join('')}
        </div>

        <form class="nx-bot-input-form" id="nx-bot-input-form">
          <input
            type="text"
            id="nx-bot-input-field"
            class="nx-bot-input-field"
            placeholder="Ask about projects, floor plans, pricing..."
            autocomplete="off"
            required
          />
          <button type="submit" class="nx-bot-send-btn" id="nx-bot-send-btn" aria-label="Send message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </form>
      </div>
    `;
  }

  function startChromaLoop() {
    if (!videoEl || !canvasEl || !ctx) return;

    videoEl.muted = true;
    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        isVideoPlaying = true;
      }).catch(err => {
        const resumeOnInteraction = () => {
          videoEl.play();
          isVideoPlaying = true;
          document.removeEventListener('click', resumeOnInteraction);
        };
        document.addEventListener('click', resumeOnInteraction, { once: true });
      });
    }

    const headerCanvas = document.getElementById('nx-bot-header-canvas');
    const headerCtx = headerCanvas ? headerCanvas.getContext('2d', { willReadFrequently: true }) : null;

    let lastFrameTime = 0;
    const FRAME_INTERVAL = 40; // ~25 FPS throttled to match video framerate and free 85% CPU

    function renderFrame(timestamp) {
      animationId = requestAnimationFrame(renderFrame);

      // Sleep when tab is hidden or minimized
      if (document.hidden) return;

      // Throttle CPU execution to ~25 FPS
      if (timestamp && timestamp - lastFrameTime < FRAME_INTERVAL) return;
      lastFrameTime = timestamp || 0;

      // Skip heavy canvas loop if chat drawer is open (avatar is hidden)
      if (isOpen && !headerCtx) return;

      if (videoEl.readyState >= 2) {
        // Full character crop: includes waving hand, both shoulders, headset, and upper torso
        const cropX = 180;
        const cropY = 30;
        const cropW = 900;
        const cropH = 690;

        ctx.drawImage(videoEl, cropX, cropY, cropW, cropH, 0, 0, canvasEl.width, canvasEl.height);
        
        const frame = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
        const data = frame.data;
        const len = data.length;

        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max - min;
          const bright = (r + g + b) / 3;

          // Studio background: Cool slate grey where r <= g + 3 and r <= b + 3
          // Preserves brunette hair, warm skin tones, waving hand, headset and turquoise jacket
          const isCoolGrey = (r <= g + 3) && (r <= b + 3);
          const isBackground = isCoolGrey && ((sat <= 14 && bright >= 40 && bright <= 85) || 
                               (sat <= 18 && bright >= 44 && bright <= 75 && Math.abs(g - b) <= 4));

          if (isBackground) {
            if (sat > 11 || bright < 43 || bright > 80) {
              const alpha = Math.max(0, Math.min(255, (sat - 10) * 35));
              data[i + 3] = alpha;
            } else {
              data[i + 3] = 0;
            }
          }
        }

        ctx.putImageData(frame, 0, 0);

        // Header thumbnail: crop neatly onto face
        if (headerCtx && isOpen) {
          headerCtx.clearRect(0, 0, headerCanvas.width, headerCanvas.height);
          const faceCropX = Math.round(canvasEl.width * 0.28);
          const faceCropY = 0;
          const faceSize = Math.round(canvasEl.width * 0.44);
          headerCtx.drawImage(canvasEl, faceCropX, faceCropY, faceSize, faceSize, 0, 0, headerCanvas.width, headerCanvas.height);
        }
      }
    }

    animationId = requestAnimationFrame(renderFrame);
  }

  function attachEvents() {
    const avatarBtn = document.getElementById('nx-bot-avatar-btn');
    const bubbleContent = document.getElementById('nx-bot-bubble-content');
    const bubbleClose = document.getElementById('nx-bot-bubble-close');
    const closeBtn = document.getElementById('nx-bot-close-btn');
    const settingsToggle = document.getElementById('nx-bot-settings-toggle');
    const configBar = document.getElementById('nx-bot-config-bar');
    const saveBtn = document.getElementById('nx-bot-config-save-btn');
    const resetBtn = document.getElementById('nx-bot-config-reset-btn');

    if (avatarBtn) avatarBtn.addEventListener('click', toggleChat);
    if (bubbleContent) bubbleContent.addEventListener('click', openChat);
    if (bubbleClose) {
      bubbleClose.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissBubble();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeChat);

    if (settingsToggle) {
      settingsToggle.addEventListener('click', () => {
        if (!configBar) return;
        configBar.style.display = configBar.style.display === 'none' ? 'block' : 'none';
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const input = document.getElementById('nx-bot-iframe-input');
        let val = (input ? input.value : '').trim();
        // Check if user pasted an entire iframe tag <iframe src="...">
        const match = val.match(/src=["']([^"']+)["']/i);
        if (match && match[1]) {
          val = match[1];
        }
        window.NEXORA_AI_BOT_CONFIG.iframeUrl = val;
        localStorage.setItem('nexora_ai_iframe_url', val);
        updateChatBody();
        if (configBar) configBar.style.display = 'none';
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        window.NEXORA_AI_BOT_CONFIG.iframeUrl = '';
        localStorage.setItem('nexora_ai_iframe_url', ''); // '' = built-in concierge, not the default bot
        const input = document.getElementById('nx-bot-iframe-input');
        if (input) input.value = '';
        updateChatBody();
        if (configBar) configBar.style.display = 'none';
      });
    }

    attachNativeChatEvents();
  }

  function attachNativeChatEvents() {
    const form = document.getElementById('nx-bot-input-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('nx-bot-input-field');
        const txt = input ? input.value.trim() : '';
        if (!txt) return;
        input.value = '';
        await handleSendUserMessage(txt);
      });
    }

    document.querySelectorAll('.nx-bot-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) handleSendUserMessage(prompt);
      });
    });
  }

  async function handleSendUserMessage(text) {
    chatMessages.push({ sender: 'user', text });
    chatMessages.push({ sender: 'assistant', text: 'Analyzing real estate portfolio...' });
    renderMessageList();

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: chatMessages.slice(0, -1)
        })
      });

      const resData = await response.json();
      chatMessages.pop(); // remove analyzing state

      if (resData && resData.data && resData.data.reply) {
        chatMessages.push({ sender: 'assistant', text: resData.data.reply });
      } else {
        chatMessages.push({ sender: 'assistant', text: 'I am here to help you explore verified luxury homes, book private site visits, or review pricing sheets. Please let me know your preferred configuration or locality!' });
      }
    } catch (err) {
      chatMessages.pop();
      chatMessages.push({ sender: 'assistant', text: 'Thank you for reaching out! You can view all newly launched properties directly on the public site or connect with our sales team via WhatsApp for instant assistance.' });
    }

    renderMessageList();
  }

  function renderMessageList() {
    const list = document.getElementById('nx-bot-messages');
    if (!list) return;
    list.innerHTML = chatMessages.map(m => `
      <div class="nx-bot-msg ${m.sender === 'user' ? 'is-user' : 'is-bot'}">
        <div class="nx-bot-msg-bubble">${m.text.replace(/\n/g, '<br/>')}</div>
      </div>
    `).join('');
    list.scrollTop = list.scrollHeight;
  }

  function updateChatBody() {
    const body = document.getElementById('nx-bot-chat-body');
    if (body) {
      body.innerHTML = renderChatBodyContent();
      attachNativeChatEvents();
    }
  }

  function openChat() {
    isOpen = true;
    const drawer = document.getElementById('nx-bot-chat-drawer');
    const trigger = document.getElementById('nx-bot-trigger-wrapper');
    if (drawer) drawer.style.display = 'flex';
    if (trigger) trigger.classList.add('is-chat-open');
    const frame = document.querySelector('#nx-bot-chat-body iframe[data-src]');
    if (frame) { frame.src = frame.dataset.src; frame.removeAttribute('data-src'); }
    dismissBubble();
  }

  function closeChat() {
    isOpen = false;
    const drawer = document.getElementById('nx-bot-chat-drawer');
    const trigger = document.getElementById('nx-bot-trigger-wrapper');
    if (drawer) drawer.style.display = 'none';
    if (trigger) trigger.classList.remove('is-chat-open');
  }

  function toggleChat() {
    if (isOpen) {
      closeChat();
    } else {
      openChat();
    }
  }

  function dismissBubble() {
    bubbleDismissed = true;
    sessionStorage.setItem('nx_bot_bubble_dismissed', 'true');
    const bubble = document.getElementById('nx-bot-speech-bubble');
    if (bubble) bubble.style.display = 'none';
  }

  // Public Interface for embedding or setting iframe code dynamically
  window.NexoraBot = {
    open: openChat,
    close: closeChat,
    toggle: toggleChat,
    setIframeUrl: function (url) {
      let cleanUrl = url ? url.trim() : '';
      const match = cleanUrl.match(/src=["']([^"']+)["']/i);
      if (match && match[1]) cleanUrl = match[1];
      window.NEXORA_AI_BOT_CONFIG.iframeUrl = cleanUrl;
      localStorage.setItem('nexora_ai_iframe_url', cleanUrl);
      updateChatBody();
    },
    getIframeUrl: function () {
      return window.NEXORA_AI_BOT_CONFIG.iframeUrl;
    }
  };

  // Safe Auto-Initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidgetElements);
  } else {
    createWidgetElements();
  }
})();
