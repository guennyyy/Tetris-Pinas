'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createMultiplayerServer}=require('./server.cjs');
const engine=require('./multiplayer-engine.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const one=engine.createGame(12345),two=engine.createGame(12345);
 assert.deepEqual(engine.snapshot(one),engine.snapshot(two),'Same seed must give both players the same pieces');
 for(let i=0;i<3;i++){engine.action(one,'drop');engine.action(two,'drop');assert.deepEqual(engine.snapshot(one),engine.snapshot(two));}
 const game=engine.createGame(9);game.player={type:'O',matrix:[[1,1],[1,1]],x:4,y:0};for(const y of [20,21])for(let x=0;x<10;x++)game.board[y][x]=x===4||x===5?null:'I';engine.action(game,'drop');assert.equal(game.lines,2);assert.equal(game.score,1540);assert.equal(game.over,false);
 const goal=engine.createGame(9);goal.lines=38;goal.player={type:'O',matrix:[[1,1],[1,1]],x:4,y:0};for(const y of [20,21])for(let x=0;x<10;x++)goal.board[y][x]=x===4||x===5?null:'I';engine.action(goal,'drop');assert.equal(goal.lines,40);const frozen=JSON.stringify(engine.snapshot(goal));engine.action(goal,'drop');engine.tick(goal,5000);assert.equal(JSON.stringify(engine.snapshot(goal)),frozen,'Completed race must stop accepting inputs');
 const topout=engine.createGame(1);for(let x=0;x<10;x++)topout.board[0][x]='Z';for(let i=0;i<20&&!topout.over;i++)engine.action(topout,'drop');assert(topout.over,'Blocked spawn must top out');
 const wall=engine.createGame(1);for(let i=0;i<20;i++)engine.action(wall,'left');assert(!engine.collides(wall));
 let now=10000;
 const accountFile=path.join(os.tmpdir(),`tetris-accounts-test-${crypto.randomUUID()}.json`);
 const app=createMultiplayerServer({now:()=>now,countdown:3000,disconnectGrace:1000,accountFile});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 const clients=[];
 async function client(name){
  const response=await fetch(base+'/api/session');const initial=await response.json();const cookie=response.headers.get('set-cookie').split(';')[0];
  assert.notEqual(initial.self.id,cookie.slice(14),'Public player ID must not expose a session token');
  const controller=new AbortController();const stream=await fetch(base+'/api/events',{headers:{Cookie:cookie},signal:controller.signal});assert.equal(stream.status,200);
  const c={cookie,id:initial.self.id,messages:[],controller};clients.push(c);
  const reader=stream.body.getReader();const decoder=new TextDecoder();let buffer='';
  (async()=>{try{while(true){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});let index;while((index=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,index);buffer=buffer.slice(index+2);if(frame.startsWith('data: '))c.messages.push(JSON.parse(frame.slice(6)));}}}catch{}})();
  c.post=async(endpoint,data={},extra={})=>{const res=await fetch(base+'/api/'+endpoint,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-Tetris-Request':'1',...extra},body:JSON.stringify(data)});return {status:res.status,body:await res.json()};};
  c.wait=async(predicate)=>{for(let tries=0;tries<100;tries++){const match=c.messages.slice().reverse().find(predicate);if(match)return match;await delay(10);}throw new Error('Timed out waiting for live update');};
  await c.wait(m=>m.self.id===c.id);assert.equal((await c.post('profile',{name})).status,200);return c;
 }
 try{
  const page=await fetch(base+'/');assert.equal(page.status,200);
  const html=await page.text();
  for(const match of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
   const response=await fetch(base+'/'+match[1]);assert.equal(response.status,200,'Linked stylesheet must be served: '+match[1]);
   assert(response.headers.get('content-type').startsWith('text/css'),'Stylesheet MIME type: '+match[1]);
   assert((await response.text()).length>0,'Stylesheet must contain styles: '+match[1]);
  }
  const a=await client('Ana'),b=await client('Ben'),outsider=await client('Other');
  const signup=await a.post('signup',{email:'ana@gmail.com',password:'secure-pass-123',name:'Ana'});assert.equal(signup.status,200);assert(signup.body.user.id);assert(!JSON.stringify(signup.body).includes('passwordHash'));
  assert.equal((await a.post('logout')).status,200);
  assert.equal((await a.post('login',{email:'ana@gmail.com',password:'wrong-password'})).status,401);
  assert.equal((await a.post('login',{email:'ana@gmail.com',password:'secure-pass-123'})).status,200);
  const presenceResponse=await fetch(base+'/api/people',{headers:{Cookie:a.cookie}});
  assert.equal(presenceResponse.status,200);
  const presence=await presenceResponse.json();
  assert.deepEqual(new Set(presence.players.map(p=>p.name)),new Set(['Ben','Other']),'Dashboard presence lists other connected players by their saved names');
  assert(!presence.players.some(p=>p.id===a.id),'Dashboard presence excludes the current player');
  const created=await a.post('create');assert.equal(created.status,200);const code=created.body.code;
  assert.equal((await b.post('join',{code})).status,200);
  assert.equal((await outsider.post('join',{code})).status,409,'Room must reject a third player');
  assert.equal((await b.post('action',{action:'drop'})).status,409,'Countdown must reject gameplay');
  const countdownState=await a.wait(m=>m.room?.status==='countdown');assert.equal(countdownState.room.players.length,2);
  assert.deepEqual(countdownState.room.players[0].state,countdownState.room.players[1].state);
  now+=3001;app.step();await a.wait(m=>m.room?.status==='playing');
  assert.equal((await a.post('action',{action:'drop',score:999999,lines:40})).status,200);
  const snapshot=await b.wait(m=>m.room?.players.some(p=>p.id===a.id&&p.state.score>0));assert(snapshot.room.players.find(p=>p.id===a.id).state.score<999999,'Client score must be ignored');
  assert.equal((await outsider.post('action',{action:'drop'})).status,409,'Outsider cannot control a room');
  assert.equal((await a.post('action',{action:'drop'},{Origin:'https://evil.example'})).status,403);
  assert.equal((await fetch(base+'/server.cjs')).status,404,'Backend source must not be served');
  assert.equal((await fetch(base+'/tetris-core.js')).status,200,'Shared browser rules must be served');
  assert.equal((await fetch(base+'/.tetris-accounts.json')).status,404,'Account records must not be served');
  assert.equal((await fetch(base+'/.git/config')).status,404);
  assert.equal((await b.post('leave')).status,200);const result=await a.wait(m=>m.room?.status==='finished');assert.equal(result.room.winner,a.id);assert.equal(result.room.reason,'forfeit');assert.equal(result.room.xpAwards[a.id]||0,0,'Forfeits do not grant farmable online XP');
  await a.post('leave');
  assert.equal((await a.post('matchmake')).status,200);await a.wait(m=>m.room?.visibility==='public'&&m.room.status==='waiting');
  assert.equal((await b.post('matchmake')).status,200);const publicMatch=await a.wait(m=>m.room?.visibility==='public'&&m.room.status==='countdown');assert(publicMatch.room.players.some(p=>p.id===b.id));
  await a.post('leave');await b.post('leave');
  assert.equal((await outsider.post('matchmake')).status,200);assert.equal((await outsider.post('leave')).status,200);await outsider.wait(m=>m.room===null);
  const next=await a.post('create');await b.post('join',{code:next.body.code});now+=3001;app.step();await a.wait(m=>m.room?.code===next.body.code&&m.room.status==='playing');
  b.controller.abort();await delay(30);now+=1001;app.step();const dc=await a.wait(m=>m.room?.code===next.body.code&&m.room.status==='finished');assert.equal(dc.room.winner,a.id);assert.equal(dc.room.reason,'disconnect');
  console.log('PASS: shared sequence, scoring/collision engine, private room join, capacity, countdown, live opponent updates, server-controlled scores, session-token privacy, room isolation, request-origin checks, static-file restrictions, forfeit, public matchmaking, queue cancellation, disconnect timeout.');
 }finally{clients.forEach(c=>c.controller.abort());await app.close();fs.rmSync(accountFile,{force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
