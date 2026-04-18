// Accessibility-friendly burger toggle
(function () {
  const burgerButton = document.getElementById('burger');
  const nav = document.getElementById('primary-nav');
  const yearSpan = document.getElementById('year');
  const brand = document.querySelector('.brand');

  if (yearSpan) {
    yearSpan.textContent = String(new Date().getFullYear());
  }

  if (!burgerButton || !nav) return;

  const toggleMenu = () => {
    const isOpen = nav.classList.toggle('open');
    burgerButton.setAttribute('aria-expanded', String(isOpen));
  };

  burgerButton.addEventListener('click', toggleMenu);
  burgerButton.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleMenu();
    }
  });

})();

// Collapsible equipment lists for studio section
(function () {
  const init = () => {
    const buttons = document.querySelectorAll('.toggle-equipment');
    buttons.forEach(btn => {
      const targetId = btn.dataset.target;
      const list = document.getElementById(targetId);
      if (!list) return;

      // set initial accessible state
      btn.setAttribute('aria-expanded', 'false');

      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        if (!expanded) {
          list.classList.add('is-open');
          // allow CSS transition by forcing maxHeight
          list.style.maxHeight = list.scrollHeight + 'px';
          btn.textContent = 'Ukryj sprzęt';
        } else {
          // collapse
          list.style.maxHeight = list.scrollHeight + 'px';
          // force repaint then set to 0 for smooth transition
          window.requestAnimationFrame(() => {
            list.style.maxHeight = '0px';
            list.classList.remove('is-open');
          });
          btn.textContent = 'Pokaż sprzęt';
        }
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Before/After Player: WebAudio crossfade + visualizer
(function () {
  const beforeEl = document.getElementById('ab-before');
  const afterEl = document.getElementById('ab-after');
  const playBtn = document.getElementById('ab-play');
  const icon = document.getElementById('ab-icon');
  const fader = document.getElementById('ab-fader');
  const canvas = document.getElementById('ab-visualizer');
  const glow = document.querySelector('.ab-glow');
  const player = document.querySelector('.ab-player');
  const trackSelector = document.getElementById('track-selector');

  if (!beforeEl || !afterEl || !playBtn || !fader || !canvas) return;

  // Ensure elements are audible to the WebAudio graph
  beforeEl.muted = false;
  afterEl.muted = false;
  beforeEl.loop = true;
  afterEl.loop = true;

  const ctx2d = canvas.getContext('2d');
  let audioCtx;
  let beforeSource;
  let afterSource;
  let beforeGain;
  let afterGain;
  let analyser;
  let rafId;
  let isPlaying = false;
  let freqData;
  let bufferLen = 0;

  const setupAudioGraph = () => {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const beforeElementSource = audioCtx.createMediaElementSource(beforeEl);
    const afterElementSource = audioCtx.createMediaElementSource(afterEl);

    beforeGain = audioCtx.createGain();
    afterGain = audioCtx.createGain();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;

    beforeElementSource.connect(beforeGain);
    afterElementSource.connect(afterGain);

    // Crossfade: equal-power curve for perceptual smoothness
    const applyCrossfade = (value01) => {
      const theta = value01 * Math.PI * 0.5;
      const a = Math.cos(theta); // before
      const b = Math.sin(theta); // after
      beforeGain.gain.setTargetAtTime(a, audioCtx.currentTime, 0.01);
      afterGain.gain.setTargetAtTime(b, audioCtx.currentTime, 0.01);
      if (glow) glow.style.setProperty('--mx', (value01 * 100) + '%');
    };

    // Initialize gains from current fader
    applyCrossfade(Number(fader.value) / 100);

    // Route to analyser then to destination
    const mix = audioCtx.createGain();
    beforeGain.connect(mix);
    afterGain.connect(mix);
    mix.connect(analyser);
    analyser.connect(audioCtx.destination);

    // Allocate frequency buffer once
    bufferLen = analyser.frequencyBinCount;
    freqData = new Uint8Array(bufferLen);

    // Persist handler for later
    setupAudioGraph.applyCrossfade = applyCrossfade;
  };

  const syncPlayheads = () => {
    // Align currentTime to avoid flam when toggling
    const t = Math.min(beforeEl.currentTime, afterEl.currentTime);
    if (!isFinite(t)) return;
    beforeEl.currentTime = t;
    afterEl.currentTime = t;
  };

  const resizeCanvas = () => {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resizeCanvas();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvas, 120);
  }, { passive: true });

  const draw = () => {
    if (!analyser) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const widthCss = canvas.width / dpr;
    const heightCss = canvas.height / dpr;
    ctx2d.clearRect(0, 0, widthCss, heightCss);

    // Single thin rectangle border
    ctx2d.save();
    ctx2d.strokeStyle = '#fff';
    ctx2d.globalAlpha = 0.8;
    ctx2d.lineWidth = 1;
    ctx2d.strokeRect(0.5, 0.5, widthCss - 1, heightCss - 1);
    ctx2d.restore();

    // Binary grid of squares (step sequencer style)
    if (!freqData || bufferLen !== analyser.frequencyBinCount) {
      bufferLen = analyser.frequencyBinCount;
      freqData = new Uint8Array(bufferLen);
    }
    analyser.getByteFrequencyData(freqData);

    const cellSize = 6;
    const gap = 2;
    const cols = Math.floor(widthCss / (cellSize + gap));
    const rows = Math.floor(heightCss / (cellSize + gap));
    const dur = Math.max(beforeEl.duration || 0, afterEl.duration || 0);
    const tnow = Math.min(beforeEl.currentTime || 0, afterEl.currentTime || 0);
    const progress = dur && isFinite(dur) ? Math.max(0, Math.min(1, tnow / dur)) : 1;
    const activeCols = Math.max(1, Math.floor(cols * progress));

    ctx2d.fillStyle = '#fff';
    for (let cx = 0; cx < activeCols; cx++) {
      const idx = Math.floor((cx / cols) * bufferLen);
      const amp = freqData[idx] / 255;
      const litRows = Math.floor(amp * rows);
      const x = cx * (cellSize + gap);

      for (let ry = 0; ry < litRows; ry++) {
        const y = heightCss - (ry + 1) * (cellSize + gap);
        ctx2d.fillRect(x, y, cellSize, cellSize);
      }
    }

    rafId = requestAnimationFrame(draw);
  };

  const play = async () => {
    setupAudioGraph();
    await Promise.allSettled([beforeEl.play(), afterEl.play()]);
    isPlaying = true;
    playBtn.classList.add('is-playing');
    if (player) player.classList.add('is-active');
    resizeCanvas();
    if (icon) icon.innerHTML = '<path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"></path>';
    playBtn.querySelector('.ab-btn__label').textContent = 'Pause';
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(draw);
  };

  const pause = () => {
    beforeEl.pause();
    afterEl.pause();
    isPlaying = false;
    playBtn.classList.remove('is-playing');
    if (player) player.classList.remove('is-active');
    if (icon) icon.innerHTML = '<path d="M8 5l12 7-12 7z" fill="currentColor"></path>';
    playBtn.querySelector('.ab-btn__label').textContent = 'Play';
    cancelAnimationFrame(rafId);
    if (audioCtx && audioCtx.state === 'running') {
      // Lightly save power when paused
      audioCtx.suspend?.();
    }
  };

  playBtn.addEventListener('click', () => {
    if (!audioCtx) setupAudioGraph();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (isPlaying) {
      pause();
    } else {
      // make sure they start together
      syncPlayheads();
      play();
    }
  });

  // Update crossfade
  fader.addEventListener('input', (e) => {
    if (!audioCtx) setupAudioGraph();
    const v01 = Number(fader.value) / 100;
    if (typeof setupAudioGraph.applyCrossfade === 'function') {
      setupAudioGraph.applyCrossfade(v01);
    }
  });

  // Keep both media elements roughly in sync
  const onTimeUpdate = () => {
    const diff = Math.abs(beforeEl.currentTime - afterEl.currentTime);
    if (diff > 0.08) {
      syncPlayheads();
    }
  };
  beforeEl.addEventListener('timeupdate', onTimeUpdate);
  afterEl.addEventListener('timeupdate', onTimeUpdate);

  // Handle track selection
  const updateTrackSources = () => {
    const trackPath = trackSelector.value;
    const wasPlaying = isPlaying;

    // Pause if playing
    if (wasPlaying) {
      pause();
    }

    // Ignore empty selection
    if (!trackPath) return;

    // Update sources (encode folder names for URL safety)
    const encoded = encodeURIComponent(trackPath);
    beforeEl.src = `portfolio/${encoded}/before.wav`;
    afterEl.src = `portfolio/${encoded}/after.wav`;

    // Reset gains and fader
    if (audioCtx) {
      fader.value = 0;
      setupAudioGraph.applyCrossfade(0);
    }

    // Resume playback if it was playing
    if (wasPlaying) {
      beforeEl.addEventListener('canplaythrough', () => {
        afterEl.addEventListener('canplaythrough', () => {
          play();
        }, { once: true });
      }, { once: true });
    }
  };

  if (trackSelector) {
    // KONFIGURACJA UTWORÓW I ALBUMÓW
    // type: 'local'   -> Twoje pliki na serwerze (before/after)
    // type: 'spotify' -> Embed ze Spotify
    // type: 'soundcloud' -> Embed ze SoundCloud
    // spotifyType: 'track' | 'album' | 'playlist' (domyślnie 'track')
    // height: opcjonalna wysokość w px (dla albumów warto dać więcej, np. 380)

    const portfolioTracks = [
      {
        type: 'local',
        label: 'radek nów - minus jeden',
        path: 'radek nów - minus jeden'
      },
      {
        type: 'local',
        label: 'radek nów - za nic',
        path: 'radek nów - za nic'
      },
      // PRZYKŁAD: POJEDYNCZY UTWÓR (Track)
      //      { 
      //        type: 'spotify', 
      //        label: 'Singiel - Tytuł', 
      //        id: '4cOdK2wGLETKBW3PvgPWqT', // ID utworu
      //        spotifyType: 'track' 
      //      },
      // PRZYKŁAD: CAŁY ALBUM
      {
        type: 'spotify',
        label: 'radek nów - Foucault',
        id: '1IokRrt8t4Qi67Hut4lCf0', // ID albumu (znajdziesz w linku tak samo jak track)
        spotifyType: 'album',
        height: 380 // Albumy wyglądają lepiej jak są wyższe (widać listę)  
      },
      // PRZYKŁAD: PLAYLISTA
      {
        type: 'spotify',
        label: 'mixed by prod.explore',
        id: '4CjGHLeUMgcjfMg6yja4K9',
        spotifyType: 'playlist',
        height: 380
      },
      // SOUNDCLOUD ALBUMS
      {
	type: 'soundcloud',
	label: "Radek Nów - Dekompozycja",
	url: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A1932759423&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true',
	height: 450
      },
      {
        type: 'soundcloud',
        label: "EXPLORE' - HYPNAGOGIA",
        url: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A2167268927&color=%23000000&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true',
        height: 450
      },
      {
        type: 'soundcloud',
        label: "EXPLORE' - TESSERACT",
        url: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A2167267049&color=%23000000&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true',
        height: 450
      },
      {
        type: 'soundcloud',
        label: "EXPLORE' - YEE 808",
        url: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A2167265228&color=%23000000&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true',
        height: 450
      }
    ];

    // Wyczyść selecta i wypełnij nowymi opcjami
    trackSelector.innerHTML = '';
    portfolioTracks.forEach((t, index) => {
      const opt = document.createElement('option');
      opt.textContent = t.label;
      opt.value = index;
      trackSelector.appendChild(opt);
    });

    const spotifyFrame = document.getElementById('spotify-frame');
    const soundcloudContainer = document.getElementById('soundcloud-container');
    const soundcloudFrame = document.getElementById('soundcloud-frame');
    const visualizerContainer = document.querySelector('.ab-player__visual');

    const handleTrackChange = () => {
      const selectedIndex = trackSelector.value;
      const trackData = portfolioTracks[selectedIndex];

      // Zatrzymujemy lokalny odtwarzacz jeśli gra
      if (typeof pause === 'function') pause();

      // Ukryj SoundCloud container domyślnie
      if (soundcloudContainer) soundcloudContainer.style.display = 'none';
      if (soundcloudFrame) soundcloudFrame.src = '';

      if (trackData.type === 'soundcloud') {
        // --- TRYB SOUNDCLOUD ---
        player.classList.add('spotify-mode'); // reuse this class to hide ab-player controls
        player.classList.add('soundcloud-mode');

        // Ukryj Spotify
        spotifyFrame.src = '';
        visualizerContainer.style.height = '0';
        visualizerContainer.style.minHeight = '0';

        // Pokaż SoundCloud
        if (soundcloudContainer) {
          soundcloudContainer.style.display = 'block';
          const sHeight = trackData.height || 450;
          soundcloudFrame.style.height = sHeight + 'px';
          soundcloudFrame.src = trackData.url;
        }

      } else if (trackData.type === 'spotify') {
        // --- TRYB SPOTIFY ---
        player.classList.add('spotify-mode');
        player.classList.remove('soundcloud-mode');

        // Domyślne wartości
        const sType = trackData.spotifyType || 'track';
        const sHeight = trackData.height || 152; // 152px to standard dla pojedynczego paska

        // Ustawiamy wysokość kontenera dynamicznie
        visualizerContainer.style.height = sHeight + 'px';
        visualizerContainer.style.minHeight = sHeight + 'px';

        // Budujemy link (theme=0 to ciemny motyw)
        spotifyFrame.src = `https://open.spotify.com/embed/${sType}/${trackData.id}?utm_source=generator&theme=0`;

      } else {
        // --- TRYB LOKALNY (Before/After) ---
        player.classList.remove('spotify-mode');
        player.classList.remove('soundcloud-mode');
        spotifyFrame.src = '';

        // Resetujemy wysokość do domyślnej dla wizualizera
        visualizerContainer.style.height = '';
        visualizerContainer.style.minHeight = ''; // CSS zajmie się resztą (klasa .is-active)

        const encoded = encodeURIComponent(trackData.path);
        beforeEl.src = `portfolio/${encoded}/before.wav`;
        afterEl.src = `portfolio/${encoded}/after.wav`;

        if (audioCtx) {
          fader.value = 0;
          if (typeof setupAudioGraph.applyCrossfade === 'function') {
            setupAudioGraph.applyCrossfade(0);
          }
        }
      }
    };

    trackSelector.addEventListener('change', handleTrackChange);

    // Uruchomienie pierwszego utworu na start
    if (portfolioTracks.length > 0) {
      trackSelector.selectedIndex = 6;
      handleTrackChange();
    }
  }
})();

// Formularz zgłoszeniowy
(function () {
  const formModal = document.getElementById('form-modal');
  const formTitle = document.getElementById('form-title');
  const mixmasterForm = document.getElementById('mixmaster-form');
  const beatyForm = document.getElementById('beaty-form');

  // Beats form elements
  const beatyLicenseSelect = document.getElementById('beaty-license');
  const beatyBeatIdInput = document.getElementById('beaty-beat-id');
  const selectedBeatPreview = document.getElementById('selected-beat-preview');
  const licenseInfoDiv = document.getElementById('license-info');
  const originalPriceEl = document.getElementById('beat-original-price');
  const discountRowEl = document.getElementById('discount-row');
  const discountEl = document.getElementById('beat-discount');
  const finalPriceEl = document.getElementById('beat-final-price');
  const promoInput = document.getElementById('beaty-promo');
  const validatePromoBtn = document.getElementById('validate-promo-btn');
  const promoFeedback = document.getElementById('promo-feedback');

  // License pricing and info
  const LICENSE_INFO = {
    lease_basic: {
      name: 'Lease Basic',
      pricePLN: 49,
      priceUSD: 12,
      featuresPL: ['50 000 streamów', '2 500 sprzedaży', '1 teledysk', 'Brak radia', 'Brak stemsów'],
      featuresEN: ['50,000 streams', '2,500 sales', '1 music video', 'No radio', 'No stems']
    },
    lease_premium: {
      name: 'Lease Premium',
      pricePLN: 179,
      priceUSD: 45,
      featuresPL: ['500 000 streamów', '10 000 sprzedaży', '3 teledyski', 'Radio ✓', 'Stemsy na życzenie'],
      featuresEN: ['500,000 streams', '10,000 sales', '3 music videos', 'Radio ✓', 'Stems on request']
    },
    exclusive: {
      name: 'Exclusive',
      pricePLN: 888,
      priceUSD: 220,
      featuresPL: ['Unlimited streamów', 'Unlimited sprzedaży', 'Unlimited teledysków', 'Radio ✓', 'Stemsy w cenie', 'Wyłączność na beat'],
      featuresEN: ['Unlimited streams', 'Unlimited sales', 'Unlimited videos', 'Radio ✓', 'Stems included', 'Beat exclusivity']
    }
  };

  // Helper to get current language
  function isPolish() {
    return document.documentElement.getAttribute('lang') !== 'us';
  }

  let currentPromo = null;
  let selectedBeat = null;

  // Update price display
  function updatePriceDisplay() {
    if (!beatyLicenseSelect) return;
    const license = LICENSE_INFO[beatyLicenseSelect.value];
    if (!license) return;

    const isPL = isPolish();
    const currency = isPL ? 'PLN' : '$';
    const originalPrice = isPL ? license.pricePLN : license.priceUSD;
    let finalPrice = originalPrice;
    let discount = 0;

    if (currentPromo && currentPromo.valid) {
      if (currentPromo.type === 'percent') {
        discount = Math.round(originalPrice * currentPromo.discount / 100);
      } else {
        discount = Math.min(currentPromo.discount, originalPrice);
      }
      finalPrice = originalPrice - discount;
    }

    const priceFormat = isPL ? `${originalPrice} PLN` : `$${originalPrice}`;
    const discountFormat = isPL ? `-${discount} PLN` : `-$${discount}`;
    const finalFormat = isPL ? `${finalPrice} PLN` : `$${finalPrice}`;

    if (originalPriceEl) originalPriceEl.textContent = priceFormat;
    if (discountEl) discountEl.textContent = discountFormat;
    if (discountRowEl) discountRowEl.style.display = discount > 0 ? 'flex' : 'none';
    if (finalPriceEl) finalPriceEl.textContent = finalFormat;

    // Update license info
    if (licenseInfoDiv) {
      const features = isPL ? license.featuresPL : license.featuresEN;
      licenseInfoDiv.innerHTML = `
        <p class="license-info__title">${license.name}</p>
        <ul class="license-info__list">
          ${features.map(f => `<li>${f}</li>`).join('')}
        </ul>
      `;
    }
  }

  // Validate promo code
  async function validatePromoCode() {
    const code = promoInput?.value?.trim();
    if (!code) {
      promoFeedback.textContent = '';
      promoFeedback.className = 'promo-feedback';
      currentPromo = null;
      updatePriceDisplay();
      return;
    }

    try {
      const response = await fetch('/api/beats/validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          licenseType: beatyLicenseSelect?.value
        })
      });

      const result = await response.json();

      if (result.status === 'success') {
        currentPromo = { valid: true, discount: result.discount, type: result.type };
        promoFeedback.textContent = `✓ Kod aktywny: -${result.discount}${result.type === 'percent' ? '%' : ' PLN'}`;
        promoFeedback.className = 'promo-feedback promo-feedback--success';
      } else {
        currentPromo = null;
        promoFeedback.textContent = `✗ ${result.message || 'Nieprawidłowy kod'}`;
        promoFeedback.className = 'promo-feedback promo-feedback--error';
      }
    } catch (err) {
      currentPromo = null;
      promoFeedback.textContent = '✗ Błąd sprawdzania kodu';
      promoFeedback.className = 'promo-feedback promo-feedback--error';
    }

    updatePriceDisplay();
  }

  // Update select options text based on language
  function updateSelectOptions() {
    if (!beatyLicenseSelect) return;
    const isPL = isPolish();
    const options = beatyLicenseSelect.querySelectorAll('option');
    options.forEach(opt => {
      const pln = opt.dataset.pln;
      const usd = opt.dataset.usd;
      const name = opt.value.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()).replace('Lease ', 'Lease ');
      const licenseNames = {
        'lease_basic': 'Lease Basic',
        'lease_premium': 'Lease Premium',
        'exclusive': 'Exclusive'
      };
      const lName = licenseNames[opt.value] || opt.value;
      opt.textContent = isPL ? `${lName} - ${pln} PLN` : `${lName} - $${usd}`;
    });
  }
  window.selectBeatForPurchase = function (beatId, beatTitle, beatThumbnail) {
    selectedBeat = { id: beatId, title: beatTitle, thumbnail: beatThumbnail };
    if (beatyBeatIdInput) beatyBeatIdInput.value = beatId;
    if (selectedBeatPreview) {
      selectedBeatPreview.innerHTML = `
        <div class="selected-beat-card">
          <img src="${beatThumbnail}" alt="${beatTitle}" class="selected-beat-thumb">
          <span class="selected-beat-title">${beatTitle}</span>
        </div>
      `;
    }
    openForm('beaty');
  };

  // Funkcje do otwierania i zamykania formularza
  window.openForm = function (serviceType) {
    if (!formModal) return;

    // Ukryj wszystkie formularze
    if (mixmasterForm) mixmasterForm.style.display = 'none';
    if (beatyForm) beatyForm.style.display = 'none';

    // Ustaw tytuł formularza
    const titles = {
      'mixmaster': { pl: 'Zgłoszenie Mix/Mastering', en: 'Mix/Mastering Request' },
      'beaty': { pl: 'Kup licencję do beatu', en: 'Buy Beat License' }
    };

    if (formTitle) {
      const t = titles[serviceType] || { pl: 'Formularz', en: 'Form' };
      formTitle.innerHTML = `
        <span class="lang-pl">${t.pl}</span>
        <span class="lang-en" style="display:none;">${t.en}</span>
      `;
    }

    // Pokaż odpowiedni formularz
    let activeForm = null;
    switch (serviceType) {
      case 'mixmaster':
        if (mixmasterForm) {
          mixmasterForm.style.display = 'block';
          activeForm = mixmasterForm;
        }
        break;
      case 'beaty':
        if (beatyForm) {
          beatyForm.style.display = 'block';
          activeForm = beatyForm;
          updateSelectOptions();
          updatePriceDisplay();
        }
        break;
    }

    // Pokaż modal
    formModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Focus na pierwszym polu
    if (activeForm) {
      const firstInput = activeForm.querySelector('input:not([type="hidden"]), select, textarea');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }
  };

  window.closeForm = function () {
    if (!formModal) return;

    formModal.style.display = 'none';
    document.body.style.overflow = '';

    // Reset formularzy
    if (mixmasterForm) mixmasterForm.reset();
    if (beatyForm) beatyForm.reset();

    // Reset beats form state
    currentPromo = null;
    selectedBeat = null;
    if (promoFeedback) {
      promoFeedback.textContent = '';
      promoFeedback.className = 'promo-feedback';
    }
    if (selectedBeatPreview) {
      const isPL = document.documentElement.getAttribute('lang') !== 'us';
      selectedBeatPreview.innerHTML = `
        <span class="lang-pl" style="display:${isPL ? '' : 'none'};">Wybierz beat z katalogu aby kontynuować</span>
        <span class="lang-en" style="display:${isPL ? 'none' : ''};">Select a beat from catalog to continue</span>
      `;
    }
  };

  window.openLegal = function (type) {
    const modal = document.getElementById('legal-modal');
    const termsDoc = document.getElementById('legal-doc-terms');
    const privacyDoc = document.getElementById('legal-doc-privacy');
    
    if (termsDoc) termsDoc.style.display = type === 'terms' ? 'block' : 'none';
    if (privacyDoc) privacyDoc.style.display = type === 'privacy' ? 'block' : 'none';
    
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeLegal = function () {
    const modal = document.getElementById('legal-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  // License change handler
  if (beatyLicenseSelect) {
    beatyLicenseSelect.addEventListener('change', updatePriceDisplay);
  }

  // Promo validation
  if (validatePromoBtn) {
    validatePromoBtn.addEventListener('click', validatePromoCode);
  }
  if (promoInput) {
    promoInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        validatePromoCode();
      }
    });
  }

  // Promo validation
  function setupFormSubmission(form, formType) {
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      // BEATS CHECKOUT - redirect to Stripe
      if (formType === 'beaty') {
        if (!data.beatId) {
          alert('Wybierz beat z katalogu!');
          return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="lang-pl">Przekierowuję...</span><span class="lang-en" style="display:none;">Redirecting...</span>';

        try {
          const response = await fetch('/api/beats/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });

          const result = await response.json();

          if (result.status === 'success' && result.checkoutUrl) {
            // Redirect to Stripe Checkout
            window.location.href = result.checkoutUrl;
          } else {
            alert(result.message || 'Wystąpił błąd. Spróbuj ponownie.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
          }
        } catch (err) {
          console.error('Checkout error:', err);
          alert('Wystąpił błąd połączenia. Spróbuj ponownie.');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
        return;
      }

      // Other forms (mixmaster)
      let endpoint = '';
      if (formType === 'mixmaster') {
        endpoint = '/api/mixmaster';
      }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.status === 'ok') {
          alert('Dziękujemy za zgłoszenie! Skontaktujemy się z Tobą w ciągu 24 godzin.');
          closeForm();
        } else if (result.status === 'error' && result.errors) {
          const messages = result.errors.map(e => `${e.field}: ${e.message}`).join('\n');
          alert(`Nie udało się wysłać formularza:\n${messages}`);
        } else {
          alert('Wystąpił nieoczekiwany błąd. Spróbuj ponownie.');
        }
      } catch (err) {
        console.error('Form submission error:', err);
        alert('Wystąpił błąd połączenia. Spróbuj ponownie.');
      }
    });
  }

  // Setup form handlers
  setupFormSubmission(mixmasterForm, 'mixmaster');
  setupFormSubmission(beatyForm, 'beaty');

  // Close on overlay click
  const overlay = document.querySelector('.form-modal__overlay');
  if (overlay) {
    overlay.addEventListener('click', closeForm);
  }

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && formModal && formModal.style.display === 'flex') {
      closeForm();
    }
  });
})();

