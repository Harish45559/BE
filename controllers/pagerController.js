const { Order } = require('../models');
const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * POST /api/pager/generate/:orderId
 * Staff: generate a QR code pager for an existing order.
 */
exports.generatePager = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const token = crypto.randomBytes(16).toString('hex');
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const pagerUrl = `${baseUrl}/pager/${token}`;

    const qrCode = await QRCode.toDataURL(pagerUrl, { width: 600, margin: 2, errorCorrectionLevel: 'H' });

    await order.update({ pager_token: token, pager_status: 'waiting' });

    res.json({
      token,
      pagerUrl,
      qrCode,
      orderNumber: order.order_number,
      customerName: order.customer_name,
    });
  } catch (err) {
    console.error('❌ Generate pager error:', err);
    res.status(500).json({ error: 'Failed to generate pager' });
  }
};

/**
 * GET /api/pager/status/:token
 * Public: customer polls this to check if their order is ready.
 */
exports.getPagerStatus = async (req, res) => {
  try {
    const order = await Order.findOne({ where: { pager_token: req.params.token } });
    if (!order) return res.status(404).json({ error: 'Invalid pager token' });

    res.json({
      status: order.pager_status,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      ringCount: order.ring_count || 0,
    });
  } catch (err) {
    console.error('❌ Pager status error:', err);
    res.status(500).json({ error: 'Failed to get pager status' });
  }
};

/**
 * PUT /api/pager/complete/:token
 * Staff: mark the order as fully delivered — stops customer polling.
 */
exports.completeOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ where: { pager_token: req.params.token } });
    if (!order) return res.status(404).json({ error: 'Invalid pager token' });

    await order.update({ pager_status: 'done' });
    res.json({ message: 'Order completed', orderNumber: order.order_number });
  } catch (err) {
    console.error('❌ Complete order error:', err);
    res.status(500).json({ error: 'Failed to complete order' });
  }
};

/**
 * PUT /api/pager/mark-ready/:token
 * Staff: mark the order as ready — customer's phone will notify them.
 */
exports.markReady = async (req, res) => {
  try {
    const order = await Order.findOne({ where: { pager_token: req.params.token } });
    if (!order) return res.status(404).json({ error: 'Invalid pager token' });

    const newCount = (order.ring_count || 0) + 1;
    await order.update({ pager_status: 'ready', ring_count: newCount });
    res.json({ message: 'Order marked as ready', orderNumber: order.order_number, ringCount: newCount });
  } catch (err) {
    console.error('❌ Mark ready error:', err);
    res.status(500).json({ error: 'Failed to mark order as ready' });
  }
};

/**
 * GET /pager/:token
 * Public: customer-facing waiting page served as HTML.
 */
