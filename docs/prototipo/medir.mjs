import {chromium} from 'playwright';
const ruta='file:///home/claude/prototipo.html';
const tam=[{w:1366,h:768},{w:1536,h:864},{w:1920,h:1080}];
const paginas=['pgExpediente','pgFuncionarios','pgAltaFuncionario','pgUsuarios','pgRoles','pgTipos','pgCuenta'];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
for(const t of tam){
  const p=await b.newPage({viewport:{width:t.w,height:t.h}});
  await p.goto(ruta);
  await p.evaluate(()=>{document.querySelectorAll('.acceso').forEach(a=>a.hidden=true);document.getElementById('app').removeAttribute('hidden');});
  console.log('=== '+t.w+'x'+t.h+' ===');
  for(const pg of paginas){
    await p.evaluate(id=>{document.querySelectorAll('.pagina').forEach(s=>s.hidden=(s.id!==id));window.scrollTo(0,0);},pg);
    await p.waitForTimeout(60);
    const r=await p.evaluate(()=>({doc:document.documentElement.scrollHeight,vp:window.innerHeight}));
    const ex=r.doc-r.vp;
    console.log(pg.padEnd(20), 'alto='+String(r.doc).padStart(5), (ex>0?'EXCESO +'+ex:'cabe ('+ex+')'));
  }
  await p.close();
}
await b.close();
