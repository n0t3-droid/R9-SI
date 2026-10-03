const V=require('./load_shared.js');
const g=V.makeGen('overworld', 12345, {});
const cols={};
for(let cz=-1;cz<=1;cz++)for(let cx=-1;cx<=1;cx++){const c=g.generate(cx,cz); c.light=V.computeColumnLight(c.blocks,true); cols[cx+','+cz]=c;}
function pad(sy){
  const blocks=new Uint16Array(5832), light=new Uint16Array(5832);
  const gr=new Uint16Array(324), fo=new Uint16Array(324), wa=new Uint16Array(324);
  for(let y=-1;y<17;y++)for(let z=-1;z<17;z++)for(let x=-1;x<17;x++){
    const wy=sy*16+y; const cx=Math.floor(x/16), cz=Math.floor(z/16); const c=cols[cx+','+cz];
    const lx=((x%16)+16)%16, lz=((z%16)+16)%16;
    const pi=(y+1)*324+(z+1)*18+(x+1);
    if(wy<0||wy>255){blocks[pi]=0; light[pi]=wy>255?0xf000:0; continue;}
    const i=(wy<<8)|(lz<<4)|lx; blocks[pi]=c.blocks[i]; light[pi]=c.light[i];
    if(y===0){gr[(z+1)*18+x+1]=c.tints.grass[lz*16+lx];fo[(z+1)*18+x+1]=c.tints.foliage[lz*16+lx];wa[(z+1)*18+x+1]=c.tints.water[lz*16+lx];}
  }
  return {blocks,light,grass:gr,foliage:fo,water:wa,sy,ox:0,oz:0};
}
let t0=Date.now(); let tot=[0,0,0];
for(let sy=0;sy<16;sy++){const r=V.meshSection(pad(sy)); tot[0]+=r.opaque.length/8; tot[1]+=r.cutout.length/8; tot[2]+=r.trans.length/8; if(sy===4)console.log('vis',r.vis.toString(2));}
console.log('mesh 16 sections ms',Date.now()-t0,'verts',tot);
t0=Date.now();
for(let k=0;k<3;k++)for(let sy=0;sy<16;sy++)V.meshSection(pad(sy));
console.log('x3 ms',Date.now()-t0);
