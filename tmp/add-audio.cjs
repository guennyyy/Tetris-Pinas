const fs=require('fs');
let s=fs.readFileSync('app.js','utf8');
s=s.replace('sound: false, vibration:', 'sound: true, vibration:').replace('musicVolume: 0, soundVolume:', 'musicVolume: 30, soundVolume:');
const a=s.indexOf('        if (settings.musicVolume>0 && audio?.state');const b=s.indexOf('        updateClock();',a);s=s.slice(0,a)+s.slice(b);
const start=s.indexOf('    function cue(kind) {');const end=s.indexOf('    function openAuth()',start);
s=s.slice(0,start)+`    // Short synthesized voices need no downloads and stay within the volume controls.
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
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(time); oscillator.stop(time + duration + .01);
    }
    function musicTick() {
        if (!active || paused || gameOver || document.hidden || gameScreen.classList.contains('hidden') || settings.musicVolume <= 0 || audio?.state !== 'running') return;
        const beat = Math.floor(elapsed / 225);
        if (beat === musicBeat) return;
        musicBeat = beat;
        // Original eight-bar pentatonic loop: bell melody, warm bass, light percussion.
        const melody = [76,79,81,79,76,74,72,74,76,79,84,81,79,76,74,0,
                        77,81,84,81,77,76,74,76,79,81,79,76,74,72,74,0,
                        76,79,81,84,86,84,81,79,76,79,84,81,79,76,74,0,
                        77,81,84,81,79,76,74,72,74,76,79,74,72,0,72,0];
        const hz = note => 440 * Math.pow(2, (note - 69) / 12);
        const volume = Math.max(0, Math.min(100, settings.musicVolume)) / 100;
        const note = melody[beat % melody.length];
        if (note) voice(hz(note), .19, volume * .055, 'triangle');
        if (beat % 2 === 0) {
            const root = [48,45,53,55][Math.floor(beat / 16) % 4];
            voice(hz(root + (beat % 4 === 2 ? 7 : 0)), .29, volume * .07, 'sine');
        }
        if (beat % 4 === 0) voice(115, .09, volume * .05, 'sine', 0, 42);
    }
    function cue(kind, count = 1) {
        if (settings.vibration && navigator.vibrate) navigator.vibrate(kind === 'finish' ? [40,30,40] : 15);
        unlockAudio();
        if (!settings.sound || !audio || audio.state !== 'running' || settings.soundVolume <= 0 || document.hidden) return;
        const volume = Math.max(0, Math.min(100, settings.soundVolume)) / 100;
        if (kind === 'lock') {
            voice(165, .13, volume * .19, 'sine', 0, 48);
            voice(800, .035, volume * .035, 'triangle', 0, 150);
        } else if (kind === 'clear') {
            const notes = count >= 4 ? [523.25,659.25,783.99,1046.5,1318.51] : [523.25,659.25,783.99,1046.5].slice(0, Math.min(4, count + 2));
            notes.forEach((note, i) => voice(note, .23, volume * .105, 'triangle', i * .065));
        } else if (kind === 'finish') {
            [523.25,659.25,783.99,1046.5].forEach((note, i) => voice(note, .32, volume * .09, 'triangle', i * .1));
        }
    }
`+s.slice(end);
s=s.replace('enter, tick, checkGoal, finish, cue,','enter, tick, musicTick, checkGoal, finish, cue,');
// Retry audio activation on gestures, including an online match started by the server.
s=s.replace("    document.addEventListener('visibilitychange',", "    document.addEventListener('pointerdown', unlockAudio);\n    document.addEventListener('keydown', unlockAudio);\n    document.addEventListener('visibilitychange',");
fs.writeFileSync('app.js',s);
s=fs.readFileSync('game.js','utf8').replace('    clearLines(tSpin);\n    if (window.tetrisApp)', '    window.tetrisApp?.cue("lock");\n    clearLines(tSpin);\n    if (window.tetrisApp)').replace('        window.tetrisApp.cue("lock");\n','');
s=s.replace('    if (cleared) {\n        triggerClearEffect', '    if (cleared) {\n        window.tetrisApp?.cue("clear", cleared);\n        triggerClearEffect');
s=s.replace('    syncMouseTarget();\n    draw();', '    window.tetrisApp?.musicTick();\n    syncMouseTarget();\n    draw();');fs.writeFileSync('game.js',s);
s=fs.readFileSync('index.html','utf8').replace('A short tone when a piece locks or a match ends.','Landing thumps, line-clear chimes, and match-end sounds.').replace('Music volume<input','Gameplay music volume<input');fs.writeFileSync('index.html',s);