exports.servePagerPage = (req, res) => {
  const token = req.params.token;

  // Override CSP so inline scripts work on this public page
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:;"
  );

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mirchi Mafia — Order Tracker</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #1a0a00;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    /* ── Tap-to-activate overlay ── */
    #activate-overlay {
      position: fixed; inset: 0;
      background: #1a0a00;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      z-index: 999; cursor: pointer;
      padding: 24px; text-align: center;
    }
    #activate-overlay img { width: 120px; margin-bottom: 20px; border-radius: 16px; }
    #activate-overlay h2 { color: #fff; font-size: 1.4rem; margin-bottom: 8px; }
    #activate-overlay p { color: #f97316; font-size: 0.95rem; margin-bottom: 32px; }
    #tap-btn {
      background: #f97316; color: #fff; border: none;
      border-radius: 50px; padding: 16px 40px;
      font-size: 1.1rem; font-weight: 800; cursor: pointer;
      animation: glow 1.6s ease-in-out infinite;
    }
    @keyframes glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.5); }
      50% { box-shadow: 0 0 0 14px rgba(249,115,22,0); }
    }

    .card {
      background: #fff;
      border-radius: 24px;
      padding: 36px 28px;
      max-width: 380px;
      width: 100%;
      text-align: center;
      box-shadow: 0 12px 48px rgba(0,0,0,0.35);
    }

    .logo-wrap { margin-bottom: 20px; }
    .logo-wrap img { width: 100px; border-radius: 14px; }

    .brand {
      font-size: 1.25rem;
      font-weight: 800;
      color: #c2410c;
      letter-spacing: 0.5px;
      margin-bottom: 24px;
    }

    .status-icon { font-size: 3.8rem; margin-bottom: 14px; }

    .status-title {
      font-size: 1.35rem;
      font-weight: 700;
      margin-bottom: 8px;
      color: #1a1a1a;
    }

    .status-sub {
      font-size: 0.92rem;
      color: #888;
      line-height: 1.55;
      margin-bottom: 24px;
    }

    .order-info {
      background: #fff7ed;
      border-radius: 12px;
      padding: 12px 18px;
      margin-bottom: 22px;
      border: 1px solid #fed7aa;
    }
    .order-info p { font-size: 0.88rem; color: #9a3412; font-weight: 600; }
    .order-info span { font-size: 1.05rem; font-weight: 800; color: #7c2d12; }

    .dots { display: flex; justify-content: center; gap: 8px; margin-bottom: 14px; }
    .dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: #f97316;
      animation: pulse 1.4s ease-in-out infinite;
    }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes pulse {
      0%, 80%, 100% { transform: scale(0.7); opacity: 0.45; }
      40% { transform: scale(1); opacity: 1; }
    }

    .poll-note { font-size: 0.76rem; color: #ccc; }

    /* ── Ready state ── */
    #ready-section { display: none; }

    .ready-banner {
      background: linear-gradient(135deg, #16a34a, #22c55e);
      color: white;
      border-radius: 16px;
      padding: 24px 20px;
      margin-bottom: 18px;
      animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .ready-banner .ready-icon { font-size: 3rem; margin-bottom: 10px; }
    .ready-banner h2 { font-size: 1.4rem; font-weight: 800; }
    .ready-banner p { font-size: 0.9rem; opacity: 0.9; margin-top: 6px; }

    @keyframes pop {
      0% { transform: scale(0.6); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

    .error-msg { color: #ef4444; font-size: 0.88rem; margin-top: 12px; }
  </style>
</head>
<body>

  <!-- Tap overlay: required to unlock vibration + audio on mobile -->
  <div id="activate-overlay">
    <img src="/public/logo.png" alt="Mirchi Mafia" />
    <h2>Track Your Order</h2>
    <p>Tap below — we'll <strong>speak &amp; notify you</strong> the moment your meal is ready, even if your screen is off.</p>
    <button id="tap-btn" onclick="activate()">👆 Tap to Start Tracking</button>
  </div>

  <div class="card" id="main-card" style="display:none;">
    <div class="logo-wrap">
      <img src="/public/logo.png" alt="Mirchi Mafia" />
    </div>
    <div class="brand">Mirchi Mafia</div>

    <!-- Waiting -->
    <div id="waiting-section">
      <div class="status-icon">🍽️</div>
      <div class="status-title">We're preparing your order</div>
      <div class="status-sub">Sit back and relax — we'll alert you with sound &amp; vibration the moment it's ready.</div>

      <div class="order-info" id="order-info" style="display:none;">
        <p>Order <span id="order-number"></span> &nbsp;·&nbsp; <span id="customer-name"></span></p>
      </div>

      <div class="dots">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>
      <div class="poll-note">Checking every 5 seconds…</div>
    </div>

    <!-- Ready -->
    <div id="ready-section">
      <div class="ready-banner">
        <div class="ready-icon">🎉</div>
        <h2 id="ring-label">Your order is ready!</h2>
        <p>Please come to the counter to collect it.</p>
      </div>
      <div class="order-info">
        <p>Order <span id="ready-order-number"></span> &nbsp;·&nbsp; <span id="ready-customer-name"></span></p>
      </div>
    </div>

    <!-- Done / all items delivered -->
    <div id="done-section" style="display:none;">
      <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border-radius:16px;padding:24px 20px;margin-bottom:18px;animation:pop 0.5s cubic-bezier(0.34,1.56,0.64,1);">
        <div style="font-size:3rem;margin-bottom:10px;">✅</div>
        <h2 style="font-size:1.4rem;font-weight:800;">All done — enjoy your meal!</h2>
        <p style="font-size:0.9rem;opacity:0.9;margin-top:6px;">All your items have been delivered. Thank you for visiting Mirchi Mafia!</p>
      </div>
      <div class="order-info">
        <p>Order <span id="done-order-number"></span> &nbsp;·&nbsp; <span id="done-customer-name"></span></p>
      </div>
    </div>

    <div id="error-msg" class="error-msg"></div>
  </div>

  <script>
    const TOKEN = '${token}';
    let pollInterval = null;
    let lastSeenRingCount = 0; // tracks how many times we've already buzzed
    let audioCtx = null;

    function activate() {
      // Unlock AudioContext on user gesture
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = audioCtx.createBuffer(1, 1, 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = buf; src.connect(audioCtx.destination); src.start(0);

      // Unlock vibration
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

      // Unlock speech synthesis on user gesture (required by iOS/Android Chrome)
      if ('speechSynthesis' in window) {
        var unlock = new SpeechSynthesisUtterance('');
        unlock.volume = 0;
        window.speechSynthesis.speak(unlock);
      }

      // Request browser notification permission (needed for background alerts)
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      document.getElementById('activate-overlay').style.display = 'none';
      document.getElementById('main-card').style.display = 'block';

      checkStatus();
      pollInterval = setInterval(checkStatus, 5000);
    }

    // Speak the message N times, with a gap between each
    function speakMessage(msg, times) {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      for (var i = 0; i < times; i++) {
        (function(idx) {
          setTimeout(function() {
            var utter = new SpeechSynthesisUtterance(msg);
            utter.volume = 1;
            utter.rate = 0.85;
            utter.pitch = 1.1;
            window.speechSynthesis.speak(utter);
          }, idx * 2400);
        })(i);
      }
    }

    // Browser notification — works when tab is in background
    function sendBrowserNotification(title, body) {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body: body,
            icon: '/public/logo.png',
            badge: '/public/logo.png',
            requireInteraction: true, // stays visible until dismissed
          });
        } catch(e) {}
      }
    }

    function vibratePhone() {
      if (!navigator.vibrate) return false;
      try { return navigator.vibrate([600, 150, 600, 150, 600, 150, 1000]); } catch(e) { return false; }
    }

    function flashScreen() {
      var flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;inset:0;background:#22c55e;z-index:9999;pointer-events:none;';
      document.body.appendChild(flash);
      var count = 0;
      var interval = setInterval(function() {
        flash.style.opacity = flash.style.opacity === '0' ? '0.9' : '0';
        if (++count >= 14) { clearInterval(interval); if (flash.parentNode) document.body.removeChild(flash); }
      }, 180);
    }

    async function checkStatus() {
      try {
        const res = await fetch('/api/pager/status/' + TOKEN);
        if (!res.ok) {
          document.getElementById('error-msg').textContent = 'Could not find your order. Please ask staff for help.';
          clearInterval(pollInterval);
          return;
        }
        const data = await res.json();

        document.getElementById('order-number').textContent = '#' + data.orderNumber;
        document.getElementById('customer-name').textContent = data.customerName;
        document.getElementById('order-info').style.display = 'block';

        // Staff marked all items delivered — show thank you, stop polling
        if (data.status === 'done') {
          clearInterval(pollInterval);
          showDone(data);
          return;
        }

        // Buzz every time ring_count increases (supports multiple rings per order)
        if (data.status === 'ready' && (data.ringCount || 0) > lastSeenRingCount) {
          lastSeenRingCount = data.ringCount || 1;
          showReady(data);
          // Keep polling — staff might ring again for remaining items
        }
      } catch (err) {
        document.getElementById('error-msg').textContent = 'Connection issue — retrying…';
      }
    }

    function showDone(data) {
      document.getElementById('waiting-section').style.display = 'none';
      document.getElementById('ready-section').style.display = 'none';
      document.getElementById('done-order-number').textContent = '#' + data.orderNumber;
      document.getElementById('done-customer-name').textContent = data.customerName;
      document.getElementById('done-section').style.display = 'block';
    }

    function showReady(data) {
      document.getElementById('waiting-section').style.display = 'none';
      document.getElementById('ready-order-number').textContent = '#' + data.orderNumber;
      document.getElementById('ready-customer-name').textContent = data.customerName;
      // Update ring label — first ring vs additional rings
      var ringEl = document.getElementById('ring-label');
      if (ringEl) {
        ringEl.textContent = lastSeenRingCount > 1
          ? '🔔 More of your order is ready! (Part ' + lastSeenRingCount + ')'
          : '🎉 Your order is ready!';
      }
      document.getElementById('ready-section').style.display = 'block';

      var isPartial = lastSeenRingCount > 1;
      var speechMsg = isPartial
        ? 'More of your meal is ready! Please come to the counter.'
        : 'Your meal is ready! Please come to the counter to collect it.';

      // Speak 3 times
      speakMessage(speechMsg, 3);

      // Browser notification (works when tab is backgrounded)
      sendBrowserNotification(
        isPartial ? '🔔 More items ready!' : '🍽️ Your meal is ready!',
        'Please come to the counter at Mirchi Mafia to collect your order.'
      );

      // Vibration + visual flash
      flashScreen();
      vibratePhone();

      // Retry vibration every 1.5s for 12s (fires when phone screen comes back on)
      var vibAttempts = 0;
      var vibRetry = setInterval(function() {
        vibAttempts++;
        vibratePhone();
        if (vibAttempts >= 8) clearInterval(vibRetry);
      }, 1500);
    }
  </script>
</body>
</html>`);
};
