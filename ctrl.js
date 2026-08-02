const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://local/',
 beforeParse(w){w.URL.createObjectURL=()=>'blob:test';w.URL.revokeObjectURL=()=>{};w.Element.prototype.scrollIntoView=function(){};}});
setTimeout(()=>{
 const w=dom.window,d=w.document;
 const mods=Object.keys(w.MODULES);
 let manquants=[];
 mods.forEach(m=>{
   w.MODULES[m].vues.forEach(v=>{ if(!w.PICTOS[v[0]]) manquants.push(m+'/'+v[0]); });
 });
 console.log('modules :',mods.length,'| vues sans picto :',manquants.length?manquants:'aucune');
 // rendu reel des onglets de chaque module
 mods.forEach(m=>{
   w.allerModule(m);
   const b=[...d.querySelectorAll('#onglets button')];
   const svg=b.filter(x=>x.querySelector('svg.pic')).length;
   console.log(String(m).padEnd(12), b.length,'onglets,', svg,'avec dessin');
 });
},2600);
