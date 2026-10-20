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
    getBoundingClientRect(){return {left:0,top:0,width:200,height:400};}
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
const divider=new Element('', 'divider');
const google=new Element(), facebook=new Element();
const pages=Object.values(ids).filter(e=>e.id.startsWith('page-'));
const nav=[];
for(const m of html.matchAll(/<(?:button|a)[^>]*data-(page|mode|game-page)="([^"]+)"[^>]*>/g)){const el=new Element();el.dataset[m[1]==='game-page'?'gamePage':m[1]]=m[2];nav.push(el);}
const document={hidden:false,body:{dataset:{}},listeners:{},getElementById:id=>ids[id],querySelector:selector=>({'.bottom-panel':footer,'.tip-card':tip,'.social-button.google':google,'.social-button.facebook':facebook,'.divider':divider}[selector]),querySelectorAll:selector=>selector==='.hub-page'?pages:selector.includes('data-page')?nav.filter(e=>e.dataset.page):selector.includes('data-game-page')?nav.filter(e=>e.dataset.gamePage):nav.filter(e=>e.dataset.mode),addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}};
const storage=new Map();
const sandbox={document,console,Image:class { get complete(){return false;} },performance:{now:()=>0},navigator:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame(){},scrollTo(){},Date,Math,URLSearchParams};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('tetris-core.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('game.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('app.js','utf8'),sandbox);
const run=code=>vm.runInContext(code,sandbox);
const app=sandbox.tetrisApp;
ids.showSignup.fire('click');assert.equal(ids.authHeading.textContent,'Join the Laro!');assert.equal(ids.authSubmit.textContent,'CREATE ACCOUNT');assert(ids.displayName.required);assert(!ids.displayNameField.classList.contains('hidden'));
ids.showLogin.fire('click');assert.equal(ids.authHeading.textContent,'Welcome back, Player!');assert(ids.displayNameField.classList.contains('hidden'));
ids.authPassword.type='password';ids.toggleAuthPassword.fire('click');assert.equal(ids.authPassword.type,'text');ids.toggleAuthPassword.fire('click');assert.equal(ids.authPassword.type,'password');
ids.leaderboardMode.value='marathon';
app.enter();app.settings.controls.left='KeyA';app.go('guide');assert(ids['guideKey-leftRight'].textContent.startsWith('A /'),'Guide reflects configured movement keys');assert(ids['guideKey-hold'].textContent.includes('C'),'Guide includes Hold');delete app.settings.controls.left;

