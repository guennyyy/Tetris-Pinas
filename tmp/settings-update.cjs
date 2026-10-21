const fs=require('fs');let h=fs.readFileSync('index.html','utf8');
const old=h.match(/<section id="page-settings"[\s\S]*?<\/form><\/section>/)[0];
const field=id=>old.match(new RegExp('<label>(?:(?!<label>)[\\s\\S])*?id="'+id+'"[\\s\\S]*?</label>'))?.[0];
const toggle=(id,title,description,extra='')=>`<label class="setting-row" ${extra}><span><strong>${title}</strong><small>${description}</small></span><input id="${id}" type="checkbox"></label>`;
const keyboard=['Left','Right','SoftDrop','HardDrop','RotateCW','RotateCCW','Hold'].map(n=>field('control'+n)).join('');
const number=(id,label,min,max,step)=>`<label>${label}<input id="${id}" type="number" min="${min}" max="${max}" step="${step}"></label>`;
const range=(id,label)=>`<label class="settings-volume"><span>${label}<output id="${id}Value" for="${id}"></output></span><input id="${id}" type="range" min="0" max="100"></label>`;
const page=`<section id="page-settings" class="hub-page hidden">
<header class="settings-heading"><div><p class="eyebrow">MAKE IT YOUR GAME</p><h1>Settings</h1></div><p>Find your rhythm. Make every move feel right.</p></header>
<form id="settingsForm" class="settings-list">
<div class="settings-cards">
<section class="settings-card"><h2>Display &amp; feedback</h2><p class="settings-description">Fine-tune your board.</p>
${toggle('settingGhost','Ghost piece','Preview where your piece will land.')}
${toggle('settingGrid','Grid lines','Show the cells on the board.')}
${toggle('settingEffects','Visual effects','Block impacts and line-clear particles.')}
${toggle('settingVibration','Vibration','Feedback on supported devices.','id="vibrationSetting"')}
</section>
<section class="settings-card"><h2>Audio</h2><p class="settings-description">Arcade music and gameplay sounds.</p>
${toggle('settingSound','Sound effects','Block hits, line clears, and match results.')}
${range('settingMusicVolume','Music volume')}${range('settingSoundVolume','Effects volume')}
</section>
<section class="settings-card"><h2>Practice</h2><p class="settings-description">These options apply to Practice only.</p>
${toggle('settingPracticeGravity','Automatic falling','Off lets you place pieces at your own pace.')}
<div class="settings-fields">${number('settingPracticeSpeed','Fall interval (ms)',100,3000,50)}</div><p class="settings-help">A smaller interval makes pieces fall faster. Used when automatic falling is on.</p>
</section>
<section class="settings-card settings-keyboard"><h2>Keyboard controls</h2><p class="settings-description">Choose the keys for your next move.</p><div class="settings-fields">${keyboard}</div><p class="settings-help">X also rotates clockwise; Shift also holds. P pauses and R restarts solo play.</p></section>
<section class="settings-card"><h2>Movement speed</h2><p class="settings-description">Keyboard repeat and soft drop in solo modes.</p><div class="settings-fields settings-handling">
${number('settingDas','Hold delay (ms)',50,500,10)}${number('settingArr','Repeat interval (ms)',10,150,5)}${number('settingSoftDropFactor','Soft drop multiplier',2,100,1)}
</div><p class="settings-help">Lower delay and repeat values move pieces faster. A higher multiplier speeds up soft drop.</p></section>
</div><footer class="settings-actions"><span id="settingsSaveStatus" role="status" aria-live="polite">Changes apply when saved.</span><button id="toggleFullscreen" type="button">Toggle fullscreen</button><button type="submit" class="settings-save">Save settings</button></footer>
</form></section>`;
if(keyboard.includes('undefined'))throw Error('Missing keyboard fields');
h=h.replace(old,page).replace('    <link rel="stylesheet" href="how-to-play.css?v=2">','    <link rel="stylesheet" href="how-to-play.css?v=2">\n    <link rel="stylesheet" href="settings.css?v=1">').replace('app.js?v=arcade-audio-5','app.js?v=settings-6');fs.writeFileSync('index.html',h);
let s=fs.readFileSync('app.js','utf8');s=s.replaceAll("'Vibration','PracticeGravity','PracticeHints'","'Vibration','PracticeGravity'");
s=s.replace("        $('settingTheme').value = settings.theme;", `        $('vibrationSetting').classList.toggle('hidden', typeof navigator.vibrate !== 'function');
        $('toggleFullscreen').classList.toggle('hidden', !document.documentElement?.requestFullscreen && !document.fullscreenElement);
        for (const name of ['MusicVolume','SoundVolume']) $('setting'+name+'Value').textContent = settings[name.charAt(0).toLowerCase()+name.slice(1)] + '%';
        $('settingsSaveStatus').textContent = 'Changes apply when saved.';`);
s=s.replace("        settings.theme = $('settingTheme').value;", "        settings.theme = 'fiesta';");
s=s.replace('        settings.hints = false;', "        settings.hints = false;\n        settings.practiceHints = false;\n        settings.theme = 'fiesta';\n        document.body.dataset.theme = 'fiesta';");
s=s.replace("    $('settingsForm').addEventListener('submit',", `    for (const name of ['MusicVolume','SoundVolume']) {
        $('setting'+name).addEventListener('input', () => { $('setting'+name+'Value').textContent = $('setting'+name).value + '%'; });
    }
    $('settingsForm').addEventListener('submit',`);
s=s.replace("        if (storageAvailable) notice('Settings saved.');", "        if (storageAvailable) { $('settingsSaveStatus').textContent = 'Settings saved.'; notice('Settings saved.'); }");fs.writeFileSync('app.js',s);
let t=fs.readFileSync('flow-smoke-test.cjs','utf8').replace("ids.settingTheme.value='night';",'').replace("assert.equal(document.body.dataset.theme,'night');","assert.equal(document.body.dataset.theme,'fiesta');assert(!ids.settingTheme);assert(!ids.settingPracticeHints);assert(ids.vibrationSetting.classList.contains('hidden'),'Unsupported vibration is hidden');");fs.writeFileSync('flow-smoke-test.cjs',t);
