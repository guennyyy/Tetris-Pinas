const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const html = fs.readFileSync('index.html','utf8');
class Element {
    constructor(id='', classes='') { this.id=id; this.classes=new Set(classes.split(/\s+/).filter(Boolean)); this.value=''; this.textContent=''; this.innerHTML=''; this.listeners={}; this.dataset={}; this.open=false; this.width=300; this.height=600; this.checked=false;
        this.classList={add:(c)=>this.classes.add(c),remove:(c)=>this.classes.delete(c),contains:(c)=>this.classes.has(c),toggle:(c,on)=>{if(on===undefined)on=!this.classes.has(c);on?this.classes.add(c):this.classes.delete(c);return on;}};
    }
    addEventListener(type, fn) {(this.listeners[type] ||= []).push(fn);}
    fire(type,extra={}) {for(const fn of this.listeners[type]||[])fn({target:this,preventDefault(){},...extra});}
    setAttribute(){} removeAttribute(){} focus(){} setCustomValidity(){} reportValidity(){} reset(){}
    matches(selector) {return this.input || false;}
    querySelector() {return new Element();}
    getContext(){return context2d;}
    closest(){return boardFrame;}
    getBoundingClientRect(){return {width:200};}
    setPointerCapture(){} showModal(){this.open=true;} close(){this.open=false;}
}
const gradient={addColorStop(){}};
const context2d=new Proxy({}, {get:(o,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>gradient:()=>{},set:(o,k,v)=>{o[k]=v;return true;}});
const ids={};
for(const m of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {assert(!ids[m[1]], 'Duplicate ID '+m[1]);ids[m[1]]=new Element(m[1],m[0].match(/class="([^"]*)"/)?.[1]||'');}
for(const m of fs.readFileSync('game.js','utf8').matchAll(/getElementById\(\s*["']([^"']+)["']/g))assert(ids[m[1]],'Missing element '+m[1]);
const boardFrame=new Element('', 'board-frame');
const footer=new Element('', 'bottom-panel hidden');
const tip=new Element('', 'tip-card');
const google=new Element(), facebook=new Element();
const pages=Object.values(ids).filter(e=>e.id.startsWith('page-'));
const nav=[];
for(const m of html.matchAll(/<(?:button|a)[^>]*data-(page|mode|game-page)="([^"]+)"[^>]*>/g)){const el=new Element();el.dataset[m[1]==='game-page'?'gamePage':m[1]]=m[2];nav.push(el);}
const document={hidden:false,body:{dataset:{}},listeners:{},getElementById:id=>ids[id],querySelector:selector=>({'.bottom-panel':footer,'.tip-card':tip,'.social-button.google':google,'.social-button.facebook':facebook}[selector]),querySelectorAll:selector=>selector==='.hub-page'?pages:selector.includes('data-page')?nav.filter(e=>e.dataset.page):selector.includes('data-game-page')?nav.filter(e=>e.dataset.gamePage):nav.filter(e=>e.dataset.mode),addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}};
const storage=new Map();
const sandbox={document,console,performance:{now:()=>0},navigator:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame(){},scrollTo(){},Date,Math,URLSearchParams};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('game.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('app.js','utf8'),sandbox);
const run=code=>vm.runInContext(code,sandbox);
const app=sandbox.tetrisApp;
ids.leaderboardMode.value='marathon';
run('update(1000)');assert.equal(run('player.y'),0,'Hidden game should not advance');
app.enter();assert(!ids.hubScreen.classList.contains('hidden'));
app.start('marathon');assert(!ids.gameScreen.classList.contains('hidden'));
app.tick(2000);assert.equal(ids.matchClock.textContent,'0:02');
app.go('settings');assert(run('paused'));
app.tick(10000);assert.equal(ids.matchClock.textContent,'0:02','Pause should stop timer');
app.resume();assert(!run('paused'));
ids.openMatchMenu.fire('click');assert(ids.matchMenu.open);assert(run('paused'));
const oldX=run('player.x');for(const fn of document.listeners.keydown)fn({code:'ArrowLeft',key:'ArrowLeft',target:new Element(),preventDefault(){}});assert.equal(run('player.x'),oldX,'Modal should block game keys');
ids.menuResume.fire('click');assert(!ids.matchMenu.open);
run('score=5200; lines=12; endGame()');assert(!ids['page-results'].classList.contains('hidden'));
let saved=JSON.parse(storage.get('tetrisPinasProgress'));assert.equal(saved.matches.length,1);assert.equal(saved.matches[0].score,5200);
app.finish('topout');assert.equal(JSON.parse(storage.get('tetrisPinasProgress')).matches.length,1,'Result must not duplicate');
app.go('leaderboard');assert(ids.leaderboardList.innerHTML.includes('5,200'));
app.start('sprint');run('lines=40; score=8000');assert(app.checkGoal());saved=JSON.parse(storage.get('tetrisPinasProgress'));assert(saved.matches.at(-1).success);
app.start('blitz');app.tick(120000);assert.equal(ids.resultTitle.textContent,"Time's up!");assert.equal(JSON.parse(storage.get('tetrisPinasProgress')).matches.at(-1).duration,120000);
app.start('practice');const y=run('player.y');for(let t=2000;t<12000;t+=100)run('update('+t+')');assert.equal(run('player.y'),y,'Practice must not auto-drop');run('playerDrop()');assert.equal(run('player.y'),y+1);
app.go('settings');ids.settingGhost.checked=false;ids.settingEffects.checked=false;ids.settingButtons.checked=true;ids.settingTheme.value='night';ids.settingsForm.fire('submit');assert(!app.settings.ghost);assert(!footer.classList.contains('hidden'));assert.equal(document.body.dataset.theme,'night');
app.go('profile');ids.profileName.value='<Player>';ids.profileIcon.value='★';ids.profileForm.fire('submit');assert.equal(ids.accountName.textContent,'<Player>');assert.equal(JSON.parse(storage.get('tetrisPinasProgress')).profiles.guest.name,'<Player>');
app.resume();run('player={type:"T",matrix:SHAPES.T.map(row=>[...row]),x:3,y:0}');const before=run('JSON.stringify(player.matrix)');boardFrame.fire('pointerdown',{isPrimary:true,pointerType:'touch',pointerId:1,clientX:20,clientY:20});boardFrame.fire('pointerup',{pointerId:1,clientX:20,clientY:20});assert.notEqual(run('JSON.stringify(player.matrix)'),before,'Tap should rotate');
document.hidden=true;for(const fn of document.listeners.visibilitychange)fn();assert(run('paused'),'Background tab must pause');
console.log('PASS: hidden-game freeze, guest home, start/resume, pause timer, modal keyboard isolation, single result persistence, leaderboard, Sprint completion, Blitz timer, Practice behavior, saved settings/profile, touch rotation, tab auto-pause.');
