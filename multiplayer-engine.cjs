'use strict';
const SHAPES = {
 I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], J:[[1,0,0],[1,1,1],[0,0,0]],
 L:[[0,0,1],[1,1,1],[0,0,0]], O:[[1,1],[1,1]], S:[[0,1,1],[1,1,0],[0,0,0]],
 T:[[0,1,0],[1,1,1],[0,0,0]], Z:[[1,1,0],[0,1,1],[0,0,0]]
};
function createGame(seed) {
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const game={board:Array.from({length:20},()=>Array(10).fill(null)),player:null,next:null,score:0,lines:0,level:1,over:false,drop:0,bag:[],random};
 spawn(game);return game;
}
function take(game) {
 if(!game.bag.length){game.bag=Object.keys(SHAPES);for(let i=6;i>0;i--){const j=Math.floor(game.random()*(i+1));[game.bag[i],game.bag[j]]=[game.bag[j],game.bag[i]];}}
 const type=game.bag.pop();return {type,matrix:SHAPES[type].map(r=>r.slice()),x:0,y:0};
}
function collides(game,matrix=game.player.matrix,x=game.player.x,y=game.player.y){
 for(let row=0;row<matrix.length;row++)for(let col=0;col<matrix[row].length;col++)if(matrix[row][col]){
  const bx=x+col,by=y+row;if(bx<0||bx>=10||by>=20||(by>=0&&game.board[by][bx]))return true;
 }return false;
}
function spawn(game){game.player=game.next||take(game);game.next=take(game);game.player.x=5-Math.ceil(game.player.matrix[0].length/2);game.player.y=0;if(collides(game))game.over=true;}
function lock(game){
 game.player.matrix.forEach((row,y)=>row.forEach((v,x)=>{if(v){const by=game.player.y+y;if(by<0)game.over=true;else game.board[by][game.player.x+x]=game.player.type;}}));
 let cleared=0;for(let y=19;y>=0;y--){if(game.board[y].every(Boolean)){game.board.splice(y,1);game.board.unshift(Array(10).fill(null));cleared++;y++;}}
 game.score+=[0,100,300,500,800][cleared]*game.level;game.lines+=cleared;game.level=1+Math.floor(game.lines/10);game.drop=0;
 if(!game.over&&game.lines<40)spawn(game);
}
function action(game,input){
 if(game.over||game.lines>=40)return;
 if(input==='left'||input==='right'){const direction=input==='left'?-1:1;if(!collides(game,game.player.matrix,game.player.x+direction))game.player.x+=direction;}
 else if(input==='rotate'){const matrix=game.player.matrix[0].map((_,i)=>game.player.matrix.map(row=>row[i]).reverse());for(const kick of [0,-1,1,-2,2])if(!collides(game,matrix,game.player.x+kick)){game.player.matrix=matrix;game.player.x+=kick;break;}}
 else if(input==='down'){if(!collides(game,game.player.matrix,game.player.x,game.player.y+1))game.player.y++;else lock(game);}
 else if(input==='drop'){let distance=0;while(!collides(game,game.player.matrix,game.player.x,game.player.y+1)){game.player.y++;distance++;}game.score+=distance*2;lock(game);}
}
function tick(game,delta){if(game.over||game.lines>=40)return;game.drop+=delta;const interval=Math.max(100,850-(game.level-1)*70);if(game.drop>=interval){game.drop-=interval;action(game,'down');}}
function snapshot(game){return {board:game.board,player:game.player,next:game.next,score:game.score,lines:game.lines,level:game.level,over:game.over};}
module.exports={createGame,action,tick,snapshot,collides,SHAPES};
