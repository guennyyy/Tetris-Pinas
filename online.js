/* Server-controlled two-player racing over same-origin HTTP and live events. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    let source;
    let connecting;
    let connected = false;
    let active = false;
    let self;
    let room;
    let startedRoom;
    let offset = 0;
    let actions = Promise.resolve();
    let pendingActions = 0;
    const handled = new Set();
    let resultDescription = '';
    const status = message => { $('onlineStatus').textContent = message; };
    const report = message => { $('onlineError').textContent = message; };
    async function request(endpoint, data) {
        const response = await fetch('/api/' + endpoint, data === undefined ? { credentials:'same-origin', cache:'no-store' } : {
            method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','X-Tetris-Request':'1'}, body:JSON.stringify(data)
        });
        let value;
        try { value = await response.json(); } catch { throw new Error('Online play is unavailable on this address. Open the multiplayer version of the game.'); }
        if (!response.ok) throw new Error(value.error || 'Could not connect. Please try again.');
        return value;
    }
    function controls() {
        const waiting = room && room.status !== 'finished';
        $('onlineChoices').classList.toggle('hidden', !!waiting);
        $('onlineLobby').classList.toggle('hidden', !waiting);
        ['createOnlineRoom','findOnlineMatch'].forEach(id => { $(id).disabled = !connected; });
        $('joinOnlineForm').querySelector('button').disabled = !connected;
        $('copyOnlineInvite').classList.toggle('hidden', room?.visibility !== 'private');
        $('onlineInviteCode').textContent = room?.visibility === 'private' ? room.code : '';
    }
    function applyState(state) {
        if (!state) return;
        board = state.board.map(row => row.slice());
        player = { ...state.player, matrix:state.player.matrix.map(row => row.slice()) };
        nextPiece = { ...state.next, matrix:state.next.matrix.map(row => row.slice()) };
        score = state.score; lines = state.lines; level = state.level;
        updateStats(); drawNextPiece();
    }
    function opponentPreview(opponent) {
        const card = $('opponentCard');
        card.classList.toggle('hidden', !opponent);
        if (!opponent) return;
        $('opponentName').textContent = opponent.name;
        $('opponentProgress').textContent = `${Math.min(opponent.state?.lines || 0,40)} / 40 lines${opponent.connected ? '' : ' · offline'}`;
        const c = $('opponentCanvas').getContext('2d');
        c.fillStyle = '#1d1511'; c.fillRect(0,0,100,200);
        if (!opponent.state) return;
        opponent.state.board.forEach((row,y) => row.forEach((type,x) => { if (type) { c.fillStyle=COLORS[type]; c.fillRect(x*10+1,y*10+1,8,8); } }));
        const p = opponent.state.player;
        p.matrix.forEach((row,y) => row.forEach((v,x) => { if(v) { c.fillStyle=COLORS[p.type]; c.fillRect((p.x+x)*10+1,(p.y+y)*10+1,8,8); } }));
    }
    function receive(message) {
        connected = true;
        self = message.self;
        room = message.room;
        report('');
        status(`Connected · ${message.online} player${message.online === 1 ? '' : 's'} online`);
        controls();
        if (!room) { if (!active) opponentPreview(null); return; }
        offset = room.now - Date.now();
        const opponent = room.players.find(p => p.id !== self.id);
        const mine = room.players.find(p => p.id === self.id);
        $('onlineLobbyLabel').textContent = room.visibility === 'private' ? 'PRIVATE ROOM' : 'PUBLIC MATCHMAKING';
        $('onlineLobbyTitle').textContent = room.status === 'waiting' ? (room.visibility === 'private' ? 'Waiting for your friend' : 'Finding an opponent…') : 'Your match is ready';
        $('onlineOpponentStatus').textContent = opponent ? `${opponent.name} has joined.` : 'Keep this page open while you wait.';
        if (room.status === 'waiting') return;
        if (startedRoom !== room.code && !handled.has(room.code)) {
            active = false;
            window.tetrisApp.start('versus');
            startedRoom = room.code;
        }
        if (handled.has(room.code)) return;
        active = room.status === 'playing' || room.status === 'countdown';
        gameScreen.classList.toggle('is-online', active);
        paused = false;
        gameOver = room.status !== 'playing';
        applyState(mine?.state);
        window.tetrisApp.onlineTime(Math.max(0, room.now - room.startAt));
        opponentPreview(opponent);
        $('leaveOnlineMatch').classList.toggle('hidden', !active);
        $('menuRestart').classList.toggle('hidden', active);
        document.querySelectorAll('[data-game-page]').forEach(button => { button.disabled = active; });
        $('matchModeLabel').textContent = 'Online · 40 lines';
        if (room.status === 'finished') {
            handled.add(room.code);
            active = false;
            gameScreen.classList.remove('is-online');
            gameOver = true;
            $('leaveOnlineMatch').classList.add('hidden');
            $('menuRestart').classList.remove('hidden');
            document.querySelectorAll('[data-game-page]').forEach(button => { button.disabled = false; });
            const won = room.winner === self.id;
            const reason = room.reason === '40-lines' ? 'The first player cleared 40 lines.' : room.reason === 'disconnect' ? 'The opponent did not reconnect in time.' : room.reason === 'forfeit' ? 'A player left the match.' : 'A player reached the top of the board.';
            resultDescription = `${room.winner ? (won ? 'You won this race!' : `${opponent?.name || 'Your opponent'} won this race.`) : 'No winner was declared.'} ${reason}`;
            window.tetrisApp.finish(room.winner ? (won ? 'online-win' : 'online-loss') : 'online-draw');
            $('playAgain').textContent = 'Play online again';
            return;
        }
        tick();
    }
    async function connect() {
        if (location.protocol === 'file:') { status('Online play requires the multiplayer server.'); report('Open the multiplayer game address to create rooms or find opponents.'); controls(); return; }
        if (connected && source) return;
        if (connecting) return connecting;
        connecting = (async () => {
            status('Connecting…'); report('');
            self = (await request('session')).self;
            source?.close();
            await new Promise((resolve,reject) => {
                const timeout = setTimeout(() => { source.close(); reject(new Error('Could not open the live connection. Close another game tab using this player and retry.')); }, 8000);
                let ready = false;
                source = new EventSource('/api/events');
                source.onmessage = event => {
                    try {
                        receive(JSON.parse(event.data));
                        if (!ready) { ready=true; clearTimeout(timeout); resolve(); }
                    } catch (error) { report(error.message); }
                };
                source.onerror = () => {
                    connected=false; controls(); status('Connection lost. Reconnecting…');
                    if (active) { messageTitle.textContent='RECONNECTING'; messageText.textContent='Your match continues. Reconnect within 30 seconds.'; gameMessage.classList.remove('hidden'); }
                };
            });
            if (!active) await request('profile',{name:$('accountName').textContent || 'Player'});
        })().catch(error => { status('Online connection unavailable'); report(error.message); connected=false; controls(); }).finally(() => { connecting=null; });
        return connecting;
    }
    function tick() {
        if (!active || !room) return;
        if (room.status === 'countdown') {
            const remaining = Math.max(1,Math.ceil((room.startAt - (Date.now()+offset))/1000));
            messageTitle.textContent = String(remaining); messageText.textContent = 'First to 40 lines. Get ready!'; gameMessage.classList.remove('hidden');
            $('matchClock').textContent = 'Starting…';
        } else {
            if (connected) gameMessage.classList.add('hidden');
            const seconds = Math.max(0,Math.floor((Date.now()+offset-room.startAt)/1000));
            $('matchClock').textContent = `${Math.min(lines,40)}/40 · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
        }
    }
    function input(action) {
        if (!active || !connected || room?.status !== 'playing' || $('matchMenu').open || pendingActions >= 20) return;
        pendingActions++;
        actions = actions.then(() => request('action',{action})).catch(error => { if (active) report(error.message); }).finally(() => { pendingActions--; });
    }
    async function attempt(endpoint,data={}) {
        await connect();
        if (!connected) return;
        try { await request(endpoint,data); } catch (error) { report(error.message); }
    }
    function openMenu() {
        const menu = $('matchMenu');
        menu.querySelector('p').textContent = 'Online play continues while this menu is open. Resume or leave the match.';
        if (!menu.open) menu.showModal();
    }
    function cancelWaiting() {
        if (room?.status === 'waiting') { room=null; controls(); request('leave',{}).catch(error=>report(error.message)); }
    }
    function noRestart() { openMenu(); }
    function resumeView() { if ($('matchMenu').open) $('matchMenu').close(); gameScreen.classList.remove('hidden'); $('hubScreen').classList.add('hidden'); }
    async function leave() {
        try { await request('leave',{}); if ($('matchMenu').open) $('matchMenu').close(); if (!active) window.tetrisApp.go('online'); }
        catch(error) { report(error.message); }
    }
    $('createOnlineRoom').addEventListener('click',()=>attempt('create'));
    $('findOnlineMatch').addEventListener('click',()=>attempt('matchmake'));
    $('joinOnlineForm').addEventListener('submit',event=>{event.preventDefault();attempt('join',{code:$('onlineRoomCode').value.trim().toUpperCase()});});
    $('cancelOnlineRoom').addEventListener('click',leave);
    $('leaveOnlineMatch').addEventListener('click',leave);
    $('copyOnlineInvite').addEventListener('click',async()=>{
        if (!room) return;
        const url = new URL(location.href); url.search=''; url.hash=''; url.searchParams.set('room',room.code);
        try { await navigator.clipboard.writeText(url.href); $('copyOnlineInvite').textContent='Link copied!'; }
        catch { report(`Share this room code: ${room.code}`); }
    });
    const invite = new URLSearchParams(location.search).get('room');
    if (invite && /^[A-Fa-f0-9]{7}$/.test(invite)) $('onlineRoomCode').value=invite.toUpperCase();
    controls();
    window.onlinePlay={connect,input,tick,openMenu,noRestart,resumeView,cancelWaiting,get active(){return active;},get resultDescription(){return resultDescription;}};
})();