const hiddenY=run('player.y');run('update(1000)');assert.equal(run('player.y'),hiddenY,'Hidden game should not advance');
app.enter();assert(!ids.hubScreen.classList.contains('hidden'));
assert.equal(ids.accountName.textContent,'Log In / Sign Up');
app.start('marathon');app.saveSession();assert(!storage.has('tetrisPinasMarathon:guest'),'Visitors must not save games');
run('score=1234;lines=3;endGame()');assert(!storage.has('tetrisPinasProgress'),'Visitor history must not be saved');
app.go('home');assert(ids.unfinishedMatch.classList.contains('hidden'));assert(ids.homeHistory.innerHTML.includes('Log in'));
app.go('profile');assert(!ids.authScreen.classList.contains('hidden'),'Visitor profile opens login');
sandbox.tetrisServerUser={id:'test-player',name:'Tester'};app.enter();
assert.equal(ids.accountName.textContent,'Tester');
app.start('marathon');assert(!ids.gameScreen.classList.contains('hidden'));
assert.equal(run('board.length'),22,'Solo modes use the hidden spawn rows');
assert(run('queue.length>=5'),'Five next pieces stay queued');
const firstType=run('player.type');run('holdPiece()');assert.equal(run('heldType'),firstType);assert(run('holdUsed'));
const heldAfter=run('player.type');run('holdPiece()');assert.equal(run('player.type'),firstType,'Second hold restores the first held piece');assert.equal(run('heldType'),heldAfter,'Second hold stores the current piece');
assert.equal(run('Math.round(getDropInterval())'),500,'Marathon begins at two cells per second');
run('lines=9; board[21]=Array(COLS).fill("I"); clearLines()');
assert.equal(run('level'),2,'Marathon advances after ten lines');
assert(run('getDropInterval()')<500,'Gravity follows the level');
app.saveSession();assert(storage.has('tetrisPinasMarathon:test-player'),'Marathon state is saved');
app.tick(2000);assert.equal(ids.matchClock.textContent,'0:02');
app.go('home');assert(!ids.unfinishedMatch.classList.contains('hidden'),'Unfinished run appears in Recent games');assert(ids.unfinishedDetails.textContent.includes('Unfinished'));ids.resumeMatch.fire('click');assert(!run('paused'),'Recent games Resume returns to the game');
app.go('settings');assert(run('paused'));
app.tick(10000);assert.equal(ids.matchClock.textContent,'0:02','Pause should stop timer');
app.resume();assert(!run('paused'));
ids.openMatchMenu.fire('click');assert(ids.matchMenu.open);assert(run('paused'));
const oldX=run('player.x');for(const fn of document.listeners.keydown)fn({code:'ArrowLeft',key:'ArrowLeft',target:new Element(),preventDefault(){}});assert.equal(run('player.x'),oldX,'Modal should block game keys');
ids.menuResume.fire('click');assert(!ids.matchMenu.open);
run('score=5200; lines=12; endGame()');assert(!ids['page-results'].classList.contains('hidden'));
let saved=JSON.parse(storage.get('tetrisPinasProgress'));assert.equal(saved.matches.length,1);assert.equal(saved.matches[0].score,5200);
app.finish('topout');assert.equal(JSON.parse(storage.get('tetrisPinasProgress')).matches.length,1,'Result must not duplicate');
app.go('leaderboard');assert(ids.leaderboardList.innerHTML.includes('5,200'));assert(ids.leaderboardList.innerHTML.includes('Rating'));assert(ids.leaderboardList.innerHTML.includes('100<span class="rating-suffix"> / 100</span>'));assert(ids.leaderboardList.innerHTML.includes('Matches'));
app.start('sprint');run('lines=40; score=8000');assert(app.checkGoal());saved=JSON.parse(storage.get('tetrisPinasProgress'));assert(saved.matches.at(-1).success);
app.start('blitz');app.tick(120000);assert.equal(ids.resultTitle.textContent,"Time's up!");assert.equal(JSON.parse(storage.get('tetrisPinasProgress')).matches.at(-1).duration,120000);
app.start('practice');const y=run('player.y');for(let t=2000;t<12000;t+=100)run('update('+t+')');assert.equal(run('player.y'),y,'Practice must not auto-drop');run('playerDrop()');assert.equal(run('player.y'),y+1);
app.go('settings');ids.settingGhost.checked=false;ids.settingEffects.checked=false;ids.settingTheme.value='night';ids.settingsForm.fire('submit');assert(!app.settings.ghost);assert.equal(app.settings.buttons,false);assert.equal(app.settings.hints,false);assert(!html.includes('class="game-controls"'));assert(!html.includes('class="tip-card"'));assert.equal(document.body.dataset.theme,'night');
app.go('profile');ids.profileName.value='<Player>';ids.profileIcon.value='★';ids.profileForm.fire('submit');assert.equal(ids.accountName.textContent,'<Player>');assert.equal(JSON.parse(storage.get('tetrisPinasProgress')).profiles['test-player'].name,'<Player>');
app.resume();run('board=TetrisCore.createBoard();player=TetrisCore.makePiece("O")');
boardFrame.fire('pointermove',{pointerType:'mouse',clientX:199,clientY:100});assert.equal(run('player.x'),8,'Mouse reaches right wall without crossing it');
boardFrame.fire('pointermove',{pointerType:'mouse',clientX:0,clientY:100});assert.equal(run('player.x'),0,'Mouse reaches left wall');
run('board[2][2]="I"');boardFrame.fire('pointermove',{pointerType:'mouse',clientX:199,clientY:100});assert.equal(run('player.x'),0,'Mouse cannot jump through stacked blocks');
run('paused=true');boardFrame.fire('pointermove',{pointerType:'mouse',clientX:100,clientY:100});assert.equal(run('player.x'),0,'Mouse cannot move a paused piece');run('paused=false;board=createBoard()');
run('board=TetrisCore.createBoard();player=TetrisCore.makePiece("T")');
const mouseBefore=run('JSON.stringify(player.matrix)');boardFrame.fire('wheel',{deltaY:100});assert.notEqual(run('JSON.stringify(player.matrix)'),mouseBefore,'Mouse wheel rotates clockwise');boardFrame.fire('wheel',{deltaY:-100});assert.equal(run('JSON.stringify(player.matrix)'),mouseBefore,'Wheel up reverses rotation');
boardFrame.fire('pointermove',{pointerType:'mouse',clientX:65,clientY:350});assert.equal(run('player.x'),3,'Mouse points to the leftmost occupied column');
const boardBeforeMouseDrop=run('board.flat().filter(Boolean).length');boardFrame.fire('pointerdown',{isPrimary:true,pointerType:'mouse',button:0,pointerId:9,clientX:100,clientY:100});boardFrame.fire('pointerup',{pointerType:'mouse',pointerId:9,clientX:100,clientY:100});assert(run('board.flat().filter(Boolean).length')>boardBeforeMouseDrop,'Left mouse click hard drops and locks the piece');
run('syncMouseTarget()');assert.equal(run('player.x + Math.min(...player.matrix.flatMap(row=>row.flatMap((v,x)=>v?[x]:[])))'),5,'New piece follows click position without moving the mouse');
boardFrame.fire('pointerleave',{});const releasedX=run('player.x');run('player.x=Math.max(0,player.x-1);syncMouseTarget()');assert.equal(run('player.x'),Math.max(0,releasedX-1),'Leaving the board releases mouse targeting');
app.resume();run('player={type:"T",matrix:SHAPES.T.map(row=>[...row]),x:3,y:0}');const before=run('JSON.stringify(player.matrix)');boardFrame.fire('pointerdown',{isPrimary:true,pointerType:'touch',pointerId:1,clientX:20,clientY:20});boardFrame.fire('pointerup',{pointerId:1,clientX:20,clientY:20});assert.notEqual(run('JSON.stringify(player.matrix)'),before,'Tap should rotate');
document.hidden=true;for(const fn of document.listeners.visibilitychange)fn();assert(run('paused'),'Background tab must pause');
console.log('PASS: hidden-game freeze, guest home, start/resume, pause timer, modal keyboard isolation, single result persistence, leaderboard, Sprint completion, Blitz timer, Practice behavior, saved settings/profile, touch rotation, tab auto-pause.');

(() => {
    assert(!html.includes('intro-eagle'),'Intro contains no eagle');
    assert(html.includes('Assets/dashboard/intro-logo.png'),'Intro uses the supplied logo');
    const timers=[];
    sandbox.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length;};
    run('startAppIntro()');
    assert(!ids.introScreen.classList.contains('hidden'),'Static logo is visible');
    assert(ids.hubScreen.classList.contains('hidden'),'Dashboard waits for the logo');
    assert.equal(timers.length,1,'Intro has a single delay');
    assert.equal(timers[0].ms,3000,'Logo remains for three seconds');
    timers.shift().fn();
    assert(!ids.hubScreen.classList.contains('hidden'),'Dashboard opens after three seconds');
    assert(ids.authScreen.classList.contains('hidden'),'Login does not interrupt the intro');
    assert(ids.introScreen.classList.contains('hidden'),'Logo disappears immediately');
    assert.equal(timers.length,0,'No fade or animation delay');
    console.log('PASS: supplied static logo, three-second wait, immediate dashboard.');
})();