// Language toggle
(function () {
  function setLang(lang) {
    const isPL = lang === 'pl';
    document.documentElement.setAttribute('lang', isPL ? 'pl' : 'us');
    document.querySelectorAll('.lang-pl').forEach(el => {
      el.style.display = isPL ? '' : 'none';
    });
    document.querySelectorAll('.lang-en').forEach(el => {
      el.style.display = !isPL ? '' : 'none';
    });
    // Toggle CSS flags now using class not id
    document.querySelectorAll('.flag-pl').forEach(el => {
      el.style.display = !isPL ? 'inline-block' : 'none';
    });
    document.querySelectorAll('.flag-us').forEach(el => {
      el.style.display = isPL ? 'inline-block' : 'none';
    });
    // Toggle price currency
    document.querySelectorAll('.price-pl').forEach(el => {
      el.style.display = isPL ? '' : 'none';
    });
    document.querySelectorAll('.price-us').forEach(el => {
      el.style.display = !isPL ? '' : 'none';
    });
  }
  function toggleLang() {
    const currentLang = document.documentElement.getAttribute('lang') || 'pl';
    setLang(currentLang === 'pl' ? 'us' : 'pl');
  }
  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('lang-toggle');
    if (!btn) return;
    btn.addEventListener('click', toggleLang);
    setLang('us');
  });
})();

