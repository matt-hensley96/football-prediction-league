const state = {
  page: 'table',
  token: localStorage.getItem('predictor_token'),
  userName: localStorage.getItem('predictor_name'),
};

const OUTCOME_LABELS = { HOME: 'HOME', AWAY: 'AWAY', DRAW: 'DRAW' };

const app = document.getElementById('app');

function setLoggedIn(token, name) {
  state.token = token;
  state.userName = name;
  localStorage.setItem('predictor_token', token);
  localStorage.setItem('predictor_name', name);
}

function logout() {
  state.token = null;
  state.userName = null;
  localStorage.removeItem('predictor_token');
  localStorage.removeItem('predictor_name');
  render();
}

async function api(path, options) {
  const headers = { 'Content-Type': 'application/json' };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`/api${path}`, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function formatKickoff(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatTeam(name) {
  return String(name).replace(/\bFC\b/g, '').replace(/\s{2,}/g, ' ').trim();
}

const TEAM_ACRONYMS = {
  arsenal: 'ARS',
  'aston villa': 'AVL',
  bournemouth: 'BOU',
  brentford: 'BRE',
  'brighton hove albion': 'BHA',
  brighton: 'BHA',
  burnley: 'BUR',
  chelsea: 'CHE',
  'crystal palace': 'CRY',
  everton: 'EVE',
  fulham: 'FUL',
  'ipswich town': 'IPS',
  ipswich: 'IPS',
  'leeds united': 'LEE',
  leeds: 'LEE',
  'leicester city': 'LEI',
  leicester: 'LEI',
  liverpool: 'LIV',
  'luton town': 'LUT',
  'manchester city': 'MCI',
  'manchester united': 'MUN',
  'newcastle united': 'NEW',
  newcastle: 'NEW',
  'nottingham forest': 'NFO',
  'sheffield united': 'SHU',
  southampton: 'SOU',
  sunderland: 'SUN',
  'tottenham hotspur': 'TOT',
  tottenham: 'TOT',
  'west ham united': 'WHU',
  'west ham': 'WHU',
  'wolverhampton wanderers': 'WOL',
  wolverhampton: 'WOL',
  wolves: 'WOL',
};

function teamAcronym(name) {
  const key = String(name)
    .replace(/\bA?FC\b/gi, '')
    .replace(/&/g, ' ')
    .replace(/[^a-zA-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return TEAM_ACRONYMS[key] || key.slice(0, 3).toUpperCase();
}

function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();

  return template.content.firstElementChild;
}

async function renderTablePage() {
  app.innerHTML = '<h1>League Table</h1><p class="muted">Loading&hellip;</p>';

  try {
    const { standings } = await api('/table');

    if (standings.length === 0) {
      app.innerHTML = `<h1>League Table</h1><p class="info-box">No scored gameweeks yet.</p>${scoringSystemTable()}`;

      return;
    }

    const rows = standings
      .map(
        (s, i) => `
        <tr>
          <td class="player">${i + 1}. ${escapeHtml(s.name)}</td>
          <td class="points">${s.points}</td>
        </tr>`,
      )
      .join('');

    app.innerHTML = `
      <h1>League Table</h1>
      <table class="retro-table league-table">
        <thead><tr><th>Player</th><th class="points">Points</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${scoringSystemTable()}
    `;
  } catch (err) {
    app.innerHTML = `<h1>League Table</h1><p class="error-text">${escapeHtml(err.message)}</p>`;
  }
}

function scoringSystemTable() {
  return `
    <table class="retro-table scoring-table">
      <thead><tr><th>Scoring system</th><th class="points">Points</th></tr></thead>
      <tbody>
        <tr>
          <td>Correct prediction</td>
          <td class="points">+3</td>
        </tr>
        <tr>
          <td>Picked a win, the other team won</td>
          <td class="points points-neg">-1</td>
        </tr>
        <tr>
          <td>Any other miss (e.g. picked a win, it was a draw)</td>
          <td class="points points-zero">0</td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderAuthForm(onSuccess, intro) {
  const wrapper = el('<div class="auth-wrapper"></div>');
  let mode = 'login';

  function draw() {
    wrapper.innerHTML = '';

    if (mode === 'forgot') {
      wrapper.appendChild(
        renderForgotPinForm(() => {
          mode = 'login';
          draw();
        }),
      );

      return;
    }

    if (intro) wrapper.appendChild(el(`<p class="muted">${escapeHtml(intro)}</p>`));

    const toggle = el(`
      <div class="auth-toggle">
        <button type="button" class="auth-toggle-btn" data-mode="login">LOG IN</button>
        <button type="button" class="auth-toggle-btn" data-mode="signup">SIGN UP</button>
      </div>
    `);

    toggle.querySelectorAll('.auth-toggle-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
      btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        draw();
      });
    });

    wrapper.appendChild(toggle);

    const isSignup = mode === 'signup';
    const form = el(`
      <form class="login-form">
        <label>Username<br><input type="text" name="name" autocomplete="username" required
          ${isSignup ? 'pattern="[A-Za-z][A-Za-z0-9_-]{2,19}" maxlength="20" title="3-20 characters, start with a letter, letters/numbers/underscores/hyphens only"' : ''} /></label>
        ${isSignup ? '<label>Email (lets you recover a forgotten PIN)<br><input type="email" name="email" autocomplete="email" required /></label>' : ''}
        <label>PIN<br><input type="password" inputmode="numeric" name="pin"
          autocomplete="${isSignup ? 'new-password' : 'current-password'}" required /></label>
        <button type="submit">${isSignup ? 'CREATE ACCOUNT' : 'LOG IN'}</button>
        <p class="error-text" style="display:none"></p>
      </form>
    `);

    const errorEl = form.querySelector('.error-text');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.style.display = 'none';

      const name = form.name.value.trim();
      const pin = form.pin.value.trim();
      const path = isSignup ? '/signup' : '/login';
      const payload = isSignup ? { name, pin, email: form.email.value.trim() || undefined } : { name, pin };

      try {
        const { token, name: canonicalName } = await api(path, { method: 'POST', body: JSON.stringify(payload) });
        setLoggedIn(token, canonicalName || name);
        onSuccess();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      }
    });

    wrapper.appendChild(form);

    if (!isSignup) {
      const forgotBtn = el('<button type="button" class="link-btn">FORGOT PIN?</button>');
      forgotBtn.addEventListener('click', () => {
        mode = 'forgot';
        draw();
      });
      wrapper.appendChild(forgotBtn);
    }
  }

  draw();

  return wrapper;
}

function renderForgotPinForm(onBack) {
  const wrapper = el('<div></div>');
  const form = el(`
    <form class="login-form">
      <label>Email<br><input type="email" name="email" autocomplete="email" required /></label>
      <button type="submit">SEND RESET LINK</button>
      <p class="error-text" style="display:none"></p>
      <p class="info-box" style="display:none"></p>
    </form>
  `);

  const errorEl = form.querySelector('.error-text');
  const infoEl = form.querySelector('.info-box');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const email = form.email.value.trim();

    try {
      await api('/forgot-pin', { method: 'POST', body: JSON.stringify({ email }) });
      submitBtn.disabled = true;
      infoEl.textContent = "If that email is registered, we've sent a link to reset your PIN.";
      infoEl.style.display = 'block';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  });

  wrapper.appendChild(form);

  const backBtn = el('<button type="button" class="link-btn">BACK TO LOG IN</button>');
  backBtn.addEventListener('click', onBack);
  wrapper.appendChild(backBtn);

  return wrapper;
}

function renderResetPinPage(token) {
  app.innerHTML = '<h1>Set New PIN</h1>';

  const form = el(`
    <form class="login-form">
      <label>New PIN<br><input type="password" inputmode="numeric" name="pin"
        autocomplete="new-password" required /></label>
      <button type="submit">SET PIN</button>
      <p class="error-text" style="display:none"></p>
    </form>
  `);

  const errorEl = form.querySelector('.error-text');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const pin = form.pin.value.trim();

    try {
      await api('/reset-pin', { method: 'POST', body: JSON.stringify({ token, pin }) });
      window.history.replaceState({}, '', window.location.pathname);
      app.innerHTML =
        '<h1>Set New PIN</h1><p class="info-box">Your PIN has been reset. You can now log in with it.</p>';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  });

  app.appendChild(form);
}

async function renderPredictPage() {
  app.innerHTML = '';
  app.appendChild(el('<h1>Predictions</h1>'));

  if (!state.token) {
    app.appendChild(renderAuthForm(renderPredictPage, 'Log in (or sign up) to make your picks.'));

    return;
  }

  const loggedInBar = el(`
    <p class="info-box">Logged in as <strong>${escapeHtml(state.userName)}</strong>
      &nbsp; <button class="logout-btn" type="button">LOG OUT</button></p>
  `);
  loggedInBar.querySelector('.logout-btn').addEventListener('click', logout);
  app.appendChild(loggedInBar);

  const loadingMsg = el('<p class="muted">Loading fixtures&hellip;</p>');
  app.appendChild(loadingMsg);

  try {
    const { gameweek, fixtures, picks, isOpen } = await api('/gameweek');
    loadingMsg.remove();

    if (!gameweek) {
      app.appendChild(el('<p class="info-box">No gameweek is open right now. Check back nearer kick-off.</p>'));

      return;
    }

    if (!isOpen) {
      app.appendChild(el('<p class="info-box">Predictions are closed for this gameweek.</p>'));
    } else {
      app.appendChild(
        el(
          `<p class="muted">Deadline: ${formatKickoff(gameweek.deadline)}.</p>`,
        ),
      );
    }

    const localPicks = { ...picks };

    const sortedFixtures = [...fixtures].sort(
      (a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time),
    );

    for (const fixture of sortedFixtures) {
      app.appendChild(
        renderFixtureCard(fixture, localPicks[fixture.id], isOpen, (pick) => {
          localPicks[fixture.id] = pick;
        }),
      );
    }

    if (isOpen) {
      app.appendChild(renderSubmitControls(localPicks, fixtures.length));
    }
  } catch (err) {
    loadingMsg.remove();
    app.appendChild(el(`<p class="error-text">${escapeHtml(err.message)}</p>`));
  }
}

function renderFixtureCard(fixture, currentPick, isOpen, onPick) {
  const card = el(`
    <div class="fixture-card">
      <div>${escapeHtml(formatTeam(fixture.home_team))} vs ${escapeHtml(formatTeam(fixture.away_team))}</div>
      <div class="fixture-kickoff">${formatKickoff(fixture.kickoff_time)}</div>
      <div class="pick-row">
        <button class="pick-btn" data-pick="HOME" type="button">${escapeHtml(formatTeam(fixture.home_team))}</button>
        <button class="pick-btn" data-pick="DRAW" type="button">DRAW</button>
        <button class="pick-btn" data-pick="AWAY" type="button">${escapeHtml(formatTeam(fixture.away_team))}</button>
      </div>
    </div>
  `);

  const buttons = card.querySelectorAll('.pick-btn');

  if (fixture.voided) {
    markVoidedFixture(card, buttons, fixture, currentPick);

    return card;
  }

  if (fixture.result) {
    markResolvedFixture(card, buttons, fixture, currentPick);

    return card;
  }

  buttons.forEach((btn) => {
    if (btn.dataset.pick === currentPick) {
      btn.classList.add('selected');
    }

    btn.disabled = !isOpen;

    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      onPick(btn.dataset.pick);
    });
  });

  return card;
}

function markResolvedFixture(card, buttons, fixture, currentPick) {
  const hasPick = currentPick != null;
  const isCorrect = hasPick && currentPick === fixture.result;
  const verdictClass = isCorrect ? 'verdict-correct' : hasPick ? 'verdict-wrong' : 'verdict-nopick';

  card.classList.add('resolved', verdictClass);

  buttons.forEach((btn) => {
    btn.disabled = true;

    if (btn.dataset.pick === currentPick) {
      btn.classList.add('selected');
    }
  });

  card.appendChild(renderVerdict(fixture, currentPick));
}

function markVoidedFixture(card, buttons, fixture, currentPick) {
  card.classList.add('resolved', 'verdict-void');

  buttons.forEach((btn) => {
    btn.disabled = true;

    if (btn.dataset.pick === currentPick) {
      btn.classList.add('selected');
    }
  });

  card.appendChild(
    el(`
      <div class="verdict">
        <span class="verdict-status">${escapeHtml(voidLabel(fixture))}</span>
      </div>
    `),
  );
}

function voidLabel(fixture) {
  const reason =
    fixture.void_reason === 'CANCELLED' || fixture.void_reason === 'SUSPENDED'
      ? fixture.void_reason
      : 'POSTPONED';

  return `${reason} · NO POINTS`;
}

function renderVerdict(fixture, currentPick) {
  const hasPick = currentPick != null;
  const isCorrect = hasPick && currentPick === fixture.result;
  const status = !hasPick ? '— NO PREDICTION' : isCorrect ? '✓ CORRECT' : '✗ INCORRECT';

  const verdict = el(`
    <div class="verdict">
      <span class="verdict-status">${escapeHtml(status)}</span>
    </div>
  `);

  if (!isCorrect) {
    const result = `Result: ${outcomeName(fixture, fixture.result)}`;

    verdict.appendChild(el(`<span class="verdict-detail">${escapeHtml(result)}</span>`));
  }

  return verdict;
}

function outcomeName(fixture, outcome) {
  if (outcome === 'HOME') {
    return formatTeam(fixture.home_team);
  }

  if (outcome === 'AWAY') {
    return formatTeam(fixture.away_team);
  }

  return OUTCOME_LABELS[outcome] || outcome;
}

function renderSubmitControls(localPicks, fixtureCount) {
  const wrapper = el(`
    <div class="submit-controls">
      <button class="submit-btn" type="button">SUBMIT</button>
      <p class="error-text" style="display:none"></p>
      <p class="info-box" style="display:none"></p>
    </div>
  `);

  const submitBtn = wrapper.querySelector('.submit-btn');
  const errorEl = wrapper.querySelector('.error-text');
  const infoEl = wrapper.querySelector('.info-box');

  submitBtn.addEventListener('click', async () => {
    const picks = Object.entries(localPicks).map(([fixtureId, pick]) => ({ fixtureId: Number(fixtureId), pick }));

    errorEl.style.display = 'none';
    infoEl.style.display = 'none';

    if (picks.length < fixtureCount) {
      errorEl.textContent = 'Pick a result for every fixture before submitting.';
      errorEl.style.display = 'block';

      return;
    }

    submitBtn.disabled = true;

    try {
      await api('/predictions', { method: 'POST', body: JSON.stringify({ picks }) });
      infoEl.textContent = 'Predictions saved!';
      infoEl.style.display = 'block';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
    }
  });

  return wrapper;
}

async function renderHistoryPage() {
  app.innerHTML = '<h1>History</h1><p class="muted">Loading&hellip;</p>';

  try {
    const { history } = await api('/history');

    if (history.length === 0) {
      app.innerHTML = '<h1>History</h1><p class="info-box">No gameweeks scored yet.</p>';

      return;
    }

    app.innerHTML = '<h1>History</h1>';

    for (const entry of history) {
      app.appendChild(renderHistoryBlock(entry));
    }
  } catch (err) {
    app.innerHTML = `<h1>History</h1><p class="error-text">${escapeHtml(err.message)}</p>`;
  }
}

function renderHistoryBlock(entry) {
  const block = el(`<div class="history-block"><h2>Gameweek ${entry.gameweek.matchday}</h2></div>`);

  for (const fixture of entry.fixtures) {
    block.appendChild(
      el(`
        <div class="fixture-head">
          <strong>${escapeHtml(teamAcronym(fixture.home_team))} vs ${escapeHtml(teamAcronym(fixture.away_team))}</strong>
        </div>
      `),
    );

    if (fixture.voided) {
      block.appendChild(
        el(`<div class="result-line void-line"><span>${escapeHtml(voidLabel(fixture))}</span></div>`),
      );
    }

    const picksForFixture = entry.picks.filter((p) => p.fixture_id === fixture.id);

    for (const pick of picksForFixture) {
      block.appendChild(
        el(`
          <div class="result-line">
            <span>${escapeHtml(pick.name.toUpperCase())}: ${OUTCOME_LABELS[pick.pick]}</span>
            <span class="points">${fixture.voided ? '–' : `${pick.points_awarded ?? 0}pt`}</span>
          </div>
        `),
      );
    }
  }

  return block;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function render() {
  document.querySelectorAll('.page-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.page === state.page);
  });

  if (state.page === 'table') return renderTablePage();
  if (state.page === 'predict') return renderPredictPage();
  if (state.page === 'history') return renderHistoryPage();
}

document.querySelectorAll('.page-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.page = btn.dataset.page;
    render();
  });
});

function tickClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

tickClock();
setInterval(tickClock, 1000 * 30);

const resetToken = new URLSearchParams(window.location.search).get('resetToken');

if (resetToken) {
  renderResetPinPage(resetToken);
} else {
  render();
}
