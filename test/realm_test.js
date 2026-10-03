const V=require('./load_shared.js');
const R=V.R;
const seed=+(process.argv[2]||12345);
const g=V.makeGen('overworld',seed,{});
let t0=Date.now();
const sp=g.findSpawn();
console.log('spawn',sp.map(v=>Math.round(v)),'in',Date.now()-t0,'ms', V.BIOMES[g.biomeFor(g.climateAt(Math.floor(sp[0]),Math.floor(sp[2])),Math.floor(sp[1]))].name);
const count={};
t0=Date.now();
const cx0=Math.floor(sp[0])>>4, cz0=Math.floor(sp[2])>>4;
let n=0; const bio={};
for(let dz=-6;dz<=6;dz++)for(let dx=-6;dx<=6;dx++){
  const out=g.generate(cx0+dx,cz0+dz); n++;
  for(let i=0;i<65536;i++){const s=out.blocks[i]; if(!s) continue; const t=R.types[R.T.type[s]]; if(/crystal|aether|lava|hull|landing|turret|thruster|helm|ochre|duskrock/.test(t.name)) count[t.name]=(count[t.name]||0)+1;}
  for(let i=0;i<256;i++){const b=V.BIOMES[out.biome[i]].key; bio[b]=(bio[b]||0)+1;}
}
console.log('gen',n,'columns in',Date.now()-t0,'ms =',((Date.now()-t0)/n).toFixed(1),'ms/col');
console.log(count);
console.log(bio);
// find nearest outpost site
for (let r=0;r<4;r++) for(let i=-r;i<=r;i++) for(let j=-r;j<=r;j++){ }
