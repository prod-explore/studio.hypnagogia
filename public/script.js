// ═══════════════════════════════════════
// HYPNAGOGIA — Beat Store v2
// ═══════════════════════════════════════

(function () {
  'use strict';

  // Year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ─── MODAL SYSTEM ───
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('is-open');
    m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Purchase modal close
  document.querySelectorAll('[data-close-modal]').forEach(el =>
    el.addEventListener('click', () => closeModal('purchase-modal'))
  );
  document.querySelectorAll('[data-close-legal]').forEach(el =>
    el.addEventListener('click', () => closeModal('legal-modal'))
  );
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('purchase-modal');
      closeModal('legal-modal');
    }
  });

  // ─── LEGAL ───
  const LEGAL = {
    terms: `<h2 style="color:#fff;font-size:1.3rem;margin-bottom:16px">Terms of Service</h2>
<div class="legal-text">
<h3>1. Scope of Services</h3>
<p>HYPNAGOGIA offers the sale of digital licenses for instrumentals (Beats) produced by prod. HYPNAGOGIA. By purchasing a license, you agree to the following terms.</p>

<h3>2. Beat Licensing & Ownership</h3>
<p>Purchasing any lease (Basic, Premium) grants you non-exclusive rights to use the beat under the specified stream/sales limits. HYPNAGOGIA retains full copyright ownership of the composition. You may not register the beat with any Content ID system (e.g., YouTube Content ID) or copyright administration organization.</p>
<p><strong>Producer credit is strictly required</strong> in the title or metadata of all releases (e.g., "Prod. by HYPNAGOGIA"). Once a license limit is reached, it must be upgraded or renewed.</p>

<h3>3. Exclusive Licenses</h3>
<p>Purchasing an Exclusive License grants you unlimited use and exclusivity moving forward. The beat will be marked as "SOLD" and removed from the catalog. However, previous lease holders retain their non-exclusive rights until their limits expire.</p>

<h3>4. Delivery & Restrictions</h3>
<p>Digital files (MP3, WAV, Stems) and the PDF License Agreement are delivered automatically via email upon successful payment. You may not resell, share, or transfer the un-altered instrumental to any third party.</p>

<h3>5. Payments & Refunds</h3>
<p>Due to the digital nature of the products, all sales are final. Refunds are not accepted once the transaction is completed. Payments are securely processed by Stripe.</p>

<h3>6. Governing Law</h3>
<p>These terms are governed by the laws of Poland. Any disputes shall be resolved in the jurisdiction of the producer's residence.</p>
</div>`,

    privacy: `<h2 style="color:#fff;font-size:1.3rem;margin-bottom:16px">Privacy Policy</h2>
<div class="legal-text">
<p>The data controller for the website is HYPNAGOGIA, located in Poland. We are committed to protecting your privacy in compliance with GDPR regulations.</p>

<h3>Data We Collect</h3>
<p>We collect your <strong>Name</strong>, <strong>Email Address</strong>, and optionally your <strong>Artist Profile Link</strong> when you initiate a purchase. We do not store or process your credit card information directly.</p>

<h3>How We Use Your Data</h3>
<p>Your data is used strictly for fulfilling our contract with you: generating your personalized PDF License Agreement, delivering the audio files via email, and providing customer support regarding your purchase.</p>

<h3>Third-Party Processors</h3>
<p>We share minimal required data with trusted third parties:<br>
- <strong>Stripe</strong>: For secure payment processing.<br>
- <strong>Email Providers</strong>: For automated delivery of your digital products and receipts.<br>
- <strong>YouTube API</strong>: Used to fetch the beat catalog, which may set its own functional cookies.</p>

<h3>Cookies</h3>
<p>We use essential cookies required for the checkout process and session management. We do not use tracking or advertising cookies without consent.</p>

<h3>Your Rights</h3>
<p>You have the right to request access to, rectification, or deletion of your personal data at any time. To exercise these rights, please contact us via our official social channels (Instagram) or email.</p>
</div>`
  };

  document.querySelectorAll('[data-legal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.legal;
      document.getElementById('legal-content').innerHTML = LEGAL[type] || '';
      openModal('legal-modal');
    });
  });

  // ─── LICENSE PRICING ───
  const LICENSE_INFO = {
    lease_basic: { name: 'Lease Basic', price: 49 },
    lease_premium: { name: 'Lease Premium', price: 179 },
    exclusive: { name: 'Exclusive', price: 888 }
  };

  let currentPromo = null;
  let selectedBeat = null;

  const getSelectedLicense = () => document.querySelector('input[name="licenseType"]:checked')?.value || 'lease_premium';

  const priceOriginalEl = document.getElementById('price-original');
  const priceDiscountRowEl = document.getElementById('price-discount-row');
  const priceDiscountEl = document.getElementById('price-discount');
  const priceTotalEl = document.getElementById('price-total');

  function updatePriceDisplay() {
    const lic = LICENSE_INFO[getSelectedLicense()];
    if (!lic) return;
    let final = lic.price;
    let discount = 0;

    if (currentPromo && currentPromo.valid) {
      discount = currentPromo.type === 'percent'
        ? Math.round(lic.price * currentPromo.discount / 100)
        : Math.min(currentPromo.discount, lic.price);
      final = lic.price - discount;
    }

    if (priceOriginalEl) priceOriginalEl.textContent = `${lic.price} PLN`;
    if (priceDiscountEl) priceDiscountEl.textContent = `-${discount} PLN`;
    if (priceDiscountRowEl) priceDiscountRowEl.style.display = discount > 0 ? 'flex' : 'none';
    if (priceTotalEl) priceTotalEl.textContent = `${final} PLN`;
  }

  document.querySelectorAll('input[name="licenseType"]').forEach(el => el.addEventListener('change', updatePriceDisplay));

  // Promo validation
  const promoInput = document.getElementById('form-promo');
  const promoBtn = document.getElementById('promo-validate-btn');
  const promoFeedback = document.getElementById('promo-feedback');

  async function validatePromo() {
    const code = promoInput?.value?.trim();
    if (!code) { currentPromo = null; promoFeedback.textContent = ''; updatePriceDisplay(); return; }
    try {
      const res = await fetch('/api/beats/validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, licenseType: getSelectedLicense() })
      });
      const data = await res.json();
      if (data.status === 'success') {
        currentPromo = { valid: true, discount: data.discount, type: data.type };
        promoFeedback.textContent = `✓ Code active: -${data.discount}${data.type === 'percent' ? '%' : ' PLN'}`;
        promoFeedback.className = 'promo-feedback promo-feedback--success';
      } else {
        currentPromo = null;
        promoFeedback.textContent = `✗ ${data.message || 'Invalid code'}`;
        promoFeedback.className = 'promo-feedback promo-feedback--error';
      }
    } catch {
      currentPromo = null;
      promoFeedback.textContent = '✗ Error validating code';
      promoFeedback.className = 'promo-feedback promo-feedback--error';
    }
    updatePriceDisplay();
  }

  if (promoBtn) promoBtn.addEventListener('click', validatePromo);
  if (promoInput) promoInput.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); validatePromo(); } });

  // Select beat for purchase
  window.selectBeatForPurchase = function (beatId, beatTitle, beatThumbnail) {
    selectedBeat = { id: beatId, title: beatTitle, thumbnail: beatThumbnail };
    const beatIdInput = document.getElementById('form-beat-id');
    const preview = document.getElementById('modal-beat-preview');
    if (beatIdInput) beatIdInput.value = beatId;
    if (preview) {
      preview.innerHTML = `
        <img src="${beatThumbnail}" alt="" class="modal__beat-thumb">
        <span class="modal__beat-name">${beatTitle}</span>
      `;
    }
    currentPromo = null;
    if (promoFeedback) { promoFeedback.textContent = ''; promoFeedback.className = 'promo-feedback'; }
    if (promoInput) promoInput.value = '';
    updatePriceDisplay();
    openModal('purchase-modal');
  };

  // Form submission
  const purchaseForm = document.getElementById('purchase-form');
  if (purchaseForm) {
    purchaseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(purchaseForm);
      const data = Object.fromEntries(formData.entries());

      if (!data.beatId) { alert('Select a beat from the catalog first.'); return; }

      const submitBtn = document.getElementById('purchase-submit');
      const origHTML = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Redirecting...</span>';

      try {
        const res = await fetch('/api/beats/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.status === 'success' && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else {
          alert(result.message || 'An error occurred. Please try again.');
          submitBtn.disabled = false;
          submitBtn.innerHTML = origHTML;
        }
      } catch {
        alert('Connection error. Please try again.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHTML;
      }
    });
  }

  // ─── YOUTUBE PLAYER ───
  if (!window.YT || !window.YT.Player) {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }

  let beats = [];
  let ytPlayer = null, ytPlayerReady = false, ytPlayerId = null, ytPlayerState = -1;
  let ytProgressRAF = null, playingBeatId = null, ytDuration = 1, ytCurrentTime = 0;
  let isDragging = false, dragSeekVal = 0;

  function decodeEntities(str) {
    const d = document.createElement('div'); d.innerHTML = str; return d.textContent;
  }

  function ensureYTPlayer(loadId, cb) {
    if (ytPlayer && ytPlayerReady && ytPlayerId === loadId) { cb && cb(); return; }
    if (!window.YT || !window.YT.Player) { setTimeout(() => ensureYTPlayer(loadId, cb), 250); return; }
    if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null; }
    ytPlayerReady = false;
    ytPlayerId = loadId;
    ytPlayer = new YT.Player('yt-embed-player', {
      height: '0', width: '0', videoId: loadId,
      playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1, fs: 0 },
      events: {
        onReady: () => { ytPlayerReady = true; ytPlayer.setVolume(60); cb && cb(); },
        onStateChange: (e) => {
          ytPlayerState = e.data;
          if (ytPlayerState === YT.PlayerState.ENDED) { playingBeatId = null; ytCurrentTime = 0; }
          renderBeats(beats);
        }
      }
    });
  }

  function ytProgressLoop() {
    if (!ytPlayerReady || !ytPlayer || !playingBeatId || isDragging) return;
    try { ytDuration = ytPlayer.getDuration() || 1; ytCurrentTime = ytPlayer.getCurrentTime() || 0; } catch { }
    renderBeats(beats);
    if (ytPlayerState === YT.PlayerState.PLAYING && playingBeatId) {
      ytProgressRAF = requestAnimationFrame(ytProgressLoop);
    }
  }

  function renderBeats(arr) {
    const catalog = document.getElementById('beat-catalog');
    if (!catalog) return;
    catalog.innerHTML = '';

    if (!arr || !arr.length) {
      catalog.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px 0">No beats found.</p>';
      return;
    }

    arr.forEach(beat => {
      const isPlaying = playingBeatId === beat.id && ytPlayerState === YT.PlayerState.PLAYING;
      const ytActive = playingBeatId === beat.id;
      let prog = ytActive && ytDuration > 0 ? ytCurrentTime / ytDuration : 0;
      if (ytActive && isDragging) prog = dragSeekVal;

      const ytLink = `https://www.youtube.com/watch?v=${beat.id}`;

      const card = document.createElement('div');
      card.className = 'beat-card';

      const thumb = document.createElement('img');
      thumb.className = 'beat-card__thumb';
      thumb.src = beat.thumbnail;
      thumb.alt = '';
      thumb.loading = 'lazy';
      thumb.addEventListener('click', () => window.open(ytLink, '_blank'));

      const info = document.createElement('div');
      info.className = 'beat-card__info';

      const title = document.createElement('a');
      title.className = 'beat-card__title';
      title.href = ytLink;
      title.target = '_blank';
      title.textContent = decodeEntities(beat.title);

      const date = document.createElement('div');
      date.className = 'beat-card__date';
      date.textContent = beat.publishedAt ? new Date(beat.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

      const controls = document.createElement('div');
      controls.className = 'beat-card__controls';

      // Progress bar
      const progressWrap = document.createElement('div');
      progressWrap.className = 'beat-progress';

      const fill = document.createElement('div');
      fill.className = 'beat-progress__fill';
      fill.style.width = (prog * 100) + '%';

      const thumbEl = document.createElement('div');
      thumbEl.className = 'beat-progress__thumb';
      thumbEl.style.left = (prog * 100) + '%';

      progressWrap.appendChild(fill);
      progressWrap.appendChild(thumbEl);

      // Progress seek
      const seekHandler = (e) => {
        if (!ytActive) return;
        const r = progressWrap.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        const p = Math.max(0, Math.min(1, x / r.width));
        dragSeekVal = p;
        fill.style.width = (p * 100) + '%';
        thumbEl.style.left = (p * 100) + '%';
        return p;
      };

      progressWrap.addEventListener('mousedown', e => {
        if (!ytActive) return;
        isDragging = true;
        thumbEl.classList.add('is-dragging');
        seekHandler(e);
      });
      document.addEventListener('mousemove', e => { if (isDragging && ytActive) seekHandler(e); });
      document.addEventListener('mouseup', e => {
        if (!isDragging || !ytActive) return;
        isDragging = false;
        thumbEl.classList.remove('is-dragging');
        const p = seekHandler(e);
        if (ytPlayer && ytPlayerReady) ytPlayer.seekTo(ytDuration * p, true);
        ytProgressLoop();
      });

      progressWrap.addEventListener('click', e => {
        if (!ytActive) return;
        const r = progressWrap.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        if (ytPlayer && ytPlayerReady) ytPlayer.seekTo(ytDuration * p, true);
        ytProgressLoop();
      });

      // Play button
      const playBtn = document.createElement('button');
      playBtn.className = 'beat-play-btn' + (isPlaying ? ' is-playing' : '');
      playBtn.innerHTML = isPlaying ? '❚❚' : '▶';
      playBtn.title = isPlaying ? 'Pause' : 'Play';
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isPlaying) {
          if (ytPlayer && ytPlayerReady) ytPlayer.pauseVideo();
        } else {
          playingBeatId = beat.id;
          ensureYTPlayer(beat.id, () => {
            ytDuration = ytPlayer.getDuration() || 1;
            ytPlayer.playVideo();
            ytPlayer.setVolume(60);
            cancelAnimationFrame(ytProgressRAF);
            ytProgressLoop();
          });
        }
        renderBeats(beats);
      });

      // Buy button
      const buyBtn = document.createElement('button');
      buyBtn.className = 'beat-buy-btn';
      buyBtn.textContent = 'BUY';
      buyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.selectBeatForPurchase(beat.id, decodeEntities(beat.title), beat.thumbnail);
      });

      controls.appendChild(progressWrap);
      controls.appendChild(playBtn);
      controls.appendChild(buyBtn);

      info.appendChild(title);
      info.appendChild(date);
      info.appendChild(controls);

      card.appendChild(thumb);
      card.appendChild(info);
      catalog.appendChild(card);
    });
  }

  // Fetch beats
  async function fetchBeats() {
    try {
      const res = await fetch('/api/beats');
      if (!res.ok) throw new Error();
      beats = await res.json();
      renderBeats(beats);
    } catch {
      const catalog = document.getElementById('beat-catalog');
      if (catalog) {
        catalog.innerHTML = `<div style="color:#f87171;text-align:center;padding:40px 0">
          Failed to load catalog. Hit me up on <a href="https://www.instagram.com/state.of.hypnagogia" target="_blank" style="color:var(--accent);text-decoration:underline">Instagram</a>.
        </div>`;
      }
    }
  }

  // Search
  document.addEventListener('DOMContentLoaded', () => {
    fetchBeats();
    const searchBtn = document.getElementById('beat-search-toggle');
    const searchInput = document.getElementById('beat-search-input');

    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        searchInput.classList.toggle('is-active');
        if (searchInput.classList.contains('is-active')) searchInput.focus();
        else { searchInput.value = ''; renderBeats(beats); }
      });
      searchInput.addEventListener('input', e => {
        const v = e.target.value.toLowerCase().trim();
        renderBeats(v ? beats.filter(b => decodeEntities(b.title).toLowerCase().includes(v)) : beats);
      });
    }
  });

  // Smooth scroll for hero scroll hint
  const heroScrollBtn = document.getElementById('hero-scroll-btn');
  if (heroScrollBtn) {
    heroScrollBtn.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('beats')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

})();
