'use strict';
const core = require('./tetris-core.js');
function createGame(seed) {
    let randomState = seed >>> 0;
    const random = () => { randomState = (Math.imul(randomState,1664525)+1013904223)>>>0; return randomState/4294967296; };
    const game = {board:core.createBoard(),player:null,queue:[],heldType:null,holdUsed:false,score:0,lines:0,level:1,over:false,drop:0,lockElapsed:0,lockResets:0,combo:-1,backToBack:false,random};
    spawn(game);
    return game;
}
function take(game) {
    core.ensureQueue(game.queue,6,game.random);
    return core.makePiece(game.queue.shift());
}
function collides(game,matrix=game.player.matrix,x=game.player.x,y=game.player.y) { return core.collides(game.board,matrix,x,y); }
function spawn(game) {
    game.player=take(game);
    game.holdUsed=false;
    game.lockElapsed=0;game.lockResets=0;
    if(collides(game))game.over=true;
}
function lock(game) {
    if(game.over||game.lines>=40)return;
    const tSpin=core.isTSpin(game.board,game.player);
    let hidden=false;
    game.player.matrix.forEach((row,y)=>row.forEach((v,x)=>{
        if(!v)return;
        const by=game.player.y+y;
        game.board[by][game.player.x+x]=game.player.type;
        if(by<core.HIDDEN_ROWS)hidden=true;
    }));
    const count=core.clearLines(game.board).length;
    game.combo=count?game.combo+1:-1;
    const perfect=count>0&&game.board.every(row=>row.every(cell=>cell===null));
    const result=core.scoreClear({count,level:game.level,tSpin,backToBack:game.backToBack,combo:game.combo,perfectClear:perfect});
    game.score+=result.points;
    if(count)game.backToBack=result.difficult;
    game.lines+=count;
    game.drop=0;
    if(hidden)game.over=true;
    if(!game.over&&game.lines<40)spawn(game);
}
function action(game,input,column) {
    if(game.over||game.lines>=40)return;
    const p=game.player;
    if(input==='moveTo'){
        if(!Number.isInteger(column)||column<0||column>=core.WIDTH)return;
        const cells=p.matrix.flatMap(row=>row.flatMap((v,x)=>v?[x]:[]));
        const target=column-Math.min(...cells);
        for(let i=0;i<core.WIDTH&&game.player.x!==target;i++){const before=game.player.x;action(game,target>before?'right':'left');if(game.player.x===before)break;}
        return;
    }
    if(input==='left'||input==='right'){
        const dx=input==='left'?-1:1,grounded=collides(game,p.matrix,p.x,p.y+1);
        if(!collides(game,p.matrix,p.x+dx,p.y)){
            p.x+=dx;p.lastRotation=false;
            if(grounded&&game.lockResets<15){game.lockElapsed=0;game.lockResets++;}
            if(!collides(game,p.matrix,p.x,p.y+1))game.lockElapsed=0;
        }
    } else if(input==='rotate'||input==='rotateCCW'){
        const grounded=collides(game,p.matrix,p.x,p.y+1);
        const rotated=core.rotate(game.board,p,input==='rotate');
        if(rotated){
            game.player=rotated;
            if(grounded&&game.lockResets<15){game.lockElapsed=0;game.lockResets++;}
            if(!collides(game,rotated.matrix,rotated.x,rotated.y+1))game.lockElapsed=0;
        }
    } else if(input==='down'){
        if(!collides(game,p.matrix,p.x,p.y+1)){p.y++;p.lastRotation=false;game.score++;game.lockElapsed=0;}
    } else if(input==='drop'){
        let distance=0;
        while(!collides(game,p.matrix,p.x,p.y+1)){p.y++;distance++;}
        game.score+=distance*2;lock(game);
    } else if(input==='hold'){
        const previous=game.heldType;
        game.heldType=p.type;
        if(previous){
            game.player=core.makePiece(previous);
            game.lockElapsed=0;game.lockResets=0;
            if(collides(game))game.over=true;
        }else spawn(game);
        game.holdUsed=true;
    }
}
function tick(game,delta) {
    if(game.over||game.lines>=40)return;
    game.drop+=Math.max(0,delta);
    let steps=0;
    const interval=core.getGravityMs(1);
    while(game.drop>=interval&&steps++<1000){
        game.drop-=interval;
        if(collides(game,game.player.matrix,game.player.x,game.player.y+1)){game.drop=0;break;}
        game.player.y++;
        game.player.lastRotation=false;
    }
    if(collides(game,game.player.matrix,game.player.x,game.player.y+1)){
        game.lockElapsed+=Math.max(0,delta);
        if(game.lockElapsed>=500)lock(game);
    } else game.lockElapsed=0;
}
function snapshot(game) {
    return {board:game.board,player:game.player,next:core.makePiece(game.queue[0]),queue:game.queue.slice(0,5),heldType:game.heldType,holdUsed:game.holdUsed,score:game.score,lines:game.lines,level:game.level,over:game.over};
}
module.exports={createGame,action,tick,snapshot,collides,SHAPES:core.SHAPES};
