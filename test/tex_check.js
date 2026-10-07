const V=require('./load_shared.js');
require('../src/main/tex_core.js');require('../src/main/tex_recipes1.js');require('../src/main/tex_recipes2.js');
// the same texture modules as the main bundle in build.js (a module that is missing is a load error, not a skip)
require('../src/main/tex_recipes3.js');require('../src/main/tex_recipes4.js');require('../src/main/tex_recipes5.js');require('../src/main/tex_recipes6.js');require('../src/main/tex_items.js');require('../src/main/tex_groceries.js');require('../src/main/tex_vox.js');
const R=V.R, REC=V.TEXREC, PRE=V.TEXPRE;
const missing=[], errs=[];
for(const n of R.texNames){
  let fn=null;
  if(REC[n]) fn=()=>REC[n]();
  else { const base=n.split('#')[0]; const fr=n.includes('#')?+n.split('#')[1]:0;
    if(REC[base]) fn=()=>REC[base](fr);
    else { const p=base.split(':'); if(PRE[p[0]]) fn=()=>PRE[p[0]](...p.slice(1),fr); } }
  if(!fn){missing.push(n);continue;}
  try{const img=fn(); if(!img||!img.c) errs.push(n+' -> no img');}catch(e){errs.push(n+' -> '+e.message);}
}
console.log('total',R.texNames.length,'missing',missing.length,'errors',errs.length);
console.log(missing.join(' '));
console.log(errs.slice(0,50).join('\n'));
const bad=missing.length+errs.length;
console.log(bad?'FAILED '+bad:'ALL OK');
process.exit(bad?1:0);
