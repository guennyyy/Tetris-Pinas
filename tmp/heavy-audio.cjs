const fs=require('fs');let s=fs.readFileSync('app.js','utf8');
s=s.replace('    let audio;','    let audio;\n    let audioMaster;\n    let noiseBuffer;');
const at=s.indexOf('    // Short synthesized voices');
s=s.slice(0,at)+`    function audioOutput() {
        if (!audioMaster) {
            // Keep overlapping drums and gameplay impacts from clipping.
            audioMaster = audio.createDynamicsCompressor();
            audioMaster.threshold.value = -18;
            audioMaster.knee.value = 12;
            audioMaster.ratio.value = 6;
            audioMaster.attack.value = .003;
            audioMaster.release.value = .12;
            audioMaster.connect(audio.destination);
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
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
        source.start(time); source.stop(time + duration + .01);
    }
`+s.slice(at);
s=s.replace('oscillator.connect(gain); gain.connect(audio.destination);','oscillator.connect(gain); gain.connect(audioOutput());');
const start=s.indexOf('        const beat = Math.floor(elapsed /');const end=s.indexOf('\n    function cue(',start);
s=s.slice(0,start)+`        // 174 BPM, sixteen steps per bar; a complete 16-bar build/drop arrangement.
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
`+s.slice(end);
s=s.replace("voice(230, .19, volume * .32, 'sine', 0, 38);", "voice(270, .24, volume * .52, 'sine', 0, 32);");
s=s.replace("voice(1400, .065, volume * .085, 'sawtooth', 0, 85);", "voice(950, .095, volume * .20, 'sawtooth', 0, 65);\n            noise(.11, volume * .30, 3600, 180);");
s=s.replace("            const notes = count >= 4", "            noise(count >= 4 ? .65 : .32, volume * .38, 800, 11000);\n            voice(160, .32, volume * .35, 'sawtooth', 0, 32);\n            const notes = count >= 4");
s=s.replace("volume * .16, i % 2 ? 'triangle' : 'square'", "volume * .24, i % 2 ? 'sawtooth' : 'square'");
fs.writeFileSync('app.js',s);
let h=fs.readFileSync('index.html','utf8').replace('app.js?v=guide-1','app.js?v=heavy-audio-3');fs.writeFileSync('index.html',h);
