const fs=require('fs');let s=fs.readFileSync('app.js','utf8');
const a=s.indexOf('    // Replace the previous silent defaults');const b=s.indexOf('    // Enable the new landing outline',a);s=s.slice(0,a)+s.slice(b);
s=s.replace('    let noiseBuffer;', '    let noiseBuffer;\n    const audioSources = new Set();\n    function stopAudioSources() {\n        for (const source of audioSources) { try { source.stop(); } catch {} }\n        audioSources.clear();\n        musicBeat = -1;\n    }');
s=s.replace('source.onended = () => { source.disconnect();', 'audioSources.add(source);\n        source.onended = () => { audioSources.delete(source); source.disconnect();');
s=s.replace('oscillator.onended = () => { oscillator.disconnect();', 'audioSources.add(oscillator);\n        oscillator.onended = () => { audioSources.delete(oscillator); oscillator.disconnect();');
s=s.replace("'Changes apply when saved.'", "'Changes save automatically.'");
const start=s.indexOf("    for (const name of ['MusicVolume','SoundVolume']) {\n        $('setting'+name).addEventListener('input'");const end=s.indexOf("    $('toggleFullscreen').addEventListener",start);
s=s.slice(0,start)+`    function saveSettingsFromForm() {
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
`+s.slice(end);
fs.writeFileSync('app.js',s);
s=fs.readFileSync('game.js','utf8').replace('const softInterval = Math.min(getDropInterval()/Math.max(1,Number(settings.softDropFactor || 20)),50);','const fallInterval = getDropInterval();\n                const softInterval = Math.max(10,(Number.isFinite(fallInterval) ? fallInterval : 1000)/Math.max(1,Number(settings.softDropFactor || 20)));');fs.writeFileSync('game.js',s);
s=fs.readFileSync('index.html','utf8').replace('Changes apply when saved.','Changes save automatically.').replace('app.js?v=settings-6','app.js?v=settings-live-7').replace('game.js?v=firebase-1','game.js?v=settings-live-7');fs.writeFileSync('index.html',s);
