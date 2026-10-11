/* Buildless, Hindi-first, single-village public opinion poll. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const number = new Intl.NumberFormat('hi-IN');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const iconPaths = {
    ballot: ['M4 13h16v8H4z','M7 13v-3h10v3','m8 2 10 3-3 9-10-3z','m8 7 2 3 5-3'],
    pin: ['M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z','M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
    arrow: ['M4 12h16','m14 6 6 6-6 6'],
    up: ['M12 20V4','m6 10 6-6 6 6'],
    users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z','M22 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75'],
    chart: ['M4 3v18h17','M8 16v-4','M13 16V8','M18 16V5'],
    clock: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z','M12 6v6l4 2'],
    info: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z','M12 11v6','M12 7h.01'],
    shield: ['M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z','m8 12 3 3 5-6'],
    check: ['m5 12 4 4L19 6'],
    close: ['m6 6 12 12','M18 6 6 18'],
    plus: ['M12 5v14','M5 12h14'],
    refresh: ['M20 7v5h-5','M4 17v-5h5','M6.1 7a7 7 0 0 1 11.6-2L20 8','M4 16l2.3 3a7 7 0 0 0 11.6-2'],
    village: ['M3 21h18','M5 21V10l7-7 7 7v11','M9 21v-7h6v7','M9 9h6','M2 13h3','M19 13h3'],
    hand: ['M8 12V5a2 2 0 0 1 4 0v7','M12 8a2 2 0 0 1 4 0v4','M16 10a2 2 0 0 1 4 0v6c0 4-3 6-7 6h-1c-2 0-4-1-5-3l-4-6a2 2 0 0 1 3-2l2 2']
  };
  let poll = null, store = null, pendingCandidate = null, loading = false, submitting = false, opener = null, toastTimer;
  const cardViews = new Map();
  const resultViews = new Map();
  let observer = null;

  function element(tag, className = '', value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of iconPaths[name] || iconPaths.info) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d); svg.append(path);
    }
    return svg;
  }
  document.querySelectorAll('[data-icon]').forEach(node => node.replaceChildren(icon(node.dataset.icon)));
  function label(key) { return poll?.content?.[key] || ''; }
  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4500);
  }
  function safeImagePath(value, fallback) {
    // Local assets and HTTPS photographs only. Reject executable URL schemes.
    if (typeof value !== 'string' || !value.trim()) return fallback;
    try {
      const url = new URL(value, document.baseURI);
      if (url.protocol === 'https:' || url.origin === location.origin && ['http:', 'file:'].includes(url.protocol)) return url.href;
    } catch { /* use local fallback */ }
    return fallback;
  }
  function setPhoto(image, candidate) {
    image.src = safeImagePath(candidate.photo, 'assets/images/photo-fallback.svg');
    image.alt = candidate.name;
    image.onerror = () => {
      image.onerror = null;
      image.src = 'assets/images/photo-fallback.svg';
      image.classList.add('photo-missing');
    };
  }
  function validate(data) {
    if (!data || typeof data !== 'object' || typeof data.poll_id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.poll_id)) throw new Error('JSON में poll_id सही नहीं है।');
    if (!data.settings || typeof data.settings !== 'object') throw new Error('JSON में settings नहीं मिलीं।');
    for (const name of ['village', 'gram_panchayat', 'district', 'state', 'title', 'heading', 'subtitle']) {
      if (typeof data.settings[name] !== 'string' || !data.settings[name].trim()) throw new Error(`JSON settings में ${name} ज़रूरी है।`);
    }
    for (const name of ['voting_enabled', 'show_results']) {
      if (typeof data.settings[name] !== 'boolean') throw new Error(`JSON में ${name} true या false होना चाहिए।`);
    }
    if (!data.content || typeof data.content !== 'object') throw new Error('JSON में content नहीं मिला।');
    for (const value of Object.values(data.content)) if (typeof value !== 'string') throw new Error('content के सभी labels text होने चाहिए।');
    if (!Array.isArray(data.candidates)) throw new Error('JSON में candidates की सूची सही नहीं है।');
    const seen = new Set();
    let total = 0;
    for (const c of data.candidates) {
      if (!c || typeof c.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(c.id) || seen.has(c.id)) throw new Error('हर उम्मीदवार की अलग, सही id होनी चाहिए।');
      if (typeof c.name !== 'string' || !c.name.trim()) throw new Error('उम्मीदवार का नाम ज़रूरी है।');
      if (typeof c.village !== 'string' || typeof c.description !== 'string') throw new Error('उम्मीदवार का village और description text होना चाहिए।');
      if (!Number.isSafeInteger(c.votes) || c.votes < 0) throw new Error('वोट count शून्य या उससे बड़ी पूर्ण संख्या होनी चाहिए।');
      total += c.votes;
      if (!Number.isSafeInteger(total)) throw new Error('कुल वोट count बहुत बड़ा है।');
      seen.add(c.id);
    }
    if (!Array.isArray(data.steps) || data.steps.length !== 3 || !data.steps.every(s => s && typeof s.title === 'string' && typeof s.description === 'string')) throw new Error('JSON में तीन सही steps चाहिए।');
    if (!Array.isArray(data.faq) || !data.faq.every(q => q && typeof q.question === 'string' && typeof q.answer === 'string')) throw new Error('JSON में FAQ सही नहीं हैं।');
    return { ...data, total };
  }
  function percent(votes) { return poll.total ? votes / poll.total * 100 : 0; }
  function percentText(votes) { return `${number.format(Math.round(percent(votes) * 10) / 10)}%`; }
  function countTo(node, target) {
    if (motion.matches || !('IntersectionObserver' in window)) { node.textContent = number.format(target); return; }
    // Keep full semantic value available while the visual counter animates.
    node.setAttribute('aria-label', number.format(target));
    node.dataset.count = target;
    node.textContent = '0';
    counters.observe(node);
  }
  const counters = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const node = entry.target, target = Number(node.dataset.count), start = performance.now();
      counters.unobserve(node);
      const tick = now => {
        const fraction = Math.min(1, (now - start) / 1000);
        node.textContent = number.format(Math.round(target * (1 - Math.pow(1 - fraction, 3))));
        if (fraction < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: .25 }) : null;
  function observeReveals() {
    document.querySelectorAll('.reveal, .progress-owner').forEach(node => {
      if (observer && !motion.matches) observer.observe(node);
      else node.classList.add('in-view');
    });
  }
  if ('IntersectionObserver' in window) observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
    });
  }, { threshold: .06 });
  function makeProgress(votes) {
    const track = element('div', 'progress-track');
    const bar = element('div', 'progress-fill');
    bar.style.setProperty('--fill', String(percent(votes) / 100));
    track.setAttribute('aria-hidden', 'true');
    track.append(bar); return track;
  }
  function renderCard(candidate, index) {
    const card = element('article', 'candidate-card reveal progress-owner');
    card.style.setProperty('--delay', `${Math.min(index % 3 * 90, 180)}ms`);
    const picture = element('div', 'candidate-photo-wrap');
    const image = element('img', 'candidate-photo');
    image.width = 560; image.height = 700; image.loading = 'lazy'; image.decoding = 'async'; setPhoto(image, candidate);
    const badge = element('span', 'candidate-number', `${label('candidate_number')} ${number.format(index + 1).padStart(2, '0')}`);
    const chosen = element('span', 'chosen-badge'); chosen.append(icon('check'), document.createTextNode(label('selected'))); chosen.hidden = true;
    picture.append(image, badge, chosen);
    const body = element('div', 'candidate-body');
    const title = element('h3', 'candidate-name', candidate.name);
    const place = element('p', 'candidate-location'); place.append(icon('pin'), document.createTextNode(candidate.village));
    body.append(title, place, element('p', 'candidate-description', candidate.description));
    if (poll.settings.show_results) {
      const numbers = element('div', 'candidate-numbers');
      const votesGroup = element('div');
      const votes = element('strong', 'candidate-votes'); countTo(votes, candidate.votes);
      votesGroup.append(votes, element('small', '', label('published_votes')));
      numbers.append(votesGroup, element('span', 'candidate-percentage', percentText(candidate.votes)));
      body.append(numbers, makeProgress(candidate.votes));
    }
    const button = element('button', 'button vote-button'); button.type = 'button'; button.dataset.voteId = candidate.id;
    const buttonLabel = element('span', '', label('vote'));
    button.append(icon('ballot'), buttonLabel); button.setAttribute('aria-label', `${candidate.name} — ${label('vote')}`);
    body.append(button); card.append(picture, body);
    cardViews.set(candidate.id, { card, chosen, button, buttonLabel });
    return card;
  }
  function renderResult(candidate) {
    const row = element('div', 'result-row progress-owner');
    const image = element('img', 'result-avatar'); image.width = 58; image.height = 62; image.loading = 'lazy'; setPhoto(image, candidate);
    const meta = element('div', 'result-meta'), top = element('div', 'result-row-top'), name = element('div');
    const chosen = element('span', 'result-selected', label('your_choice')); chosen.hidden = true;
    name.append(element('span', 'result-name', candidate.name), chosen);
    top.append(name, element('span', 'result-percent', percentText(candidate.votes)));
    meta.append(top, element('p', 'result-votes', `${number.format(candidate.votes)} ${label('published_votes')}`), makeProgress(candidate.votes));
    row.append(image, meta); resultViews.set(candidate.id, chosen); return row;
  }
  function render() {
    const settings = poll.settings;
    document.title = `${settings.gram_panchayat} · ${settings.title}`;
    document.querySelector('meta[name="description"]').content = settings.subtitle;
    document.querySelectorAll('[data-copy]').forEach(node => { if (poll.content[node.dataset.copy] !== undefined) node.textContent = poll.content[node.dataset.copy]; });
    $('hero-eyebrow').textContent = settings.title;
    $('hero-location').textContent = `${settings.gram_panchayat} · ${settings.district}, ${settings.state}`;
    const lines = Array.isArray(settings.heading_lines) && settings.heading_lines.length ? settings.heading_lines : [settings.heading];
    $('hero-heading').replaceChildren(...lines.map((line, i) => element('span', i === lines.length - 1 ? 'accent' : '', String(line))));
    $('hero-description').textContent = settings.subtitle;
    $('hero-notice').textContent = settings.notice;
    $('hero-image').src = safeImagePath(settings.hero_image, 'assets/images/village.webp');
    $('hero-image').alt = settings.hero_alt || '';
    $('hero-image').onerror = () => { $('hero-image').onerror = null; $('hero-image').src = 'assets/images/village.webp'; };
    $('plaque-name').textContent = settings.gram_panchayat;
    $('plaque-district').textContent = `${settings.district}, ${settings.state}`;
    countTo($('stat-candidates'), poll.candidates.length); countTo($('stat-votes'), poll.total); countTo($('result-total'), poll.total);
    $('stat-village').textContent = settings.gram_panchayat;
    $('stat-status').textContent = settings.voting_enabled ? label('status_open') : label('status_closed');
    $('candidate-chip').textContent = `${number.format(poll.candidates.length)} ${label('nav_candidates')}`;
    $('published-stat').hidden = !settings.show_results;
    $('overview').classList.toggle('no-published', !settings.show_results);
    $('results').hidden = !settings.show_results;
    document.querySelectorAll('[data-results-link]').forEach(node => { node.hidden = !settings.show_results; });
    const validDate = Number.isFinite(Date.parse(settings.updated_at));
    $('updated-at').textContent = validDate ? new Intl.DateTimeFormat('hi-IN', { day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit', hour12:true, timeZone:'Asia/Kolkata' }).format(new Date(settings.updated_at)) : label('not_available');
    if (validDate) $('updated-at').dateTime = settings.updated_at; else $('updated-at').removeAttribute('datetime');
    $('demo-note').hidden = settings.demo_mode !== true;
    $('demo-note-text').textContent = label('demo_note');
    $('footer-panchayat').textContent = `${label('gram_panchayat')} ${settings.gram_panchayat} · ${settings.district}`;
    $('footer-notice').textContent = settings.notice;
    $('copyright').textContent = `© ${new Date().getFullYear()} ${label('brand')} · ${settings.gram_panchayat}`;
    cardViews.clear(); resultViews.clear();
    $('candidate-grid').replaceChildren(...poll.candidates.map(renderCard));
    $('result-list').replaceChildren(...(settings.show_results ? poll.candidates.map(renderResult) : []));
    if (!poll.candidates.length) $('candidate-grid').append(element('p', 'empty-state', label('no_candidates')));
    $('steps').replaceChildren(...poll.steps.map((step, i) => {
      const node = element('article', 'step reveal'); node.style.setProperty('--delay', `${i * 90}ms`);
      const badge = element('div', 'step-icon'); badge.append(icon(step.icon), element('span', 'step-number', number.format(i + 1)));
      node.append(badge, element('h3', '', step.title), element('p', '', step.description)); return node;
    }));
    $('faq-list').replaceChildren(...poll.faq.map(faq => {
      const node = element('details'), summary = element('summary');
      summary.append(document.createTextNode(faq.question), icon('plus')); node.append(summary, element('p', '', faq.answer)); return node;
    }));
    syncChoice(); observeReveals();
  }
  function stateMessage(state) {
    if (state.kind === 'unavailable') return label('storage_unavailable');
    if (state.kind === 'invalid') return label('storage_invalid');
    return label('already_voted');
  }
  function syncChoice() {
    if (!poll || !store) return;
    const state = store.read(), saved = state.kind === 'saved', blocked = state.kind !== 'new';
    const selectedId = saved ? state.vote.candidate_id : null;
    for (const c of poll.candidates) {
      const view = cardViews.get(c.id), selected = c.id === selectedId;
      view.card.classList.toggle('is-chosen', selected); view.chosen.hidden = !selected;
      view.button.disabled = blocked || !poll.settings.voting_enabled || submitting;
      view.buttonLabel.textContent = selected ? label('selected') : saved ? label('choice_recorded') : blocked ? label('unavailable') : !poll.settings.voting_enabled ? label('status_closed') : label('vote');
      view.button.setAttribute('aria-label', `${c.name} — ${view.buttonLabel.textContent}`);
      if (resultViews.has(c.id)) resultViews.get(c.id).hidden = !selected;
    }
    const banner = $('choice-banner');
    banner.hidden = !blocked && poll.settings.voting_enabled;
    banner.classList.toggle('is-warning', !saved);
    $('choice-banner-title').textContent = saved ? label('already_voted') : blocked ? stateMessage(state) : label('closed_message');
    const selected = poll.candidates.find(c => c.id === selectedId);
    $('choice-banner-description').textContent = saved ? `${selected ? `${label('your_choice')} ${selected.name}। ` : label('removed_candidate')} ${label('local_only')}` : label('local_only');
  }
  async function loadPoll() {
    if (loading) return false;
    loading = true;
    $('refresh-results').disabled = true; $('retry-load').disabled = true;
    $('candidate-grid').setAttribute('aria-busy', 'true');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`data/poll.json?t=${Date.now()}`, { cache:'no-store', signal:controller.signal });
      if (!response.ok) throw new Error(`JSON लोड नहीं हुआ (HTTP ${response.status})।`);
      const next = validate(await response.json());
      poll = next;
      try { store = new window.VotingStore(poll.poll_id, poll.candidates.map(c => c.id)); }
      catch { store = new window.VotingStore(poll.poll_id, poll.candidates.map(c => c.id), { getItem() { throw new Error('Storage blocked'); } }, null); }
      render(); $('load-error').hidden = true; $('candidate-grid').hidden = false;
      return true;
    } catch (error) {
      if (poll) toast(label('refresh_failed'));
      else {
        $('candidate-grid').hidden = true; $('load-error').hidden = false;
        $('load-error-text').textContent = location.protocol === 'file:' ? 'index.html को सीधे double-click करके खोलने पर JSON नहीं पढ़ा जा सकता। VS Code Live Server से खोलें या folder को hosting पर upload करें।' : error.name === 'AbortError' ? 'कनेक्शन धीमा है। कृपया फिर कोशिश करें।' : `data/poll.json जाँचें। ${error instanceof SyntaxError ? 'JSON का format सही नहीं है।' : error.message}`;
      }
      return false;
    } finally {
      clearTimeout(timeout); loading = false;
      $('refresh-results').disabled = false; $('retry-load').disabled = false;
      $('candidate-grid').setAttribute('aria-busy', 'false');
    }
  }
  function openVote(candidateId, button) {
    if (!poll || loading || submitting || !poll.settings.voting_enabled) return;
    if (store.read().kind !== 'new') { syncChoice(); toast(stateMessage(store.read())); return; }
    pendingCandidate = poll.candidates.find(c => c.id === candidateId);
    if (!pendingCandidate) return;
    opener = button;
    $('dialog-name').textContent = pendingCandidate.name; $('dialog-village').textContent = pendingCandidate.village;
    setPhoto($('dialog-photo'), pendingCandidate);
    $('confirm-view').hidden = false; $('success-view').hidden = true; $('dialog-error').hidden = true;
    $('vote-dialog').setAttribute('aria-labelledby', 'dialog-title'); $('vote-dialog').setAttribute('aria-describedby', 'dialog-note');
    $('confirm-vote').disabled = false;
    if (typeof $('vote-dialog').showModal !== 'function') { toast(label('modern_browser')); return; }
    document.body.classList.add('modal-open'); $('vote-dialog').showModal(); $('cancel-vote').focus();
  }
  function closeVote() {
    if (submitting) return;
    if ($('vote-dialog').open) $('vote-dialog').close();
  }
  function confetti() {
    if (motion.matches) return;
    const layer = $('confetti-layer'); layer.replaceChildren();
    for (let i = 0; i < 36; i++) {
      const piece = element('i', 'confetti');
      piece.style.background = ['#ffbc75','#b3d4bd','#f6eddb','#a67042'][i % 4];
      piece.style.setProperty('--x', `${(Math.random() - .5) * Math.min(innerWidth * .85, 650)}px`);
      piece.style.setProperty('--y', `${Math.random() * 150 + 160}px`);
      piece.style.setProperty('--r', `${Math.random() * 760 - 380}deg`);
      piece.style.animationDelay = `${Math.random() * .18}s`;
      layer.append(piece);
    }
    setTimeout(() => layer.replaceChildren(), 1800);
  }
  async function confirmVote() {
    if (!pendingCandidate || submitting || !poll?.settings.voting_enabled) return;
    submitting = true; $('confirm-vote').disabled = true;
    const candidate = pendingCandidate;
    try {
      const result = await store.save(candidate.id);
      if (result.kind === 'created') {
        $('confirm-view').hidden = true; $('success-view').hidden = false;
        $('success-name').textContent = candidate.name;
        $('vote-dialog').setAttribute('aria-labelledby', 'success-title'); $('vote-dialog').removeAttribute('aria-describedby');
        confetti(); $('finish-vote').focus();
      } else {
        $('dialog-error').textContent = stateMessage(result); $('dialog-error').hidden = false;
        $('confirm-vote').disabled = true;
      }
    } finally { submitting = false; syncChoice(); }
  }
  $('candidate-grid').addEventListener('click', event => {
    const button = event.target.closest('[data-vote-id]');
    if (button && !button.disabled) openVote(button.dataset.voteId, button);
  });
  $('confirm-vote').addEventListener('click', confirmVote);
  ['dialog-close','cancel-vote','finish-vote'].forEach(id => $(id).addEventListener('click', closeVote));
  $('vote-dialog').addEventListener('cancel', event => { if (submitting) event.preventDefault(); });
  $('vote-dialog').addEventListener('click', event => {
    if (event.target !== $('vote-dialog')) return;
    const bounds = $('vote-dialog').getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeVote();
  });
  $('vote-dialog').addEventListener('close', () => {
    document.body.classList.remove('modal-open'); pendingCandidate = null;
    if (opener && !opener.disabled) opener.focus();
    else { $('candidates-heading').tabIndex = -1; $('candidates-heading').focus({ preventScroll:true }); }
  });
  window.addEventListener('storage', event => {
    if (!store || event.key !== store.key && event.key !== null) return;
    syncChoice();
    if ($('vote-dialog').open && !$('confirm-view').hidden && store.read().kind !== 'new') {
      $('dialog-error').textContent = stateMessage(store.read()); $('dialog-error').hidden = false; $('confirm-vote').disabled = true;
    }
  });
  $('refresh-results').addEventListener('click', async () => { if (await loadPoll()) toast(label('refreshed')); });
  $('retry-load').addEventListener('click', loadPoll);
  let scheduled = false;
  const scrollState = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    $('reading-progress').style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0})`;
    $('back-top').classList.toggle('visible', scrollY > 700);
    let current = '';
    for (const id of ['candidates','results','how-it-works']) {
      const section = $(id); if (!section.hidden && section.getBoundingClientRect().top < innerHeight * .48) current = id;
    }
    document.querySelectorAll('.desktop-nav a, .mobile-dock a').forEach(a => {
      const active = a.getAttribute('href') === `#${current}`;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    scheduled = false;
  };
  window.addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(scrollState); } }, { passive:true });
  window.addEventListener('resize', scrollState, { passive:true });
  observeReveals(); scrollState(); loadPoll();
})();
