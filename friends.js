/* Dashboard presence and browser-saved favorite players. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const list = $('friendsList');
    list.addEventListener('wheel', event => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
        const maximum = list.scrollWidth - list.clientWidth;
        if (maximum <= 0) return;
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? list.clientWidth : 1;
        const next = Math.max(0, Math.min(maximum, list.scrollLeft + event.deltaY * unit));
        if (next === list.scrollLeft) return;
        event.preventDefault();
        list.scrollLeft = next;
    }, { passive:false });
    let profileId = '';
    let displayName = '';
    let selfId = '';
    let people = [];
    let favorites = [];
    let timer;
    let generation = 0;
    let connecting;

    function storageKey() { return `tetrisPinasFavorites:${profileId}`; }
    function loadFavorites() {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey()));
            return Array.isArray(saved) ? saved.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string').slice(0,100) : [];
        } catch { return []; }
    }
    function saveFavorites() {
        try { localStorage.setItem(storageKey(), JSON.stringify(favorites)); } catch { /* Browsing still works without local storage. */ }
    }
    function empty(message) {
        for (const target of [list,$('allFriendsList')].filter(Boolean)) {
            target.replaceChildren();
            const p = document.createElement('p');
            p.className = 'friends-empty';
            p.textContent = message;
            target.append(p);
        }
    }
    function toggleFavorite(person) {
        const index = favorites.findIndex(p => p.id === person.id);
        if (index < 0) favorites.unshift({ id:person.id, name:person.name });
        else favorites.splice(index,1);
        saveFavorites();
        render();
    }
    function render() {
        const allList = $('allFriendsList');
        const targets = [list,allList].filter(Boolean);
        const scrollPositions = new Map(targets.map(target => [target,target.scrollLeft]));
        targets.forEach(target => target.replaceChildren());
        const favoritePeople = favorites.map(p => people.find(person => person.id === p.id) || p);
        favoritePeople.sort((a,b) => Number(people.some(p => p.id === b.id)) - Number(people.some(p => p.id === a.id)));
        const shown = [
            ...favoritePeople,
            ...people.filter(person => !favorites.some(p => p.id === person.id))
        ];
        if (!shown.length) {
            empty('No friends here yet. Star a player when they come online.');
            return;
        }
        for (const target of targets) {
            shown.forEach(person => {
                const isOnline = people.some(p => p.id === person.id);
                const isFavorite = favorites.some(p => p.id === person.id);
                const card = document.createElement('div');
                card.className = 'friend-card';
                const avatar = document.createElement('span');
                avatar.className = 'friend-avatar';
                avatar.textContent = person.name.trim().slice(0,1).toUpperCase() || '★';
                const details = document.createElement('span');
                details.className = 'friend-details';
                const name = document.createElement('strong');
                name.textContent = person.name;
                const state = document.createElement('span');
                state.className = isOnline ? 'friend-presence is-online' : 'friend-presence is-offline';
                state.setAttribute('role','img');
                state.setAttribute('aria-label', isOnline ? 'Online' : 'Offline');
                state.title = isOnline ? 'Online' : 'Offline';
                details.append(name);
                const star = document.createElement('button');
                star.type = 'button';
                star.className = 'friend-star';
                star.textContent = isFavorite ? '★' : '☆';
                star.setAttribute('aria-label', `${isFavorite ? 'Remove' : 'Add'} ${person.name} ${isFavorite ? 'from' : 'to'} favorites`);
                star.setAttribute('aria-pressed', String(isFavorite));
                star.addEventListener('click', () => toggleFavorite(person));
                card.append(avatar,state,details,star);
                target.append(card);
            });
            target.scrollLeft = scrollPositions.get(target);
        }
    }
    async function request(path, data) {
        const response = await fetch('/api/' + path, data === undefined ? { credentials:'same-origin', cache:'no-store' } : {
            method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json', 'X-Tetris-Request':'1' }, body:JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Presence unavailable');
        return response.json();
    }
    async function refresh() {
        if (!profileId || !selfId || document.hidden) return;
        try {
            const result = await request('people');
            people = result.players.filter(p => p.id !== selfId && typeof p.name === 'string');
            for (const player of people) {
                const saved = favorites.find(p => p.id === player.id);
                if (saved) saved.name = player.name;
            }
            saveFavorites();
            render();
        } catch {
            people = [];
            render();
            if (!favorites.length) { list.replaceChildren(); empty('Could not load friends right now.'); }
        }
    }
    async function connect(version) {
        try {
            const session = await request('session');
            if (version !== generation) return;
            selfId = session.self.id;
            await request('profile', { name:displayName });
            if (version !== generation) return;
            await refresh();
        } catch {
            if (version !== generation) return;
            selfId = '';
            people = [];
            render();
            if (!favorites.length) { list.replaceChildren(); empty('Log In/Sign up to the game to add and play with friends.'); }
        } finally { connecting = null; }
    }
    function start(name, id) {
        const nameChanged = displayName !== name;
        if (profileId !== id) {
            profileId = id;
            favorites = loadFavorites();
        }
        displayName = name;
        render();
        if (!timer) timer = setInterval(() => {
            if (selfId) refresh();
            else if (!connecting && location.protocol !== 'file:') connecting = connect(++generation);
        },15000);
        if (location.protocol === 'file:') {
            if (!favorites.length) { list.replaceChildren(); empty('Log In/Sign up to the game to add and play with friends.'); }
            return;
        }
        if (selfId) { if (nameChanged) setName(name); refresh(); return; }
        if (!connecting) connecting = connect(++generation);
    }
    function setName(name) {
        displayName = name;
        if (selfId) request('profile',{ name }).catch(() => {});
    }
    function stop() {
        generation++;
        clearInterval(timer);
        timer = null;
        selfId = '';
        profileId = '';
        people = [];
        connecting = null;
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    window.friendsPanel = { start, setName, stop };
})();
