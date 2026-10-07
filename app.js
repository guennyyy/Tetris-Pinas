/* Navigation, local player progress, settings, and match lifecycle. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const MODES = { marathon: 'Marathon', sprint: '40-line Sprint', blitz: 'Blitz', practice: 'Practice', versus: 'Online Versus' };
    const defaults = { ghost: true, effects: true, sound: false, vibration: false, buttons: false, hints: true, theme: 'fiesta' };
    const avatars = ['★', '🦅', '☀', '🌺', '⚡'];
    let storageAvailable = true;
    function read(key, fallback) {
        try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
        catch { return fallback; }
    }
    function save(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); }
        catch { storageAvailable = false; notice('This browser cannot save progress right now. You can still play.'); }
    }
    const stored = read('tetrisPinasProgress', {});
    const progress = { profiles: stored.profiles && typeof stored.profiles === 'object' ? stored.profiles : {}, matches: Array.isArray(stored.matches) ? stored.matches : [] };
    const storedSettings = read('tetrisPinasSettings', {});
    const settings = { ...defaults };
    Object.keys(defaults).forEach(key => {
        if (typeof storedSettings[key] === typeof defaults[key]) settings[key] = storedSettings[key];
    });
    if (!['fiesta', 'night'].includes(settings.theme)) settings.theme = 'fiesta';
    let playerId = 'guest';
    let profile;
    let mode = 'marathon';
    let elapsed = 0;
    let active = false;
    let recorded = false;
    let currentPage = 'home';
    let audio;
    let noticeTimer;
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
    const number = value => Number(value || 0).toLocaleString();
    const clock = ms => {
        const seconds = Math.max(0, Math.floor(ms / 1000));
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    };
    const date = timestamp => new Date(timestamp).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
    function notice(message) {
        $('hubNotice').textContent = message;
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => { $('hubNotice').textContent = ''; }, 4000);
    }
    function ownMatches() { return progress.matches.filter(match => match.playerId === playerId); }
    function totals() {
        const matches = ownMatches();
        return { games: matches.length, lines: matches.reduce((sum, m) => sum + m.lines, 0), best: Math.max(0, ...matches.filter(m => m.mode !== 'practice').map(m => m.score)), time: matches.reduce((sum, m) => sum + m.duration, 0) };
    }
    function historyHTML(matches) {
        if (!matches.length) return '<p class="empty-state">Your story starts with your first game. Choose a mode to begin.</p>';
        return matches.slice().reverse().slice(0, 15).map(m => `<article class="history-row"><span class="history-dot">${m.success ? '★' : '◆'}</span><div><strong>${escape(MODES[m.mode] || m.mode)}</strong><small>${escape(date(m.at))} · ${m.lines} lines · ${clock(m.duration)}${m.abandoned ? ' · Ended early' : ''}</small></div><b>${number(m.score)}<small>points</small></b></article>`).join('');
    }
    function renderHome() {
        const stats = totals();
        $('welcomeTitle').textContent = `Tara, ${profile.name}!`;
        $('homeBest').textContent = number(stats.best);
        $('homeGames').textContent = number(stats.games);
        $('homeLines').textContent = number(stats.lines);
        $('homeHistory').innerHTML = historyHTML(ownMatches().slice(-3));
        $('resumeMatch').classList.toggle('hidden', !active || gameOver);
        $('resumeMatch').textContent = `Resume ${MODES[mode]} · ${number(score)} points`;
    }
    function renderProfile() {
        const stats = totals();
        $('profileAvatar').textContent = profile.avatar;
        $('profileTitle').textContent = profile.name;
        $('profileAccount').textContent = playerId === 'guest' ? 'Guest player · progress on this browser' : 'Signed-in player · progress on this browser';
        $('profileJoined').textContent = `Playing since ${date(profile.joined)}`;
        $('profileName').value = profile.name;
        $('profileIcon').value = profile.avatar;
        $('profileStats').innerHTML = `<div><span>GAMES</span><strong>${number(stats.games)}</strong></div><div><span>BEST SCORE</span><strong>${number(stats.best)}</strong></div><div><span>TOTAL LINES</span><strong>${number(stats.lines)}</strong></div>`;
        const milestones = [ ['First flight', 'Finish your first game', stats.games >= 1], ['Line maker', 'Clear 10 lines in total', stats.lines >= 10], ['Fiesta scorer', 'Reach 5,000 points in a ranked mode', stats.best >= 5000], ['Sprint finisher', 'Complete a 40-line Sprint', ownMatches().some(m => m.mode === 'sprint' && m.success)] ];
        $('achievements').innerHTML = milestones.map(([title, detail, earned]) => `<article class="achievement ${earned ? 'earned' : ''}"><span>${earned ? '★' : '○'}</span><strong>${title}</strong><small>${detail}</small><b>${earned ? 'Earned' : 'In progress'}</b></article>`).join('');
        $('profileHistory').innerHTML = historyHTML(ownMatches());
    }
    function renderLeaderboard() {
        const selected = $('leaderboardMode').value;
        const qualifying = progress.matches.filter(m => m.mode === selected && !m.abandoned && (selected !== 'sprint' || m.success));
        const bestByPlayer = new Map();
        qualifying.forEach(m => {
            const previous = bestByPlayer.get(m.playerId);
            if (!previous || (selected === 'sprint' ? m.duration < previous.duration : m.score > previous.score)) bestByPlayer.set(m.playerId, m);
        });
        const ranked = [...bestByPlayer.values()].sort((a, b) => selected === 'sprint' ? a.duration - b.duration : b.score - a.score);
        if (!ranked.length) {
            $('leaderboardList').innerHTML = '<p class="empty-state">No results yet for this mode. Finish a game to set the first record.</p>';
            return;
        }
        $('leaderboardList').innerHTML = `<div class="ranking-header"><span>PLAYER</span><span>${selected === 'sprint' ? 'TIME' : 'SCORE'}</span></div>` + ranked.map((m, i) => {
            const p = progress.profiles[m.playerId] || { name:'Player', avatar:'★' };
            return `<article class="ranking-row ${m.playerId === playerId ? 'is-you' : ''}"><span class="rank">${i + 1}</span><span class="ranking-avatar">${escape(p.avatar)}</span><div><strong>${escape(p.name)}${m.playerId === playerId ? ' · You' : ''}</strong><small>${m.lines} lines · ${escape(date(m.at))}</small></div><b>${selected === 'sprint' ? clock(m.duration) + '.' + Math.floor(m.duration % 1000 / 100) : number(m.score)}</b></article>`;
        }).join('');
    }
    function applySettings() {
        document.body.dataset.theme = settings.theme;
        const footer = document.querySelector('.bottom-panel');
        footer.classList.toggle('hidden', !settings.buttons);
        footer.setAttribute('aria-hidden', String(!settings.buttons));
        gameScreen.classList.toggle('with-buttons', settings.buttons);
        document.querySelector('.tip-card').classList.toggle('hidden', !settings.hints);
    }
    function renderSettings() {
        ['Ghost','Effects','Sound','Vibration','Buttons','Hints'].forEach(label => { $('setting' + label).checked = settings[label.toLowerCase()]; });
        $('settingTheme').value = settings.theme;
    }
    function go(page) {
        if (window.onlinePlay?.active) { window.onlinePlay.openMenu(); return; }
        if (page !== 'online') window.onlinePlay?.cancelWaiting();
        if (!$('page-' + page)) page = 'home';
        if (active && !gameOver && !paused) togglePause();
        closeMenu();
        authScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        $('hubScreen').classList.remove('hidden');
        document.querySelectorAll('.hub-page').forEach(section => section.classList.toggle('hidden', section.id !== 'page-' + page));
        document.querySelectorAll('.hub-nav [data-page]').forEach(button => {
            const selected = button.dataset.page === page;
            button.classList.toggle('active', selected);
            if (selected) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
        });
        currentPage = page;
        if (page === 'home') renderHome();
        if (page === 'profile') renderProfile();
        if (page === 'leaderboard') renderLeaderboard();
        if (page === 'settings') renderSettings();
        if (page === 'online') window.onlinePlay?.connect();
        window.scrollTo({ top:0, behavior:'instant' });
        const heading = $('page-' + page).querySelector('h1');
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll:true }); }
    }
    function enter() {
        const user = firebaseReady && !window.tetrisGuestSession ? firebase.auth().currentUser : null;
        playerId = user ? user.uid : 'guest';
        profile = progress.profiles[playerId];
        if (!profile) {
            profile = { name: user ? (user.displayName || user.email?.split('@')[0] || 'Player') : 'Guest', avatar:'🦅', joined:Date.now() };
            progress.profiles[playerId] = profile;
            save('tetrisPinasProgress', progress);
        }
        if (!avatars.includes(profile.avatar)) profile.avatar = '★';
        $('accountName').textContent = profile.name;
        $('accountAvatar').textContent = profile.avatar;
        go(new URLSearchParams(window.location?.search || '').has('room') ? 'online' : 'home');
    }
    function onReset() {
        if (active && !recorded) record("abandoned");
        elapsed = 0;
        recorded = false;
        active = !gameScreen.classList.contains('hidden');
        updateClock();
    }
    function updateClock() {
        $('matchModeLabel').textContent = MODES[mode];
        $('matchClock').textContent = mode === 'blitz' ? clock(120000 - elapsed) : mode === 'sprint' ? `${Math.min(lines,40)}/40 · ${clock(elapsed)}` : mode === 'practice' ? 'No rush' : clock(elapsed);
    }
    function resume() {
        if (!active || gameOver) return;
        closeMenu();
        if (window.onlinePlay?.active) { window.onlinePlay.resumeView(); return; }
        $('hubScreen').classList.add('hidden');
        authScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        if (paused) togglePause();
        lastTime = performance.now();
        window.scrollTo({ top:0, behavior:'instant' });
    }
    function start(selected) {
        if (window.onlinePlay?.active) { window.onlinePlay.noRestart(); return; }
        if (!MODES[selected]) return;
        if (selected !== 'versus') window.onlinePlay?.cancelWaiting();
        if (active && !recorded) record('abandoned');
        mode = selected;
        $('playAgain').textContent = 'Play again';
        if (selected !== 'versus') {
            document.getElementById('opponentCard').classList.add('hidden');
            document.getElementById('leaveOnlineMatch').classList.add('hidden');
            document.getElementById('menuRestart').classList.remove('hidden');
            document.getElementById('matchMenu').querySelector('p').textContent = 'Your game is paused.';
        }
        closeMenu();
        $('hubScreen').classList.add('hidden');
        authScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        resetGame();
        active = true;
        updateClock();
        applySettings();
        unlockAudio();
        window.scrollTo({ top:0, behavior:'instant' });
    }
    function record(reason) {
        if (recorded || !active || !profile) return null;
        recorded = true;
        const match = { playerId, mode, score, lines, level, duration:Math.round(elapsed), at:Date.now(), success:reason === 'goal' || reason === 'time' || reason === 'online-win', abandoned:reason === 'abandoned' };
        progress.matches.push(match);
        save('tetrisPinasProgress', progress);
        return match;
    }
    function finish(reason) {
        if (!active || recorded) return;
        const previous = ownMatches().filter(m => m.mode === mode && !m.abandoned && (mode !== 'sprint' || m.success));
        const match = record(reason);
        gameOver = true;
        active = false;
        cue('finish');
        $('resultMode').textContent = MODES[mode];
        $('resultTitle').textContent = reason === 'goal' ? '40 lines. One great run!' : reason === 'time' ? "Time's up!" : mode === 'practice' ? 'Practice complete' : 'Nice game!';
        $('resultDescription').textContent = reason === 'topout' ? 'The stack reached the top. Your next run is a fresh start.' : 'Your result has been added to your match history.';
        $('resultStats').innerHTML = `<div><span>SCORE</span><strong>${number(score)}</strong></div><div><span>LINES</span><strong>${number(lines)}</strong></div><div><span>TIME</span><strong>${clock(elapsed)}</strong></div>`;
        const isBest = mode !== 'practice' && mode !== 'versus' && (mode !== 'sprint' || match.success) && (!previous.length || (mode === 'sprint' ? elapsed < Math.min(...previous.map(m => m.duration)) : score > Math.max(...previous.map(m => m.score))));
        $('resultRecord').textContent = isBest ? '★ New personal best!' : mode === 'practice' ? 'Practice progress is saved. This mode is not ranked.' : 'Keep playing to beat your personal best.';
        $('leaderboardMode').value = mode === 'practice' || mode === 'versus' ? 'marathon' : mode;
        go('results');
        if (mode === 'versus') {
            $('resultTitle').textContent = reason === 'online-win' ? 'You won!' : reason === 'online-draw' ? 'Match ended' : 'Good game!';
            $('resultDescription').textContent = window.onlinePlay?.resultDescription || 'Online versus match complete.';
            $('resultRecord').textContent = 'This online result is saved to your local match history.';
        }
    }
    function tick(delta) {
        if (!active || paused || gameOver) return;
        elapsed += delta;
        updateClock();
        if (mode === 'blitz' && elapsed >= 120000) { elapsed = 120000; finish('time'); }
    }
    function checkGoal() {
        if (active && mode === 'sprint' && lines >= 40) { finish('goal'); return true; }
        return false;
    }
    function unlockAudio() {
        if (!settings.sound) return;
        try { const Audio = window.AudioContext || window.webkitAudioContext; if (!audio && Audio) audio = new Audio(); if (audio?.state === 'suspended') audio.resume().catch(() => {}); } catch { /* Sound is optional. */ }
    }
    function cue(kind) {
        if (settings.vibration && navigator.vibrate) navigator.vibrate(kind === 'finish' ? [40,30,40] : 15);
        if (!settings.sound || !audio || audio.state !== 'running') return;
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = kind === 'finish' ? 660 : 220;
        gain.gain.setValueAtTime(.05, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .12);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.start(); oscillator.stop(audio.currentTime + .13);
    }
    function openMenu() {
        if (!active || gameOver) { go('home'); return; }
        if (!paused) togglePause();
        if (!$('matchMenu').open) $('matchMenu').showModal();
    }
    function closeMenu() { if ($('matchMenu').open) $('matchMenu').close(); }
    document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); go(button.dataset.page); }));
    document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => start(button.dataset.mode)));
    document.querySelectorAll('[data-game-page]').forEach(button => button.addEventListener('click', () => go(button.dataset.gamePage)));
    $('profileForm').addEventListener('submit', event => {
        event.preventDefault();
        const name = $('profileName').value.trim();
        if (!name) { $('profileName').setCustomValidity('Enter a display name.'); $('profileName').reportValidity(); return; }
        profile.name = name.slice(0,24);
        profile.avatar = avatars.includes($('profileIcon').value) ? $('profileIcon').value : '★';
        save('tetrisPinasProgress', progress);
        $('accountName').textContent = profile.name;
        $('accountAvatar').textContent = profile.avatar;
        renderProfile();
        if (storageAvailable) notice('Profile saved.');
    });
    $('profileName').addEventListener('input', () => $('profileName').setCustomValidity(''));
    $('settingsForm').addEventListener('submit', event => {
        event.preventDefault();
        ['Ghost','Effects','Sound','Vibration','Buttons','Hints'].forEach(label => { settings[label.toLowerCase()] = $('setting' + label).checked; });
        settings.theme = $('settingTheme').value;
        save('tetrisPinasSettings', settings);
        applySettings(); unlockAudio();
        if (storageAvailable) notice('Settings saved.');
    });
    $('leaderboardMode').addEventListener('change', renderLeaderboard);
    $('resumeMatch').addEventListener('click', resume);
    $('playAgain').addEventListener('click', () => mode === 'versus' ? go('online') : start(mode));
    $('openMatchMenu').addEventListener('click', openMenu);
    $('menuResume').addEventListener('click', resume);
    $('menuRestart').addEventListener('click', () => start(mode));
    $('matchMenu').addEventListener('cancel', event => { event.preventDefault(); resume(); });
    $('signOutButton').addEventListener('click', async () => {
        if (window.onlinePlay?.active) { window.onlinePlay.openMenu(); return; }
        try { if (firebaseReady && firebase.auth().currentUser) await firebase.auth().signOut(); }
        catch { notice('Could not sign out. Please try again.'); return; }
        if (active && !recorded) record('abandoned');
        active = false; paused = true;
        window.tetrisGuestSession = false;
        $('hubScreen').classList.add('hidden');
        authForm.reset(); setAuthMode('login'); showAuthScreen();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && active && !paused && !gameOver && !window.onlinePlay?.active) togglePause(); });
    document.addEventListener('keydown', event => {
        if (event.code === 'Escape' && !gameScreen.classList.contains('hidden') && !$('matchMenu').open) { event.preventDefault(); openMenu(); }
    });
    window.tetrisApp = { enter, tick, checkGoal, finish, cue, onReset, start, go, resume, onlineTime(milliseconds) { elapsed = Math.max(0, milliseconds); }, get mode() { return mode; }, settings };
    applySettings();
})();
