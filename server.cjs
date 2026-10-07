'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const engine=require('./multiplayer-engine.cjs');
function createMultiplayerServer(options={}) {
 const sessions=new Map(),players=new Map(),rooms=new Map(),ipLimits=new Map();
 const root=__dirname;
 const allowedFiles=new Set(['index.html','style.css','app.css','app.js','game.js','online.js','background.jfif','bg-fiesta.svg']);
 const clock=options.now||Date.now;
 const grace=options.disconnectGrace||30000;
 const countdown=options.countdown??3000;
 const id=()=>crypto.randomBytes(24).toString('hex');
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const error=(status,message)=>Object.assign(new Error(message),{status});
 function roomOf(s){return rooms.get(s.room);}
 function payload(s){const room=roomOf(s);return {self:{id:s.id,name:s.name},connected:true,online:[...sessions.values()].filter(p=>p.stream).length,room:room?{
  code:room.code,visibility:room.visibility,status:room.status,startAt:room.startAt,now:clock(),winner:room.winner,reason:room.reason,
  players:room.players.map(sid=>{const p=players.get(sid);return {id:sid,name:p.name,connected:!!p.stream,state:room.games?.[sid]?engine.snapshot(room.games[sid]):null};})
 }:null};}
 function emit(s){if(s?.stream&&!s.stream.destroyed){if(s.stream.writableLength>262144){s.stream.destroy();return;}s.stream.write(`data: ${JSON.stringify(payload(s))}\n\n`);}}
 function broadcast(room){for(const sid of room.players)emit(players.get(sid));}
 function finish(room,winner,reason){if(room.status==='finished')return;room.status='finished';room.winner=winner;room.reason=reason;room.finishedAt=clock();broadcast(room);}
 function resolve(room){if(room.status!=='playing')return;for(const sid of room.players){const game=room.games[sid];if(game.lines>=40){finish(room,sid,'40-lines');return;}if(game.over){finish(room,room.players.find(p=>p!==sid),'topout');return;}}}
 function leave(s){const room=roomOf(s);if(room){if(room.status==='playing'||room.status==='countdown')finish(room,room.players.find(p=>p!==s.id)||null,'forfeit');else if(room.status==='waiting'){rooms.delete(room.code);}}
  s.room=null;emit(s);
 }
 function join(s,room){if(room.status!=='waiting'||room.players.length!==1)throw error(409,'This room is already full or has started.');if(room.players.includes(s.id))throw error(409,'You are already in this room.');
  const host=players.get(room.players[0]);if(!host?.stream)throw error(409,'The room owner is disconnected. Try again shortly.');
  room.players.push(s.id);s.room=room.code;const seed=crypto.randomBytes(4).readUInt32LE();room.games=Object.fromEntries(room.players.map(sid=>[sid,engine.createGame(seed)]));room.status='countdown';room.startAt=clock()+countdown;room.lastTick=room.startAt;broadcast(room);
 }
 function makeRoom(s,visibility){if(rooms.size>=500)throw error(503,'The server is full. Please try again later.');let code;do{code=crypto.randomBytes(4).toString('hex').slice(0,7).toUpperCase();}while(rooms.has(code));
  const room={code,visibility,status:'waiting',players:[s.id],startAt:null,created:clock(),winner:null,reason:null};rooms.set(code,room);s.room=code;emit(s);return room;
 }
 function step(){const now=clock();for(const room of rooms.values()){
  if(room.status==='finished'){if(now-room.finishedAt>600000){for(const sid of room.players){const s=players.get(sid);if(s?.room===room.code){s.room=null;emit(s);}}rooms.delete(room.code);}continue;}
  const disconnected=room.players.find(sid=>{const s=players.get(sid);return !s.stream&&now-s.disconnectedAt>=grace;});
  if(disconnected){if(room.status==='waiting'){rooms.delete(room.code);players.get(disconnected).room=null;}else finish(room,room.players.find(sid=>sid!==disconnected&&players.get(sid)?.stream)||null,'disconnect');continue;}
  if(room.status==='countdown'&&now>=room.startAt){room.status='playing';room.lastTick=room.startAt;broadcast(room);}
  if(room.status==='playing'){
   const delta=Math.min(1000,Math.max(0,now-room.lastTick));room.lastTick=now;
   room.players.forEach(sid=>engine.tick(room.games[sid],delta));resolve(room);
   if(room.status==='playing'&&now-(room.broadcastAt||0)>=100){room.broadcastAt=now;broadcast(room);}
  }
 }
 for(const [token,s] of sessions){if(!s.stream&&!s.room&&now-s.lastSeen>86400000){sessions.delete(token);players.delete(s.id);}}
 for(const [ip,limit] of ipLimits)if(now-limit.at>60000)ipLimits.delete(ip);
 }
 async function body(req){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw error(415,'Use JSON requests.');let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>4096)throw error(413,'Request is too large.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw error(400,'Invalid JSON.');}}
 const server=http.createServer(async(req,res)=>{
  try{
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/health'){json(res,200,{ok:true});return;}
   if(!url.pathname.startsWith('/api/')){
    if(req.method!=='GET'&&req.method!=='HEAD')throw error(405,'Method not allowed.');
    const file=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!allowedFiles.has(file))throw error(404,'Not found.');
    const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.jfif':'image/jpeg','.svg':'image/svg+xml'};
    res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-cache'});if(req.method==='HEAD')res.end();else fs.createReadStream(path.join(root,file)).pipe(res);return;
   }
   const ip=req.socket.remoteAddress;const limit=ipLimits.get(ip)||{at:clock(),count:0};if(clock()-limit.at>60000){limit.at=clock();limit.count=0;}limit.count++;ipLimits.set(ip,limit);if(limit.count>6000)throw error(429,'Too many requests. Try again shortly.');
   let token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('tetrisSession='))?.slice(14);
   let s=sessions.get(token);
   if(req.method==='GET'&&url.pathname==='/api/session'){
    if(!s){if(sessions.size>=2000)throw error(503,'The server is full.');token=id();s={id:crypto.randomUUID(),name:'Player',room:null,stream:null,lastSeen:clock(),disconnectedAt:clock(),actionWindow:0,actions:0};sessions.set(token,s);players.set(s.id,s);res.setHeader('Set-Cookie',`tetrisSession=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.NODE_ENV==='production'?'; Secure':''}`);}
    s.lastSeen=clock();json(res,200,payload(s));return;
   }
   if(!s)throw error(401,'Open the online lobby first.');s.lastSeen=clock();
   if(req.method==='GET'&&url.pathname==='/api/events'){
    if(s.stream){json(res,409,{error:'This player is already connected in another tab. Use a different browser or private window for player two.'});return;}
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();s.stream=res;emit(s);
    const heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': heartbeat\n\n');},10000);
    res.on('close',()=>{clearInterval(heartbeat);if(s.stream===res){s.stream=null;s.disconnectedAt=clock();}});return;
   }
   if(req.method!=='POST')throw error(404,'Not found.');
   const origin=req.headers.origin;const allowedOrigin=process.env.PUBLIC_ORIGIN;
   if(origin&&origin!==(allowedOrigin||`http://${req.headers.host}`))throw error(403,'Request origin is not allowed.');
   if(req.headers['x-tetris-request']!=='1')throw error(403,'Missing request header.');
   const data=await body(req);
   if(!data||typeof data!=='object'||Array.isArray(data))throw error(400,'Request must be a JSON object.');
   if(url.pathname==='/api/profile'){if(roomOf(s)?.status==='playing')throw error(409,'Change your name after the match.');s.name=String(data.name||'Player').trim().slice(0,24)||'Player';emit(s);json(res,200,{ok:true});return;}
   if(url.pathname==='/api/leave'){leave(s);json(res,200,{ok:true});return;}
   if(!s.stream)throw error(409,'The live connection is not ready. Please reconnect.');
   if(url.pathname==='/api/action'){
    const room=roomOf(s);if(!room||room.status!=='playing')throw error(409,'The match is not playing yet.');if(!['left','right','rotate','down','drop'].includes(data.action))throw error(400,'Unknown action.');
    if(clock()-s.actionWindow>=1000){s.actions=0;s.actionWindow=clock();}if(++s.actions>60)throw error(429,'Input limit reached.');engine.action(room.games[s.id],data.action);resolve(room);broadcast(room);json(res,200,{ok:true});return;
   }
   if(roomOf(s)&&roomOf(s).status!=='finished')throw error(409,'Leave your current room first.');
   if(s.room)leave(s);
   if(url.pathname==='/api/create'){const room=makeRoom(s,'private');json(res,200,{code:room.code});return;}
   if(url.pathname==='/api/join'){const code=String(data.code||'').trim().toUpperCase();const room=rooms.get(code);if(!room||room.visibility!=='private')throw error(404,'Room not found. Check the invite code.');join(s,room);json(res,200,{code});return;}
   if(url.pathname==='/api/matchmake'){const waiting=[...rooms.values()].find(r=>r.visibility==='public'&&r.status==='waiting'&&r.players[0]!==s.id&&players.get(r.players[0])?.stream);if(waiting)join(s,waiting);else makeRoom(s,'public');json(res,200,{ok:true});return;}
   throw error(404,'Not found.');
  }catch(err){if(!res.headersSent)json(res,err.status||500,{error:err.status?err.message:'Server error. Please try again.'});else res.end();}
 });
 const timer=setInterval(step,50);timer.unref();
 server.on('close',()=>clearInterval(timer));
 function close(){for(const s of sessions.values())s.stream?.end();clearInterval(timer);return new Promise(resolve=>server.close(resolve));}
 return {server,close,step};
}
if(require.main===module){const app=createMultiplayerServer();const port=Number(process.env.PORT||3000);app.server.listen(port,'0.0.0.0',()=>console.log(`Tetris Pinas: http://localhost:${port} (use your computer's Wi-Fi IP on phones)`));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit()));}
module.exports={createMultiplayerServer};