// --- AUTOMATYCZNE ładowanie YouTube IFrame API (tylko raz na całą stronę) ---
if (!window.YT || !window.YT.Player) {
  var tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}

// --- BEATS CATALOG Z PRAWDZIWYM embedem YT API (player sterowany frontendem; ukryty) ---
(function () {
  const API_URL = '/api/beats';
  let beats = [];
  let ytPlayer = null;
  let ytPlayerReady = false, ytPlayerId = null, ytPlayerState = 'unstarted';
  let ytProgressRAF = null;
  let playingBeatId = null; // kto gra
  let ytDuration = 1;
  let ytCurrentTime = 0;

  function decodeEntities(str) {
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.textContent;
  }
  function $(sel, parent = document) { return parent.querySelector(sel); }
  function el(type, props = {}, ...children) {
    const node = document.createElement(type);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (v !== undefined && v !== null) node[k] = v;
    });
    children.forEach(child => {
      if (Array.isArray(child)) child.forEach(c => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else if (child) node.appendChild(child);
    });
    return node;
  }
  // --- YouTube Embed PLAYER API logic (z drag paska i fix play/pause/koszyk) ---
  let isDragging = false;
  let dragSeekVal = 0;
  function ensureYTPlayer(loadId, onReadyCb) {
    if (ytPlayer && ytPlayerReady && ytPlayerId === loadId) {
      onReadyCb && onReadyCb();
      return;
    }
    let playerDiv = document.getElementById('yt-embed-player');
    if (!window.YT || !window.YT.Player) {
      setTimeout(() => ensureYTPlayer(loadId, onReadyCb), 250);
      return;
    }
    if (ytPlayer) {
      ytPlayer.destroy();
      ytPlayer = null;
    }
    ytPlayerReady = false;
    ytPlayerId = loadId;
    ytPlayer = new YT.Player('yt-embed-player', {
      height: '0', width: '0',
      videoId: loadId,
      playerVars: {
        autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1, fs: 0, showinfo: 0,
      },
      events: {
        'onReady': e => {
          ytPlayerReady = true;
          try { ytPlayer.setVolume(60); } catch (e) { }
          onReadyCb && onReadyCb();
        },
        'onStateChange': handleYTStateChange
      }
    });
  }
  function handleYTStateChange(e) {
    ytPlayerState = e.data;
    // Ended
    if (ytPlayerState === YT.PlayerState.ENDED) {
      playingBeatId = null;
      ytCurrentTime = 0;
      ytDuration = 1;
      renderBeats(beats);
      return;
    }
    renderBeats(beats);
  }
  function ytProgressLoop() {
    if (!ytPlayerReady || !ytPlayer || typeof ytPlayer.getCurrentTime !== 'function' || !playingBeatId || isDragging) return;
    try {
      ytDuration = ytPlayer.getDuration() || 1;
      ytCurrentTime = ytPlayer.getCurrentTime() || 0;
    } catch (e) { ytDuration = 1; ytCurrentTime = 0; }
    renderBeats(beats);
    if (ytPlayerState === YT.PlayerState.PLAYING && playingBeatId) {
      ytProgressRAF = requestAnimationFrame(ytProgressLoop);
    }
  }
  function getYTProgress() {
    if (!ytDuration) return 0;
    if (isDragging) return dragSeekVal;
    return Math.max(0, Math.min(1, ytCurrentTime / ytDuration));
  }
  function renderBeats(beatsArr) {
    const catalog = $('#beat-catalog');
    if (!catalog) return;
    catalog.innerHTML = '';
    if (!beatsArr || !beatsArr.length) {
      catalog.innerHTML = '<p style="color:#888">Brak beatów do wyświetlenia.</p>';
      return;
    }
    beatsArr.forEach(beat => {
      const isPlaying = (playingBeatId === beat.id && ytPlayerState === YT.PlayerState.PLAYING);
      const ytActive = (playingBeatId === beat.id);
      let progVal = (ytActive && ytDuration > 0) ? (ytCurrentTime / ytDuration) : 0;
      if (ytActive && isDragging) progVal = dragSeekVal;
      // Miniatura z hover/focus logo YT NA ŚRODKU
      const ytLink = `https://www.youtube.com/watch?v=${beat.id}`;
      const miniatura = el('div', {
        class: 'yt-minia-wrap',
        style: { position: 'relative', width: '90px', height: '90px', flex: 'none', cursor: 'pointer' }
      },
        el('img', { src: beat.thumbnail, alt: 'miniaturka', loading: 'lazy', style: { width: '90px', height: '90px', borderRadius: '9px', objectFit: 'cover', background: '#222', display: 'block' } }),
        el('a', {
          href: ytLink, target: '_blank', tabIndex: 0,
          class: 'yt-logo-link'
        })
      );
      // Insert SVG using innerHTML - white box with transparent triangle cutout
      const ytLogoLink = miniatura.querySelector('.yt-logo-link');
      ytLogoLink.innerHTML = '<svg viewBox="0 0 68 48" width="42" height="30" style="display:block"><path d="M12,0 L56,0 C62.6,0 68,5.4 68,12 L68,36 C68,42.6 62.6,48 56,48 L12,48 C5.4,48 0,42.6 0,36 L0,12 C0,5.4 5.4,0 12,0 Z M27,14 L27,34 L45,24 Z" fill="#fff" fill-rule="evenodd"/></svg>';
      miniatura.addEventListener('mouseenter', () => {
        const logolink = miniatura.querySelector('.yt-logo-link');
        logolink.style.opacity = '1';
      });
      miniatura.addEventListener('mouseleave', () => {
        const logolink = miniatura.querySelector('.yt-logo-link');
        logolink.style.opacity = '0';
      });
      miniatura.querySelector('.yt-logo-link').addEventListener('focus', () => {
        miniatura.querySelector('.yt-logo-link').style.opacity = '1';
      });
      miniatura.querySelector('.yt-logo-link').addEventListener('blur', () => {
        miniatura.querySelector('.yt-logo-link').style.opacity = '0';
      });
      // Player UI
      // Play/Progress Wrap
      const wrap = el('div', { class: 'beat-progress-wrap', style: { display: 'flex', alignItems: 'center', gap: '0.75em', marginTop: '0.1em' } });
      const progressBar = el('div', { class: 'beat-progress', style: { flex: '1', height: '11px', background: '#24252c', borderRadius: '7px', overflow: 'hidden', minWidth: '120px', position: 'relative', cursor: 'pointer' } },
        el('div', { class: 'progress-inner', style: { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: '7px', width: '100%' } }),
        el('div', { class: 'progress-thumb', style: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: `calc(${(progVal * 100)}% - 7px)`, width: '14px', height: '14px', background: '#000', border: '2px solid rgb(255, 255, 255)', borderRadius: '50%', boxShadow: '0 1px 7px #367bf544', transition: isDragging ? 'none' : 'left .19s', cursor: 'pointer', } })
      );
      const progressInnerEl = () => progressBar.querySelector('.progress-inner');
      const progressThumbEl = () => progressBar.querySelector('.progress-thumb');
      // obsługa klik/drug na progress
      let seeking = false;
      const updateSeek = (e, callbackOnly) => {
        const barRect = progressBar.getBoundingClientRect();
        let x = (e.touches ? e.touches[0].clientX : e.clientX) - barRect.left;
        let p = Math.max(0, Math.min(1, x / barRect.width));
        dragSeekVal = p;
        const inner = progressInnerEl();
        const thumb = progressThumbEl();
        if (inner) inner.style.width = (p * 100) + '%';
        if (thumb) thumb.style.left = `calc(${(p * 100)}% - 7px)`;
        return p;
      };
      progressBar.addEventListener('mousedown', e => {
        if (!ytActive) return;
        isDragging = true;
        seeking = true;
        updateSeek(e);
        document.body.style.userSelect = 'none';
      });
      document.addEventListener('mousemove', e => {
        if (!isDragging || !ytActive || !seeking) return;
        updateSeek(e);
      });
      document.addEventListener('mouseup', e => {
        if (!isDragging || !ytActive || !seeking) return;
        isDragging = false;
        seeking = false;
        document.body.style.userSelect = '';
        let val = updateSeek(e, true);
        if (ytPlayer && ytPlayerReady) {
          ytPlayer.seekTo(ytDuration * val, true);
        }
        dragSeekVal = 0;
        ytProgressLoop();
      });
      // touch
      progressBar.addEventListener('touchstart', e => {
        if (!ytActive) return;
        isDragging = true;
        seeking = true;
        updateSeek(e);
        document.body.style.userSelect = 'none';
      });
      document.addEventListener('touchmove', e => {
        if (!isDragging || !ytActive || !seeking) return;
        updateSeek(e);
      });
      document.addEventListener('touchend', e => {
        if (!isDragging || !ytActive || !seeking) return;
        isDragging = false;
        seeking = false;
        document.body.style.userSelect = '';
        let val = updateSeek(e, true);
        if (ytPlayer && ytPlayerReady) {
          ytPlayer.seekTo(ytDuration * val, true);
        }
        dragSeekVal = 0;
        ytProgressLoop();
      });
      // Klik na pasek (jeśli klik, a nie drag)
      progressBar.addEventListener('click', e => {
        if (!ytActive) return;
        let p = updateSeek(e, true);
        if (ytPlayer && ytPlayerReady) ytPlayer.seekTo(ytDuration * p, true);
        dragSeekVal = 0;
        ytProgressLoop();
      });
      //    PLAY/PAUSE BTN
      const playBtn = el('button', {
        type: 'button',
        "aria-label": isPlaying ? "Zatrzymaj odsłuch" : "Odtwórz odsłuch",
        title: isPlaying ? "Zatrzymaj odsłuch" : "Odtwórz odsłuch",
        class: 'play-btn',
        style: { fontSize: '1.16em', border: 'none', borderRadius: '50%', width: '37px', height: '37px', marginLeft: '0.2em', marginRight: '0.2em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', 'boxShadow': isPlaying ? '0 0 0 2px #D677F0' : 'none', 'transition': 'box-shadow .17s' },
        onClick: function (e) {
          e.stopPropagation();
          if (isPlaying) {
            if (ytPlayer && ytPlayerReady) ytPlayer.pauseVideo();
          } else {
            playingBeatId = beat.id;
            ensureYTPlayer(beat.id, function () {
              ytDuration = ytPlayer.getDuration() || 1;
              ytPlayer.playVideo();
              ytPlayer.setVolume(60);
              ytProgressRAF && cancelAnimationFrame(ytProgressRAF);
              ytProgressLoop();
            });
          }
          renderBeats(beats);
        }
      }, isPlaying ? '❚❚' : '▶');

      wrap.appendChild(progressBar);
      wrap.appendChild(playBtn);
      // BUY BUTTON - opens purchase form
      const buyBtn = el('button', {
        type: 'button',
        "aria-label": "Kup licencję",
        title: "Kup licencję",
        class: 'buy-btn',
        onClick: function (ev) {
          ev.stopPropagation();
          window.selectBeatForPurchase(beat.id, decodeEntities(beat.title), beat.thumbnail);
        }
      }, '🛒');

      wrap.appendChild(buyBtn);

      const card = el('div', { class: 'beat-card', style: { display: 'flex', alignItems: 'center', gap: '1em', background: '#181818', 'borderRadius': '12px', marginBottom: '1.1em', padding: '0.4em 1em', boxShadow: '0 1px 2px #0001', position: 'relative' } },
        miniatura,
        el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '0.6em' } },
          el('a', { href: ytLink, target: '_blank', class: 'beat-title', style: { fontWeight: 'bold', fontSize: '1.07em', color: '#fff', marginBottom: '0.2em', textDecoration: 'none', transition: 'color 0.15s' } }, decodeEntities(beat.title)),
          el('div', { class: 'beat-date', style: { fontSize: '0.88em', color: '#bbb' } }, beat.publishedAt ? new Date(beat.publishedAt).toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' }) : ''),
          wrap
        )
      );
      catalog.appendChild(card);
    });
  }
  async function fetchBeatsFromAPI() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Błąd połączenia');
      beats = await res.json();
      renderBeats(beats);
    } catch (err) {
      const catalog = $('#beat-catalog');
      if (catalog) {
        const isPL = document.documentElement.getAttribute('lang') !== 'us';
        catalog.innerHTML = `<div style="color:#b55">
          <span class="lang-pl" style="display:${isPL ? '' : 'none'};">Nie udało się pobrać katalogu beatów :( <br>W razie problemów napisz do mnie na <a href="https://www.instagram.com/prod.explore" target="_blank" style="color:#fff; text-decoration:underline;">Instagramie</a>.</span>
          <span class="lang-en" style="display:${isPL ? 'none' : ''};">Failed to load the beat catalog :( <br>If you encounter issues, hit me up on <a href="https://www.instagram.com/prod.explore" target="_blank" style="color:#fff; text-decoration:underline;">Instagram</a>.</span>
        </div>`;
      }
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    fetchBeatsFromAPI();

    const searchBtn = $('#beat-search-btn');
    const searchInput = $('#beat-search-input');
    
    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        searchInput.classList.toggle('is-active');
        if (searchInput.classList.contains('is-active')) {
          searchInput.focus();
        } else {
          searchInput.value = '';
          renderBeats(beats);
        }
      });

      searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        if (!val) {
          renderBeats(beats);
        } else {
          const filtered = beats.filter(b => decodeEntities(b.title).toLowerCase().includes(val));
          renderBeats(filtered);
        }
      });
    }
  });
})();
// --- END BEATS MODULE ---

