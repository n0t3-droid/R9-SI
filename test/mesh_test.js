// Mesher speed + size: the 16 sections of an overworld column, padded like the game does (VR.MESH_PAD blocks of the
// neighbour columns on every side). Two scenes: the plain land of seed 12345 at column 0,0 and the middle of the
// village "Nova Haven" (seed 12345, vgen 5, column 1,-13: ~1300 mini-voxel pieces on smooth ground).
// Times are the best of 5 runs (other processes on the machine only ever make a run slower): "cold" with an empty
// mini-voxel cache, "warm" right after. LOOK=classic|seamless picks the block look (default: the game's default).
const V=require('./load_shared.js');
if(process.env.LOOK&&V.setLook)V.setLook(process.env.LOOK);
const PAD=V.MESH_PAD||1, PS=V.MESH_PS||18, PSS=PS*PS;
function scene(name, opts, CX, CZ){
  const g=V.makeGen('overworld', 12345, opts);
  const cols={};
  for(let cz=-1;cz<=1;cz++)for(let cx=-1;cx<=1;cx++){const c=g.generate(CX+cx,CZ+cz); c.light=V.computeColumnLight(c.blocks,true); cols[cx+','+cz]=c;}
  function pad(sy){
    const blocks=new Uint16Array(PSS*PS), light=new Uint16Array(PSS*PS);
    const gr=new Uint16Array(PSS), fo=new Uint16Array(PSS), wa=new Uint16Array(PSS);
    for(let y=-PAD;y<16+PAD;y++)for(let z=-PAD;z<16+PAD;z++)for(let x=-PAD;x<16+PAD;x++){
      const wy=sy*16+y; const cx=Math.floor(x/16), cz=Math.floor(z/16); const c=cols[cx+','+cz];
      const lx=((x%16)+16)%16, lz=((z%16)+16)%16;
      const pi=(y+PAD)*PSS+(z+PAD)*PS+(x+PAD);
      if(y===0){gr[(z+PAD)*PS+x+PAD]=c.tints.grass[lz*16+lx];fo[(z+PAD)*PS+x+PAD]=c.tints.foliage[lz*16+lx];wa[(z+PAD)*PS+x+PAD]=c.tints.water[lz*16+lx];}
      if(wy<0||wy>255){blocks[pi]=0; light[pi]=wy>255?0xf000:0; continue;}
      const i=(wy<<8)|(lz<<4)|lx; blocks[pi]=c.blocks[i]; light[pi]=c.light[i];
    }
    return {blocks,light,grass:gr,foliage:fo,water:wa,sy,ox:CX*16,oz:CZ*16,smooth:true,fancyLeaves:true,vxLod:true};
  }
  const jobs=[]; for(let sy=0;sy<16;sy++) jobs.push(pad(sy));
  let cold=1e9, warm=1e9, painted=0; const tot=[0,0,0,0];
  for(let k=0;k<5;k++){
    if(V.VX&&V.VX.clearCache){V.VX.clearCache(); V.VX.stats.miss=0;}
    let t0=performance.now();
    for(let sy=0;sy<16;sy++){const r=V.meshSection(jobs[sy]); if(!k){tot[0]+=r.opaque.length/8; tot[1]+=r.cutout.length/8; tot[2]+=r.trans.length/8; tot[3]+=r.vx?r.vx.length/8:0;}}
    cold=Math.min(cold,performance.now()-t0); painted=V.VX?V.VX.stats.miss:0;
    t0=performance.now(); for(let sy=0;sy<16;sy++)V.meshSection(jobs[sy]); warm=Math.min(warm,performance.now()-t0);
  }
  console.log(`${name}: look ${(V.LOOK&&V.LOOK.mode)||'(none)'} · mesh 16 sections ${cold.toFixed(0)} ms cold / ${warm.toFixed(0)} ms warm (best of 5) · ${painted} VX pieces painted · verts [opaque, cutout, trans, vx] ${JSON.stringify(tot)}`);
}
scene('land 0,0', {}, 0, 0);
scene('village 1,-13', {vgen:5}, 1, -13);
