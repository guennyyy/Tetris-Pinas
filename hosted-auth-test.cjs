'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {createMultiplayerServer}=require('./server.cjs');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tetris-hosted-'));
 const accountFile=path.join(folder,'nested','accounts.json');
 let app;
 async function start(file=accountFile){app=createMultiplayerServer({accountFile:file,publicOrigin:'https://custom.example/',renderExternalUrl:'https://game.onrender.com'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;const session=await fetch(base+'/api/session');const cookie=session.headers.get('set-cookie').split(';')[0];return async(endpoint,origin='https://game.onrender.com')=>{const r=await fetch(base+'/api/'+endpoint,{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-Tetris-Request':'1'},body:JSON.stringify({email:'hosted@gmail.com',password:'valid-pass-123',name:'Hosted'})});return {status:r.status,body:await r.json()};};}
 try {
  let post=await start();assert.equal((await post('signup')).status,200,'Render automatic origin accepted');assert(fs.existsSync(accountFile),'Missing storage folder created');
  assert.equal((await post('login','https://custom.example')).status,200,'Configured origin normalized');
  assert.equal((await post('login','https://evil.example')).status,403,'Foreign origins rejected');
  await app.close();post=await start();assert.equal((await post('login')).status,200,'Accounts survive restart on persistent file');await app.close();
  const blocked=path.join(folder,'file');fs.writeFileSync(blocked,'not a directory');post=await start(path.join(blocked,'accounts.json'));const failed=await post('signup');assert.equal(failed.status,503);assert.match(failed.body.error,/storage/);assert.equal((await post('signup')).status,503,'Failed save does not leave a phantom duplicate account');
 } finally {await app?.close();fs.rmSync(folder,{recursive:true,force:true});}
 const source=fs.readFileSync('game.js','utf8');const functions=source.slice(source.indexOf('async function waitForAuth'),source.indexOf('function signInWithProvider'));
 const context={Promise,Error,setTimeout,clearTimeout,authSubmit:{disabled:false,textContent:'LOG IN'},authMessage:{textContent:''},authEmailInput:{value:'user@gmail.com'},authPasswordInput:{value:'valid-pass-123'},displayNameInput:{value:'Player'},authMode:'login',firebaseReady:true,showLoginBtn:{},showSignupBtn:{},window:{location:{protocol:'https:'}},isGmail:e=>e.endsWith('@gmail.com'),requestAnimationFrame(){},fitAuthPanel(){},handleErrorMessage(code){context.authMessage.textContent=code;},showGameScreen(){context.entered=true;}};
 let resolveAuth;context.firebase={auth:()=>({signInWithEmailAndPassword:()=>new Promise(r=>{resolveAuth=r;})})};vm.createContext(context);vm.runInContext(functions,context);
 const pending=vm.runInContext('handleAuthSubmit({preventDefault(){}})',context);assert.equal(context.authSubmit.disabled,true);assert.match(context.authMessage.textContent,/Signing in/);resolveAuth({user:{}});await pending;assert(context.entered);assert.equal(context.authSubmit.disabled,false);
 context.firebase={auth:()=>({signInWithEmailAndPassword:()=>Promise.reject({code:'auth/operation-not-allowed'})})};await vm.runInContext('handleAuthSubmit({preventDefault(){}})',context);assert.equal(context.authMessage.textContent,'auth/operation-not-allowed');assert.equal(context.authSubmit.disabled,false);
 console.log('PASS: Render origins, custom origin normalization, foreign-origin rejection, persistent accounts, storage errors, and visible Firebase login progress/failure.');
})().catch(error=>{console.error(error);process.exitCode=1;});
