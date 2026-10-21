const fs=require('fs');let s=fs.readFileSync('app.js','utf8');
const start=s.indexOf('        // 174 BPM,');const end=s.indexOf('\n    function cue(',start);
s=s.slice(0,start)+`        // Public-domain Korobeiniki, arranged as a fast classic arcade chiptune.
        const beat = Math.floor(elapsed / 180);
        if (beat === musicBeat) return;
        musicBeat = beat;
        const hz = note => 440 * Math.pow(2, (note - 69) / 12);
        const volume = Math.max(0, Math.min(100, settings.musicVolume)) / 100;
        // [MIDI note, eighth-note duration]; retain the tune's recognizable rhythm.
        const theme = [
            [76,2],[71,1],[72,1],[74,2],[72,1],[71,1],
            [69,2],[69,1],[72,1],[76,2],[74,1],[72,1],
            [71,3],[72,1],[74,2],[76,2],[72,2],[69,2],[69,4],
            [74,3],[77,1],[81,2],[79,1],[77,1],
            [76,3],[72,1],[76,2],[74,1],[72,1],
            [71,2],[71,1],[72,1],[74,2],[76,2],[72,2],[69,2],[69,4],
            [76,4],[72,4],[74,4],[71,4],[72,4],[69,4],[68,4],[71,4],
            [76,4],[72,4],[74,4],[71,4],[72,2],[76,2],[81,4],[80,4],[0,4]
        ];
        const cycle = theme.reduce((total, event) => total + event[1], 0);
        const position = beat % cycle;
        let cursor = 0;
        for (const [note, length] of theme) {
            if (position === cursor && note) {
                const duration = length * .18 - .025;
                voice(hz(note), duration, volume * .14, 'square');
                voice(hz(note) * 1.003, duration, volume * .045, 'triangle');
                // A quiet octave gives the lead the full arcade sound.
                voice(hz(note + 12), Math.min(.14, duration), volume * .022, 'square');
            }
            cursor += length;
        }
        const bar = Math.floor(position / 8), step = position % 8;
        const root = [45,45,40,45,50,45,40,45][bar % 8];
        // Alternating bass and offbeat chords, as in traditional Tetris arrangements.
        if (step % 2 === 0) {
            voice(hz(root + (step % 4 === 2 ? 7 : 0)), .17, volume * .20, 'triangle');
            voice(hz(root - 12), .15, volume * .11, 'sine');
        } else {
            [12,15,19].forEach(interval => voice(hz(root + interval), .08, volume * .035, 'square'));
        }
        if (step === 0 || step === 4) {
            voice(145, .12, volume * .22, 'sine', 0, 42);
            noise(.025, volume * .045, 3200, 700);
        }
        if (step === 2 || step === 6) noise(.075, volume * .13, 5500, 1700);
        noise(.025, volume * .035, 7000, 5000, 0, true);
    }
`+s.slice(end);
s=s.replace("voice(270, .24, volume * .52, 'sine', 0, 32);", "voice(185, .12, volume * .38, 'triangle', 0, 48);");
s=s.replace("voice(950, .095, volume * .20, 'sawtooth', 0, 65);", "voice(680, .035, volume * .13, 'square', 0, 150);");
s=s.replace("noise(.11, volume * .30, 3600, 180);", "noise(.045, volume * .16, 2600, 350);");
s=s.replace("noise(count >= 4 ? .65 : .32, volume * .38, 800, 11000);", "noise(count >= 4 ? .25 : .12, volume * .16, 1600, 8500);");
s=s.replace("voice(160, .32, volume * .35, 'sawtooth', 0, 32);", "voice(220, .13, volume * .18, 'triangle', 0, 80);");
s=s.replace("voice(note, count >= 4 ? .38 : .26, volume * .24, i % 2 ? 'sawtooth' : 'square', i * .045, note * (count >= 4 ? 2 : 1.025))", "voice(note, count >= 4 ? .22 : .14, volume * .19, 'square', i * .045, note * 1.015)");
fs.writeFileSync('app.js',s);
let h=fs.readFileSync('index.html','utf8').replace('app.js?v=heavy-audio-3','app.js?v=classic-audio-4');fs.writeFileSync('index.html',h);
