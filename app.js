/* Navigation, local player progress, settings, and match lifecycle. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const MODES = { marathon: 'Marathon', sprint: '40-line Sprint', blitz: 'Blitz', practice: 'Practice', versus: 'Online Versus' };
    const defaults = { ghost: true, ghostOutlineVersion: 1, grid: true, effects: true, sound: true, audioVersion: 2, vibration: false, buttons: false, hints: true, practiceHints: false, practiceGravity: false, practiceSpeed: 1000, das: 150, arr: 30, softDropFactor: 20, musicVolume: 70, soundVolume: 75, controls: {}, theme: 'fiesta' };
    const avatars = ['default', '★', '🦅', '☀', '🌺', '⚡'];
    let storageAvailable = true;
    function read(key, fallback) {
        try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
        catch { return fallback; }
    }
    function save(key, value) {
        if (playerId === "guest" && (key === "tetrisPinasProgress" || key.startsWith("tetrisPinasMarathon:") || key.startsWith("tetrisPinasOnlineXp:"))) return;
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
    // Enable the new landing outline once, including for existing saved settings.
    if (storedSettings.ghostOutlineVersion !== 1) {
        settings.ghost = true;
        try { localStorage.setItem('tetrisPinasSettings', JSON.stringify(settings)); } catch {}
    }
    if (!['fiesta', 'night'].includes(settings.theme)) settings.theme = 'fiesta';
    let playerId = 'guest';
    let profile;
    let mode = 'marathon';
    let elapsed = 0;
    let active = false;
    let recorded = false;
    let currentPage = 'home';
    let audio;
    let audioMaster;
    let noiseBuffer;
    const audioSources = new Set();
    function stopAudioSources() {
        for (const source of audioSources) { try { source.stop(); } catch {} }
        audioSources.clear();
        musicBeat = -1;
    }
    let musicBeat = -1;
    let sessionSaveElapsed = 0;
    let pendingOnlineAward = null;
    let noticeTimer;
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
    const avatarHTML = avatar => !avatar || avatar === 'default' ? '<img class="profile-photo" src="Assets/dashboard/default-profile-transparent.png" alt="">' : escape(avatar);
    const number = value => Number(value || 0).toLocaleString();
    const clock = ms => {
        const seconds = Math.max(0, Math.floor(ms / 1000));
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    };
    const preciseClock = ms => `${clock(ms)}.${String(Math.max(0,Math.floor(ms))%1000).padStart(3,'0')}`;
    const sessionKey = id => `tetrisPinasMarathon:${id}`;
    const date = timestamp => new Date(timestamp).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
    function notice(message) {
        $('hubNotice').textContent = message;
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => { $('hubNotice').textContent = ''; }, 4000);
    }
    function ownMatches() { return playerId === "guest" ? [] : progress.matches.filter(match => match.playerId === playerId); }
    function totals() {
        const matches = ownMatches();
        return { games: matches.length, lines: matches.reduce((sum, m) => sum + m.lines, 0), best: Math.max(0, ...matches.filter(m => m.mode !== 'practice').map(m => m.score)), time: matches.reduce((sum, m) => sum + m.duration, 0) };
    }
    function historyHTML(matches) {
        if (!matches.length) return '<p class="empty-state">Your story starts with your first game. Choose a mode to begin.</p>';
        return matches.slice().reverse().slice(0, 15).map(m => `<article class="history-row"><span class="history-dot">${m.success ? '★' : '◆'}</span><div><strong>${escape(MODES[m.mode] || m.mode)}</strong><small>${escape(date(m.at))} · ${m.lines} lines · ${clock(m.duration)}${m.abandoned ? ' · Ended early' : ''}</small></div><b>${m.mode==='sprint'&&m.success?preciseClock(m.duration):number(m.score)}<small>${m.mode==='sprint'&&m.success?'time':'points'}</small></b></article>`).join('');
    }
    function renderHome() {
        const stats = totals();
        $('welcomeTitle').textContent = playerId === "guest" ? "Tara, laro tayo!" : `Tara, ${profile.name}!`;
        if (playerId !== "guest") window.friendsPanel?.start(profile.name, playerId);
        else window.friendsPanel?.stop();
        const xp = Math.max(0,Number(profile.xp)||0);
        const milestone = stats.best % 2000;
        $('playerXP').value = xp % 2000;
        $('playerLevel').textContent = `Lv. ${1 + Math.floor(xp / 2000)}`;
        $('playerXPLabel').textContent = `${number(xp % 2000)} / 2,000 XP`;
        $('milestoneProgress').value = milestone;
        $('milestoneRemaining').textContent = `${number(2000 - milestone)} points`;
        const unfinished = playerId !== "guest" && active && !gameOver;
        const recentMatches = ownMatches().slice(-3);
        $('homeHistory').innerHTML = unfinished && !recentMatches.length ? '' : (playerId === 'guest' ? '<p class="empty-state">Log in or sign up to save progress and see your recent games.</p>' : historyHTML(recentMatches));
        $('unfinishedMatch').classList.toggle('hidden', !unfinished);
        $('unfinishedMode').textContent = MODES[mode];
        $('unfinishedDetails').textContent = `Unfinished ? ${number(score)} points ? ${clock(elapsed)}`;
        $('resumeMatch').setAttribute('aria-label', `Resume unfinished ${MODES[mode]} game`);
    }
    function updateModeInfo() {
        const matches=ownMatches().filter(m=>m.mode===mode&&!m.abandoned);
        const bestScore=Math.max(0,...matches.map(m=>m.score));
        const bestSprint=matches.filter(m=>m.success).reduce((best,m)=>Math.min(best,m.duration),Infinity);
        const info=mode==='marathon' ? `BEST ${number(bestScore)} · NEXT LEVEL ${lines%10}/10` :
            mode==='sprint' ? `GOAL ${Math.min(lines,40)}/40 · BEST ${Number.isFinite(bestSprint)?preciseClock(bestSprint):'—'}` :
            mode==='blitz' ? `BEST ${number(bestScore)} · ${clock(120000-elapsed)} LEFT` :
            mode==='practice' ? 'NO TIMER · PLACE PIECES AT YOUR PACE' : 'RACE TO 40 LINES';
        $('gameModeInfo').textContent=info;
        $('gameLevelProgress').value=lines%10;
        $('gameLevelProgress').classList.toggle('hidden',mode!=='marathon'&&mode!=='blitz');
    }
    function saveSession() {
        if (playerId !== 'guest' && mode==='marathon' && active && !recorded && !gameOver && playerId) save(sessionKey(playerId),{engine:window.tetrisSession.snapshot(),elapsed});
    }
    function clearSession() {
        if (playerId === "guest") return;
        try { localStorage.removeItem?.(sessionKey(playerId)); }
        catch { /* Local storage may be unavailable. */ }
    }
    function renderProfile() {
        const stats = totals();
        $('profileAvatar').innerHTML = avatarHTML(profile.avatar);
        $('profileTitle').textContent = profile.name;
        $('profileAccount').textContent = playerId === 'guest' ? 'Guest player · progress on this browser' : 'Signed-in player · progress on this browser';
        $('profileJoined').textContent = `Playing since ${date(profile.joined)}`;
        $('profileName').value = profile.name;
        $('profileIcon').value = profile.avatar;
        $('profileStats').innerHTML = `<div><span>GAMES</span><strong>${number(stats.games)}</strong></div><div><span>BEST SCORE</span><strong>${number(stats.best)}</strong></div><div><span>XP</span><strong>${number(profile.xp || 0)}</strong></div>`;
        const milestones = [ ['First flight', 'Finish your first game', stats.games >= 1], ['Line maker', 'Clear 10 lines in total', stats.lines >= 10], ['Fiesta scorer', 'Reach 5,000 points in a ranked mode', stats.best >= 5000], ['Sprint finisher', 'Complete a 40-line Sprint', ownMatches().some(m => m.mode === 'sprint' && m.success)] ];
        $('achievements').innerHTML = milestones.map(([title, detail, earned]) => `<article class="achievement ${earned ? 'earned' : ''}"><span>${earned ? '★' : '○'}</span><strong>${title}</strong><small>${detail}</small><b>${earned ? 'Earned' : 'In progress'}</b></article>`).join('');
        $('profileHistory').innerHTML = historyHTML(ownMatches());
    }
    function renderLeaderboard() {
        const selected = $('leaderboardMode').value;
        const completed = progress.matches.filter(m => m.playerId !== "guest" && m.mode === selected && !m.abandoned);
        const qualifying = completed.filter(m => selected !== 'sprint' || m.success);
        const bestByPlayer = new Map();
        qualifying.forEach(m => {
            const previous = bestByPlayer.get(m.playerId);
            if (!previous || (selected === 'sprint' ? m.duration < previous.duration : m.score > previous.score)) bestByPlayer.set(m.playerId, m);
        });
        const ranked = [...bestByPlayer.values()].sort((a, b) => selected === 'sprint' ? a.duration - b.duration : b.score - a.score);
        const totalsByPlayer = new Map();
        completed.forEach(m => {
            const totals = totalsByPlayer.get(m.playerId) || { matches:0, points:0 };
            totals.matches++;
            totals.points += Math.max(0, Number(m.score) || 0);
            totalsByPlayer.set(m.playerId, totals);
        });
        const resultLabel = selected === 'sprint' ? 'Best time' : 'Best score';
        const resultValue = m => selected === 'sprint' ? preciseClock(m.duration) : number(m.score);
        const leaderResult = ranked[0];
        const rating = m => {
            if (!leaderResult) return 0;
            if (m === leaderResult || (selected !== 'sprint' && Number(leaderResult.score) <= 0)) return 100;
            const ratio = selected === 'sprint'
                ? Number(leaderResult.duration) / Math.max(1, Number(m.duration))
                : Number(m.score) / Math.max(1, Number(leaderResult.score));
            return Math.max(1, Math.min(100, Math.round(ratio * 100)));
        };
        const icon = name => {
            const paths = {
                profile:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3Z"/>',
                crown:'<path d="m3 6 5 5 4-8 4 8 5-5-2 14H5Z"/>',
                star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
                gamepad:'<path d="M7 6h10l4 12h-4l-3-4h-4l-3 4H3Z"/><path d="M7 8v5m-2-2h5m6-1h1" fill="none" stroke="#4a2309" stroke-width="2"/>',
                trophy:'<path d="M7 3h10v7a5 5 0 0 1-10 0Zm3 12h4v4h4v3H6v-3h4Z"/><path d="M7 5H3v3a5 5 0 0 0 5 5m9-8h4v3a5 5 0 0 1-5 5" fill="none" stroke="currentColor" stroke-width="2"/>'
            };
            return '<svg class="leaderboard-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">'+paths[name]+'</svg>';
        };
        const podium = [1, 0, 2].map(i => {
            const m = ranked[i];
            if (!m) return `<article class="leaderboard-podium-card rank-${i + 1} is-empty" aria-label="Rank ${i + 1} is open"><span class="leaderboard-podium-medal">${i + 1}</span><span class="leaderboard-podium-avatar" aria-hidden="true">${icon("profile")}</span><strong>Anonymous</strong><small class="placeholder-score">No games yet</small></article>`;
            const p = progress.profiles[m.playerId] || { name:'Player', avatar:'★' };
            return `<article class="leaderboard-podium-card rank-${i + 1} ${m.playerId === playerId ? 'is-you' : ''}"><span class="leaderboard-podium-medal">${i + 1}</span><span class="leaderboard-podium-avatar" aria-hidden="true">${avatarHTML(p.avatar)}</span><strong>${escape(p.name)}${m.playerId === playerId ? ' · You' : ''}</strong><small>${resultValue(m)} <span>· ${rating(m)} rating</span></small></article>`;
        }).join('');
        const rows = ranked.map((m, i) => {
            const p = progress.profiles[m.playerId] || { name:'Player', avatar:'★' };
            const totals = totalsByPlayer.get(m.playerId);
            return `<tr class="${m.playerId === playerId ? 'is-you' : ''}"><td class="rank"><span class="rank-crown" aria-hidden="true">${i<3?icon("crown"):""}</span>${String(i + 1).padStart(2, '0')}</td><td><span class="leaderboard-player"><span class="leaderboard-player-avatar" aria-hidden="true">${avatarHTML(p.avatar)}</span><span class="leaderboard-player-details"><strong>${escape(p.name)}${m.playerId === playerId ? ' · You' : ''}</strong><small>${resultLabel}: ${resultValue(m)}</small></span></span></td><td class="number rating">${rating(m)}<span class="rating-suffix"> / 100</span></td><td class="number secondary-stat">${number(totals.matches)}</td><td class="number secondary-stat points">${number(totals.points)}</td></tr>`;
        }).join('');
        $('leaderboardList').innerHTML = `<div class="leaderboard-top-three" aria-label="Top three players">${podium}</div><div class="leaderboard-table-wrap"><table class="leaderboard-table"><thead><tr><th scope="col">Rank</th><th scope="col">Player name</th><th scope="col" title="Best result compared with the current leader">${icon("star")} Rating</th><th class="secondary-stat" scope="col">${icon("gamepad")} Matches</th><th class="secondary-stat" scope="col">${icon("trophy")} Points</th></tr></thead><tbody>${rows || [1,2,3].map(rank => `<tr class="is-placeholder"><td class="rank">${String(rank).padStart(2,"0")}</td><td><span class="leaderboard-player"><span class="leaderboard-player-avatar">${icon("profile")}</span><strong>Anonymous</strong></span></td><td class="number">&mdash;</td><td class="number secondary-stat">&mdash;</td><td class="number secondary-stat">&mdash;</td></tr>`).join("")}</tbody></table></div>`;
    }
    function applySettings() {
        document.body.dataset.theme = settings.theme;
        // Old saved preferences must not restore the removed controls.
        settings.buttons = false;
        settings.hints = false;
        settings.practiceHints = false;
        settings.theme = 'fiesta';
        document.body.dataset.theme = 'fiesta';
        gameScreen.classList.remove('with-buttons');
    }
    function renderGuide() {
        const label = code => ({ArrowLeft:'Left',ArrowRight:'Right',ArrowUp:'Up',ArrowDown:'Down',Space:'Space',ShiftLeft:'Shift',ShiftRight:'Shift'}[code] || code.replace(/^Key/,''));
        const binding = (name, fallback) => label(settings.controls[name] || fallback);
        $('guideKey-leftRight').textContent = binding('left','ArrowLeft')+' / '+binding('right','ArrowRight');
        $('guideKey-rotateCW').textContent = [...new Set([binding('rotateCW','ArrowUp'),'X'])].join(' / ');
        $('guideKey-rotateCCW').textContent = binding('rotateCCW','KeyZ');
        $('guideKey-softDrop').textContent = binding('softDrop','ArrowDown');
        $('guideKey-hardDrop').textContent = binding('hardDrop','Space');
        $('guideKey-hold').textContent = binding('hold','KeyC')+' / Shift';
    }
    function renderSettings() {
        ['Ghost','Grid','Effects','Sound','Vibration','PracticeGravity'].forEach(label => { $('setting' + label).checked = settings[label.charAt(0).toLowerCase()+label.slice(1)]; });
        $('vibrationSetting').classList.toggle('hidden', typeof navigator.vibrate !== 'function');
        $('toggleFullscreen').classList.toggle('hidden', !document.documentElement?.requestFullscreen && !document.fullscreenElement);
        for (const name of ['MusicVolume','SoundVolume']) $('setting'+name+'Value').textContent = settings[name.charAt(0).toLowerCase()+name.slice(1)] + '%';
        $('settingsSaveStatus').textContent = 'Changes save automatically.';
        for (const name of ['PracticeSpeed','Das','Arr','SoftDropFactor','MusicVolume','SoundVolume']) $('setting'+name).value=settings[name.charAt(0).toLowerCase()+name.slice(1)];
        for (const name of ['Left','Right','SoftDrop','HardDrop','RotateCW','RotateCCW','Hold']) {
            const key=name.charAt(0).toLowerCase()+name.slice(1);
            $('control'+name).value=settings.controls[key]||{left:'ArrowLeft',right:'ArrowRight',softDrop:'ArrowDown',hardDrop:'Space',rotateCW:'ArrowUp',rotateCCW:'KeyZ',hold:'KeyC'}[key];
        }
    }
    function go(page) {
        if (window.onlinePlay?.active) { window.onlinePlay.openMenu(); return; }
        if (page !== 'online') window.onlinePlay?.cancelWaiting();
        if (page === 'profile' && playerId === 'guest') { openAuth(); return; }
        if (!$('page-' + page)) page = 'home';
        if (active && !gameOver && !paused) togglePause();
        closeMenu();
        authScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        $('hubScreen').classList.remove('hidden');
        document.querySelectorAll('.hub-page').forEach(section => section.classList.toggle('hidden', section.id !== 'page-' + page));
        document.querySelectorAll('.hub-nav [data-page], #accountButton').forEach(button => {
            const selected = button.dataset.page === page;
            button.classList.toggle('active', selected);
            if (selected) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
        });
        currentPage = page;
        if (page === 'home') renderHome();
        if (page === 'profile') renderProfile();
        if (page === 'leaderboard') renderLeaderboard();
        if (page === 'settings') renderSettings();
        if (page === 'guide') renderGuide();
        if (page === 'online') window.onlinePlay?.connect();
        window.scrollTo({ top:0, behavior:'instant' });
        const heading = $('page-' + page).querySelector('h1');
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll:true }); }
    }
    function enter() {
        const user = window.tetrisServerUser || (firebaseReady && !window.tetrisGuestSession ? firebase.auth().currentUser : null);
        active = false; recorded = false; paused = true;
        playerId = user ? user.uid : 'guest';
        if (user?.id) playerId=user.id;
        profile = user ? progress.profiles[playerId] : null;
        if (!profile) {
            profile = { name: user ? (user.name || user.displayName || user.email?.split('@')[0] || 'Player') : 'Visitor', avatar:'default', joined:Date.now() };
            if (user) progress.profiles[playerId] = profile;
            save('tetrisPinasProgress', progress);
        }
        if (!avatars.includes(profile.avatar)) profile.avatar = '★';
        profile.xp = Math.max(0,Number(profile.xp)||0);
        $('accountName').textContent = playerId === 'guest' ? 'Log In / Sign Up' : profile.name;
        $('accountAvatar').innerHTML = avatarHTML(profile.avatar);
        $('accountButton').classList.toggle('is-visitor', !user);
        $('accountButton').setAttribute('aria-label', user ? 'Open profile' : 'Log in or sign up');
        $('accountSubtitle').textContent = user ? 'Player' : 'Save your progress';
        $('sidebarPlayerLevel').classList.toggle('hidden', !user);
        const saved=user ? read(sessionKey(playerId),null) : null;
        if (saved?.engine && window.tetrisSession.restore(saved.engine)) {
            mode='marathon';
            elapsed=Math.max(0,Number(saved.elapsed)||0);
            active=true;recorded=false;
            updateClock();
        }
        go(new URLSearchParams(window.location?.search || '').has('room') ? 'online' : 'home');
    }
    function onReset() {
        if (active && !recorded) record("abandoned");
        clearSession();
        elapsed = 0;
        musicBeat = -1;
        sessionSaveElapsed = 0;
        recorded = false;
        active = !gameScreen.classList.contains('hidden');
        updateClock();
    }
    function updateClock() {
        $('matchModeLabel').textContent = MODES[mode];
        $('matchClock').textContent = mode === 'blitz' ? clock(120000 - elapsed) : mode === 'sprint' ? `${Math.min(lines,40)}/40 · ${preciseClock(elapsed)}` : mode === 'practice' ? 'No rush' : clock(elapsed);
        if (profile) updateModeInfo();
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
        pendingOnlineAward = null;
        $('playAgain').textContent = 'Play again';
        if (selected !== 'versus') {
            gameScreen.classList.remove('is-online');
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
        saveSession();
        updateClock();
        applySettings();
        unlockAudio();
        window.scrollTo({ top:0, behavior:'instant' });
    }
    function record(reason) {
        if (recorded || !active || !profile) return null;
        recorded = true;
        const match = { playerId, mode, score, lines, level, duration:Math.round(elapsed), at:Date.now(), success:reason === 'goal' || reason === 'time' || reason === 'online-win', abandoned:reason === 'abandoned' };
        if (playerId !== "guest") progress.matches.push(match);
        save('tetrisPinasProgress', progress);
        return match;
    }
    function finish(reason) {
        if (!active || recorded) return;
        const previous = ownMatches().filter(m => m.mode === mode && !m.abandoned && (mode !== 'sprint' || m.success));
        const match = record(reason);
        gameOver = true;
        active = false;
        clearSession();
        cue('finish');
        $('resultMode').textContent = MODES[mode];
        $('resultTitle').textContent = reason === 'goal' ? '40 lines. One great run!' : reason === 'time' ? "Time's up!" : mode === 'practice' ? 'Practice complete' : 'Nice game!';
        $('resultDescription').textContent = reason === 'topout' ? 'The stack reached the top. Your next run is a fresh start.' : 'Your result has been added to your match history.';
        const previousBestScore=Math.max(0,...previous.map(m=>m.score));
        const previousBestTime=previous.filter(m=>m.success).reduce((best,m)=>Math.min(best,m.duration),Infinity);
        $('resultStats').innerHTML = mode==='sprint' ? `<div><span>TIME</span><strong>${preciseClock(elapsed)}</strong></div><div><span>LINES</span><strong>${number(lines)}</strong></div><div><span>PERSONAL BEST</span><strong>${Number.isFinite(previousBestTime)?preciseClock(match.success?Math.min(previousBestTime,elapsed):previousBestTime):match.success?preciseClock(elapsed):'—'}</strong></div>` : mode==='blitz' ? `<div><span>SCORE</span><strong>${number(score)}</strong></div><div><span>LINES</span><strong>${number(lines)}</strong></div><div><span>BEST SCORE</span><strong>${number(Math.max(previousBestScore,score))}</strong></div>` : `<div><span>SCORE</span><strong>${number(score)}</strong></div><div><span>LINES</span><strong>${number(lines)}</strong></div><div><span>LEVEL REACHED</span><strong>${number(level)}</strong></div>`;
        const isBest = mode !== 'practice' && mode !== 'versus' && (mode !== 'sprint' || match.success) && (!previous.length || (mode === 'sprint' ? elapsed < Math.min(...previous.map(m => m.duration)) : score > Math.max(...previous.map(m => m.score))));
        const eligible=playerId !== 'guest' && mode!=='practice' && mode!=='versus' && reason!=='abandoned' && (mode!=='sprint'||match.success) && (mode!=='marathon'&&mode!=='blitz'||elapsed>=30000||lines>0);
        const reward=mode==='sprint' ? (match.success?75:0) : 50;
        profile.xpAwards=(Array.isArray(profile.xpAwards)?profile.xpAwards:[]).filter(entry=>Date.now()-entry.at<86400000);
        if (eligible && profile.xpAwards.length<20 && !profile.xpAwards.some(entry=>entry.mode===mode&&Date.now()-entry.at<60000)) {
            profile.xp += reward + (isBest?25:0);
            profile.xpAwards.push({mode,at:Date.now()});
            save('tetrisPinasProgress',progress);
        }
        if (playerId !== 'guest' && mode==='versus' && pendingOnlineAward?.amount>0) {
            const receiptKey=`tetrisPinasOnlineXp:${playerId}`;
            const receipts=read(receiptKey,[]);
            if (Array.isArray(receipts) && !receipts.includes(pendingOnlineAward.room)) {
                profile.xp+=pendingOnlineAward.amount;
                save(receiptKey,[...receipts.slice(-49),pendingOnlineAward.room]);
                save('tetrisPinasProgress',progress);
            }
        }
        pendingOnlineAward=null;
        $('resultRecord').textContent = isBest ? `★ New personal best!${mode==='marathon'?` Previous best: ${number(previousBestScore)} points.`:''}` : mode === 'practice' ? 'Practice progress is saved. This mode is not ranked.' : mode==='sprint'&&Number.isFinite(previousBestTime) ? `Personal best: ${preciseClock(previousBestTime)}` : `Previous best: ${number(previousBestScore)} points.`;
        $('leaderboardMode').value = mode === 'practice' || mode === 'versus' ? 'marathon' : mode;
        if (playerId === 'guest') {
            $('resultDescription').textContent = 'This game was not saved. Log in or sign up to keep future progress and history.';
            $('resultRecord').textContent = 'Playing without an account';
        }
        go('results');
        if (mode === 'versus' && playerId !== 'guest') {
            $('resultTitle').textContent = reason === 'online-win' ? 'You won!' : reason === 'online-draw' ? 'Match ended' : 'Good game!';
            $('resultDescription').textContent = window.onlinePlay?.resultDescription || 'Online versus match complete.';
            $('resultRecord').textContent = 'This online result is saved to your local match history.';
        }
    }
    function tick(delta) {
        if (!active || paused || gameOver) return;
        elapsed = mode==='blitz' ? Math.min(120000,elapsed+delta) : elapsed+delta;
        if (mode==='marathon') { sessionSaveElapsed+=delta; if (sessionSaveElapsed>=1000) {sessionSaveElapsed=0;saveSession();} }
        updateClock();
        if (mode === 'blitz' && elapsed >= 120000) { elapsed = 120000; finish('time'); }
    }
    function checkGoal() {
        if (active && mode === 'sprint' && lines >= 40) { finish('goal'); return true; }
        return false;
    }
    function unlockAudio() {
        if (!settings.sound && settings.musicVolume<=0) return;
        try { const Audio = window.AudioContext || window.webkitAudioContext; if (!audio && Audio) audio = new Audio(); if (audio?.state === 'suspended') audio.resume().catch(() => {}); } catch { /* Sound is optional. */ }
    }
    function audioOutput() {
        if (!audioMaster) {
            // Keep overlapping drums and gameplay impacts from clipping.
            audioMaster = audio.createDynamicsCompressor();
            audioMaster.threshold.value = -12;
            audioMaster.knee.value = 12;
            audioMaster.ratio.value = 4;
            audioMaster.attack.value = .003;
            audioMaster.release.value = .12;
            const output = audio.createGain();
            output.gain.value = 1.45;
            audioMaster.connect(output); output.connect(audio.destination);
        }
        return audioMaster;
    }
    function noise(duration, volume, cutoff = 1500, endCutoff = cutoff, delay = 0, highpass = false) {
        if (!audio || audio.state !== 'running' || volume <= 0) return;
        if (!noiseBuffer) {
            noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        }
        const time = audio.currentTime + delay;
        const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
        source.buffer = noiseBuffer;
        filter.type = highpass ? 'highpass' : 'lowpass';
        filter.Q.value = .8;
        filter.frequency.setValueAtTime(cutoff, time);
        filter.frequency.exponentialRampToValueAtTime(endCutoff, time + duration);
        gain.gain.setValueAtTime(.0001, time);
        gain.gain.linearRampToValueAtTime(volume, time + .003);
        gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
        source.connect(filter); filter.connect(gain); gain.connect(audioOutput());
        audioSources.add(source);
        source.onended = () => { audioSources.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
        source.start(time); source.stop(time + duration + .01);
    }
    // Short synthesized voices need no downloads and stay within the volume controls.
    function voice(frequency, duration, volume, type = 'triangle', delay = 0, endFrequency = frequency) {
        if (!audio || audio.state !== 'running' || volume <= 0) return;
        const time = audio.currentTime + delay;
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, time);
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
        gain.gain.setValueAtTime(.0001, time);
        gain.gain.linearRampToValueAtTime(volume, time + .006);
        gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
        oscillator.connect(gain); gain.connect(audioOutput());
        audioSources.add(oscillator);
        oscillator.onended = () => { audioSources.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(time); oscillator.stop(time + duration + .01);
    }
    function musicTick() {
        if (!active || paused || gameOver || document.hidden || gameScreen.classList.contains('hidden') || settings.musicVolume <= 0 || audio?.state !== 'running') return;
        // 174 BPM, sixteen steps per bar; a complete 16-bar build/drop arrangement.
        const beat = Math.floor(elapsed / (60000 / 174 / 4));
        if (beat === musicBeat) return;
        musicBeat = beat;
        const step = beat % 16, bar = Math.floor(beat / 16) % 16;
        const build = bar >= 12;
        const hz = note => 440 * Math.pow(2, (note - 69) / 12);
        const volume = Math.max(0, Math.min(100, settings.musicVolume)) / 100;
        const root = [33,29,36,31][Math.floor(bar / 2) % 4];
        // Heavy syncopated sub-bass and a detuned, growling mid-bass layer.
        if ([0,3,6,8,10,14].includes(step) && !(build && step % 2)) {
            const pitch = hz(root + (step === 14 ? 12 : 0));
            voice(pitch, .22, volume * .30, 'sine');
            voice(pitch * 2, .14, volume * .13, 'sawtooth', 0, pitch * 1.94);
            voice(pitch * 2.015, .14, volume * .08, 'square');
        }
        // Wide power-chord stabs make the drop feel much larger than a single-note loop.
        if (step === 0 || step === 8) {
            [12,19,24].forEach(interval => {
                const pitch = hz(root + interval);
                voice(pitch * .995, .34, volume * .055, 'sawtooth');
                voice(pitch * 1.005, .34, volume * .055, 'sawtooth');
            });
        }
        const riff = [24,0,31,36,27,31,39,36,24,31,36,43,39,36,31,27];
        const note = riff[step];
        if (note && (bar % 4 < 3 || step % 2 === 0)) {
            const pitch = hz(root + note);
            voice(pitch, .12, volume * .085, 'sawtooth');
            voice(pitch * 1.008, .16, volume * .045, 'square');
            voice(pitch, .15, volume * .025, 'triangle', .12);
        }
        // Actual noise-based snare, clap and cymbal textures, over a deep kick.
        if ([0,6,8,11].includes(step)) {
            voice(190, .22, volume * .48, 'sine', 0, 36);
            noise(.028, volume * .12, 4200, 700);
        }
        if (step === 4 || step === 12 || (bar % 4 === 3 && step >= 14)) {
            voice(205, .13, volume * .16, 'triangle', 0, 100);
            noise(.19, volume * .31, 6500, 1600);
            noise(.09, volume * .12, 3200, 1400, .025, true);
        }
        noise(step % 4 === 2 ? .12 : .035, volume * (step % 4 === 2 ? .095 : .055), 7500, 5500, 0, true);
        if (step === 0 && bar % 4 === 0) {
            noise(.7, volume * .20, 4500, 11000, 0, true);
            voice(95, .45, volume * .18, 'sawtooth', 0, 32);
        }
        if (build) {
            // Rising pitch and denser rolls lead into the next drop.
            if (step % (bar >= 14 ? 1 : 2) === 0) noise(.075, volume * .10, 2400, 7000);
            if (step === 0) voice(hz(60 + (bar - 12) * 4), .65, volume * .06, 'sawtooth', 0, hz(72 + (bar - 12) * 4));
        }
    }

    function cue(kind, count = 1) {
        if (settings.vibration && navigator.vibrate) navigator.vibrate(kind === 'finish' ? [40,30,40] : 15);
        unlockAudio();
        if (!settings.sound || !audio || audio.state !== 'running' || settings.soundVolume <= 0 || document.hidden) return;
        const volume = Math.max(0, Math.min(100, settings.soundVolume)) / 100;
        if (kind === 'lock') {
            voice(245, .20, volume * .48, 'sine', 0, 34);
            voice(1100, .06, volume * .16, 'sawtooth', 0, 110);
            noise(.095, volume * .24, 3600, 220);
        } else if (kind === 'clear') {
            noise(count >= 4 ? .5 : .24, volume * .28, 900, 10000);
            voice(180, .25, volume * .29, 'sawtooth', 0, 38);
            const notes = count >= 4 ? [523.25,659.25,783.99,1046.5,1318.51] : [523.25,659.25,783.99,1046.5].slice(0, Math.min(4, count + 2));
            notes.forEach((note, i) => voice(note, count >= 4 ? .32 : .20, volume * .22, 'square', i * .045, note * 1.025));
        } else if (kind === 'finish') {
            [523.25,659.25,783.99,1046.5].forEach((note, i) => voice(note, .38, volume * .14, 'square', i * .075));
        }
    }
    function openAuth() {
        if (active && !gameOver && !paused) togglePause();
        saveSession();
        closeMenu();
        window.friendsPanel?.stop();
        setAuthMode('login');
        authMessage.textContent = 'Log in or sign up to save your progress and game history.';
        showAuthScreen();
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
        if (playerId === "guest") { openAuth(); return; }
        const name = $('profileName').value.trim();
        if (!name) { $('profileName').setCustomValidity('Enter a display name.'); $('profileName').reportValidity(); return; }
        profile.name = name.slice(0,24);
        profile.avatar = avatars.includes($('profileIcon').value) ? $('profileIcon').value : '★';
        save('tetrisPinasProgress', progress);
        $('accountName').textContent = profile.name;
        $('accountAvatar').innerHTML = avatarHTML(profile.avatar);
        window.friendsPanel?.setName(profile.name);
        renderProfile();
        if (storageAvailable) notice('Profile saved.');
    });
    $('profileName').addEventListener('input', () => $('profileName').setCustomValidity(''));
    function saveSettingsFromForm() {
        const controls = {};
        for (const name of ['Left','Right','SoftDrop','HardDrop','RotateCW','RotateCCW','Hold']) controls[name.charAt(0).toLowerCase()+name.slice(1)] = $('control'+name).value;
        if (new Set(Object.values(controls)).size !== Object.keys(controls).length) {
            $('settingsSaveStatus').textContent = 'Choose a different key for each action.';
            notice('Choose a different key for each action.');
            return false;
        }
        const previousGravity = settings.practiceGravity, previousSpeed = settings.practiceSpeed;
        for (const name of ['Ghost','Grid','Effects','Sound','Vibration','PracticeGravity']) settings[name.charAt(0).toLowerCase()+name.slice(1)] = $('setting'+name).checked;
        for (const [name,min,max] of [['PracticeSpeed',100,3000],['Das',50,500],['Arr',10,150],['SoftDropFactor',2,100],['MusicVolume',0,100],['SoundVolume',0,100]]) {
            const value = Number($('setting'+name).value);
            settings[name.charAt(0).toLowerCase()+name.slice(1)] = Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
            $('setting'+name).value = settings[name.charAt(0).toLowerCase()+name.slice(1)];
        }
        settings.controls = controls;
        settings.theme = 'fiesta';
        if (previousGravity !== settings.practiceGravity || previousSpeed !== settings.practiceSpeed) dropCounter = 0;
        if (!settings.effects) { effects = []; boardFlash = 0; }
        if (!settings.vibration) navigator.vibrate?.(0);
        stopAudioSources();
        save('tetrisPinasSettings', settings);
        applySettings(); unlockAudio();
        for (const name of ['MusicVolume','SoundVolume']) $('setting'+name+'Value').textContent = $('setting'+name).value + '%';
        $('settingsSaveStatus').textContent = storageAvailable ? 'Settings saved automatically.' : 'Applied for this session; browser storage is unavailable.';
        return true;
    }
    for (const name of ['Ghost','Grid','Effects','Sound','Vibration','PracticeGravity','PracticeSpeed','Das','Arr','SoftDropFactor']) $('setting'+name).addEventListener('change', saveSettingsFromForm);
    for (const name of ['Left','Right','SoftDrop','HardDrop','RotateCW','RotateCCW','Hold']) $('control'+name).addEventListener('change', saveSettingsFromForm);
    for (const name of ['MusicVolume','SoundVolume']) $('setting'+name).addEventListener('input', saveSettingsFromForm);
    $('settingsForm').addEventListener('submit', event => {
        event.preventDefault();
        if (saveSettingsFromForm() && storageAvailable) notice('Settings saved.');
    });
    $('toggleFullscreen').addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement?.requestFullscreen?.().catch?.(() => notice('Fullscreen is unavailable in this browser.'));
    });
    $('leaderboardMode').addEventListener('change', renderLeaderboard);
    $('resumeMatch').addEventListener('click', resume);
    $('playAgain').addEventListener('click', () => mode === 'versus' ? go('online') : start(mode));
    $('openMatchMenu').addEventListener('click', openMenu);
    $('menuResume').addEventListener('click', resume);
    $('menuRestart').addEventListener('click', () => { if (typeof window.confirm!=='function' || window.confirm('Restart this game? Your current run will end.')) start(mode); });
    $('matchMenu').addEventListener('cancel', event => { event.preventDefault(); resume(); });
    $('signOutButton').addEventListener('click', async () => {
        if (window.onlinePlay?.active) { window.onlinePlay.openMenu(); return; }
        try { if (window.tetrisServerUser) { await fetch('/api/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Tetris-Request':'1'},body:'{}'});window.tetrisServerUser=null; } else if (firebaseReady && firebase.auth().currentUser) await firebase.auth().signOut(); }
        catch { notice('Could not sign out. Please try again.'); return; }
        saveSession();
        active = false; paused = true;
        window.friendsPanel?.stop();
        window.tetrisGuestSession = false;
        $('hubScreen').classList.add('hidden');
        authForm.reset(); setAuthMode('login'); showAuthScreen();
    });
    document.addEventListener('pointerdown', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
    document.addEventListener('visibilitychange', () => { if (document.hidden && active && !paused && !gameOver && !window.onlinePlay?.active) togglePause(); });
    window.addEventListener?.('pagehide',saveSession);
    document.addEventListener('keydown', event => {
        if (event.code === 'Escape' && !gameScreen.classList.contains('hidden') && !$('matchMenu').open) { event.preventDefault(); openMenu(); }
    });
    window.tetrisApp = { enter, tick, musicTick, checkGoal, finish, cue, onReset, start, go, resume, saveSession, updateModeInfo, onlineXp(amount,room) { pendingOnlineAward={amount:Math.max(0,Math.min(125,Number(amount)||0)),room:String(room||'')}; }, onlineTime(milliseconds) { elapsed = Math.max(0, milliseconds); }, get mode() { return mode; }, settings };
    applySettings();
})();
