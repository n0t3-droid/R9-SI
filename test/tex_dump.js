const V=require('./load_shared.js');
for (const f of ['tex_core','tex_recipes1','tex_recipes2','tex_recipes3','tex_items','tex_layout','tex_build']) require('../src/main/'+f+'.js');
const R=V.R;
const L=R.texNames.length;
const cube=new Uint8Array(L), cut=new Uint8Array(L);
const T=R.T;
for(let s=0;s<T.shape.length;s++){ if(T.shape[s]===V.SHAPE.CUBE && T.layer[s]===0) for(let f=0;f<6;f++) cube[T.tex[s*6+f]&0xfff]=1; if(T.layer[s]===1) for(let f=0;f<6;f++) cut[T.tex[s*6+f]&0xfff]=1; }
const t0=Date.now();
const out=V.buildTextureArrays({names:R.texNames,cubeMask:cube,cutoutMask:cut,bevel:1});
console.log('built',L,'layers in',Date.now()-t0,'ms; missing',out.missing.length);
require('fs').writeFileSync('/tmp/claude-0/-home-claude/faf7c5c5-3403-55c6-865b-eb66c7edd5f9/scratchpad/tex0.bin',Buffer.from(out.albedo[0].buffer));
require('fs').writeFileSync('/tmp/claude-0/-home-claude/faf7c5c5-3403-55c6-865b-eb66c7edd5f9/scratchpad/texnames.json',JSON.stringify(R.texNames));
