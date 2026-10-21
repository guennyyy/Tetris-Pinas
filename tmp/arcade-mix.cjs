const fs=require('fs');let s=fs.readFileSync('app.js','utf8');
const source=fs.readFileSync('tmp/heavy-audio.cjs','utf8');
const arrangement=source.match(/s=s\.slice\(0,start\)\+`([\s\S]*?)`\+s\.slice\(end\);/)[1];
const start=s.indexOf('        // Public-domain Korobeiniki');const end=s.indexOf('\n    function cue(',start);
s=s.slice(0,start)+arrangement+s.slice(end);
// Bring the requested arcade mix forward while retaining compressor headroom.
s=s.replace('audioMaster.threshold.value = -18;', 'audioMaster.threshold.value = -12;').replace('audioMaster.ratio.value = 6;', 'audioMaster.ratio.value = 4;');
s=s.replace('            audioMaster.connect(audio.destination);', '            const output = audio.createGain();\n            output.gain.value = 1.45;\n            audioMaster.connect(output); output.connect(audio.destination);');
s=s.replace('audioVersion: 1,','audioVersion: 2,').replace('musicVolume: 30, soundVolume: 50','musicVolume: 70, soundVolume: 75');
s=s.replace("    // Enable the new landing outline once", `    // Apply the requested louder arcade preset once; keep explicit mutes.
    if (storedSettings.audioVersion !== 2) {
        if (settings.musicVolume > 0) settings.musicVolume = Math.max(70, settings.musicVolume);
        if (settings.soundVolume > 0) settings.soundVolume = Math.max(75, settings.soundVolume);
        try { localStorage.setItem('tetrisPinasSettings', JSON.stringify(settings)); } catch {}
    }
    // Enable the new landing outline once`);
s=s.replace('storedSettings.audioVersion !== 1','storedSettings.audioVersion == null');
s=s.replace("voice(185, .12, volume * .38, 'triangle', 0, 48);", "voice(245, .20, volume * .48, 'sine', 0, 34);");
s=s.replace("voice(680, .035, volume * .13, 'square', 0, 150);", "voice(1100, .06, volume * .16, 'sawtooth', 0, 110);");
s=s.replace("noise(.045, volume * .16, 2600, 350);", "noise(.095, volume * .24, 3600, 220);");
s=s.replace("noise(count >= 4 ? .25 : .12, volume * .16, 1600, 8500);", "noise(count >= 4 ? .5 : .24, volume * .28, 900, 10000);");
s=s.replace("voice(220, .13, volume * .18, 'triangle', 0, 80);", "voice(180, .25, volume * .29, 'sawtooth', 0, 38);");
s=s.replace("voice(note, count >= 4 ? .22 : .14, volume * .19, 'square', i * .045, note * 1.015)", "voice(note, count >= 4 ? .32 : .20, volume * .22, 'square', i * .045, note * 1.025)");
fs.writeFileSync('app.js',s);
let h=fs.readFileSync('index.html','utf8').replace('app.js?v=classic-audio-4','app.js?v=arcade-audio-5');fs.writeFileSync('index.html',h);
