/* End-to-end test of the whole app (sign-up, login, lockout, weather, flights, 4 languages) in jsdom.
   Setup once: npm install        Run: npm run e2e */
const {JSDOM,VirtualConsole}=require('jsdom');const {webcrypto}=require('crypto');
const root=require('path').join(__dirname,'..')+'/';
const http=require('http'),fs=require('fs'),pathm=require('path');
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.webmanifest':'application/json'};
const server=http.createServer((q,r)=>{let p=pathm.join(root,decodeURIComponent(q.url.split('?')[0]));if(p.endsWith('/'))p+='index.html';fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':mime[pathm.extname(p)]||'application/octet-stream'});r.end(b)})});
let PORT=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('  FAIL',m)}else console.log('  ok  ',m)};
const wx=()=>({ok:true,json:async()=>({utc_offset_seconds:7200,timezone:'Europe/Rome',current:{time:new Date(Date.now()+7200e3-5*60e3).toISOString().slice(0,16),temperature_2m:21.3,apparent_temperature:20,relative_humidity_2m:55,precipitation:0,weather_code:1,cloud_cover:10,pressure_msl:1015,wind_speed_10m:9,wind_direction_10m:200,wind_gusts_10m:15,is_day:1}})});
async function boot(subtle,store){
  const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/fonts\.googleapis/.test(e.message))errors.push(String(e.message).slice(0,160))});   // Google Fonts are not reachable in CI
  const dom=await JSDOM.fromURL('http://127.0.0.1:'+PORT+'/index.html',{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){
      w.fetch=async(u)=>{ if(/open-meteo/.test(u))return wx(); return {ok:false,status:404,json:async()=>({})} };
      w.scrollTo=()=>{};w.SVGElement.prototype.getTotalLength=()=>100;w.SVGElement.prototype.getPointAtLength=()=>({x:1,y:1});w.HTMLElement.prototype.scrollIntoView=()=>{};
      if(subtle)Object.defineProperty(w,'crypto',{value:webcrypto,configurable:true});
      if(store)for(const [k,v] of Object.entries(store))w.localStorage.setItem(k,v);
    }});
  await sleep(700);dom.errors=errors;return dom;
}
const val=(w,id,v)=>{w.document.getElementById(id).value=v};
const toast=w=>w.document.getElementById('toast').textContent;
async function suite(subtle){
  console.log('\n=== '+(subtle?'PBKDF2 (crypto.subtle)':'fallback SHA-256 (no crypto.subtle)')+' ===');
  const dom=await boot(subtle);const w=dom.window,d=w.document;
  ok(!!d.getElementById('loginFormEl'),'login form present');
  // sign-up validations
  val(w,'signupName','Test User');val(w,'signupEmail','test@example.com');val(w,'signupPassword','abcd');val(w,'signupDob','1995-05-05');d.getElementById('dobConfirm').checked=true;
  await w.eval('createAccount()');ok(/8 characters/.test(toast(w)),'weak password rejected: '+toast(w));
  val(w,'signupPassword','onlyletters');await w.eval('createAccount()');ok(/8 characters/.test(toast(w)),'password without a digit rejected');
  val(w,'signupDob','2015-05-05');w.eval('checkDob()');val(w,'signupPassword','Passw0rd1');await w.eval('createAccount()');ok(/18/.test(toast(w)),'under-18 rejected: '+toast(w));
  val(w,'signupDob','1995-05-05');w.eval('checkDob()');await w.eval('createAccount()');await sleep(300);
  ok(!d.getElementById('appView').classList.contains('hidden'),'sign-up enters the app');
  const users=JSON.parse(w.localStorage.getItem('naviUsers'));const u=users['test@example.com'];
  ok(u&&u.ph&&u.ph.hash&&!u.password,'password stored only as a hash ('+u.ph.alg+')');
  ok(!JSON.stringify(users).includes('Passw0rd1'),'plain password appears nowhere in storage');
  // app pages
  ok(d.querySelectorAll('#countryRail .rail-card').length===33,'33 country cards on home');
  const vc=[...d.querySelectorAll('#visaRail .rail-card')];
  ok(vc.length===6,'visa-free section shows 6 countries ('+vc.length+')');
  ok(vc.filter(x=>/Visa-free/.test(x.textContent)).length===5&&vc.filter(x=>/Free online ETA/.test(x.textContent)).length===1,'5 visa-free + 1 free-ETA badge');
  ok(/Nepal|Bhutan|Maldives|Thailand|Malaysia|Sri Lanka/.test(d.getElementById('visaRail').textContent)&&!/Japan|China|Pakistan/.test(d.getElementById('visaRail').textContent),'only verified countries listed');
  ok(/checked on 12 Oct 2026/.test(d.getElementById('visaNote').textContent),'visa note shows the check date');
  w.eval('openCountry("Nepal")');await sleep(150);
  ok(/Entry for Indian passport holders/.test(d.getElementById('countryContent').textContent)&&/No visa is needed/.test(d.getElementById('countryContent').textContent),'Nepal page shows its visa card');
  w.eval('openCountry("Japan")');await sleep(150);
  ok(d.querySelectorAll('#countryContent .destination-card').length>=25&&!/Entry for Indian/.test(d.getElementById('countryContent').textContent),'Japan page lists 25+ places and no visa-free card');
  const ji=w.eval('demoData.findIndex(x=>x.destination==="Kyoto")');w.eval('openDetails('+ji+')');await sleep(250);
  ok(/Weather right now/.test(d.getElementById('wxLive').textContent),'Kyoto page has live weather');
  w.eval('openFlights('+ji+')');await sleep(250);
  ok(d.querySelectorAll('.fl-card').length>0&&/KIX/.test(d.getElementById('flightResult').textContent),'flights to Kyoto end at Osaka (KIX)');
  const pk=w.eval('demoData.findIndex(x=>x.destination==="Lahore")');w.eval('openFlights('+pk+')');await sleep(250);
  ok(/no direct flights between India and Pakistan/.test(d.body.textContent),'Lahore flights show the no-direct-flight note');
  w.eval('openDetails(0)');await sleep(300);
  ok(/Weather right now/.test(d.getElementById('wxLive').textContent),'weather card rendered');
  ok(/21°/.test(d.getElementById('wxBox').textContent),'weather chip shows temperature');
  
  w.eval('openFlights(0)');await sleep(300);
  ok(d.querySelectorAll('.fl-card').length>0,'flight results shown ('+d.querySelectorAll('.fl-card').length+')');
  ok(d.getElementById('flightMap')!==null,'route map drawn');
  for(const l of ['ta','hi','ml','en']){w.eval(`setLang('${l}')`);await sleep(120);
    ok(d.documentElement.lang===l,'language '+l+' applied to <html lang>');
    ok(/\S/.test(d.getElementById('wxLive').textContent)&&d.querySelectorAll('.fl-card').length>0,'  page redraws in '+l);}
  ok(d.getElementById('nav'+'Flight').getAttribute('aria-current')==='page','aria-current set on nav');
  // logout + wrong password lockout
  w.eval('logout()');ok(d.getElementById('appView').classList.contains('hidden'),'logout');
  val(w,'loginEmail','test@example.com');
  for(let i=0;i<5;i++){val(w,'loginPassword','Wrong'+i+'xx');await w.eval('login()')}
  ok(/Try again in/.test(toast(w)),'account locked after 5 wrong passwords: '+toast(w));
  val(w,'loginPassword','Passw0rd1');await w.eval('login()');ok(/Try again in/.test(toast(w)),'correct password still refused while locked');
  w.localStorage.setItem('naviLock','{}');
  val(w,'loginPassword','Passw0rd1');await w.eval('login()');await sleep(300);
  ok(!d.getElementById('appView').classList.contains('hidden'),'login works with correct password');
  ok(dom.errors.length===0,'no script errors '+dom.errors.join('|'));
  dom.window.close();
}
async function legacy(){
  console.log('\n=== legacy plain-text account is upgraded on first login ===');
  const old={'old@example.com':{id:'NGA-111111',name:'Old User',email:'old@example.com',gender:'',password:'secret123',dob:'1990-01-01',age:36}};
  const dom=await boot(true,{naviUsers:JSON.stringify(old)});const w=dom.window,d=w.document;
  val(w,'loginEmail','old@example.com');val(w,'loginPassword','secret123');await w.eval('login()');await sleep(300);
  const u=JSON.parse(w.localStorage.getItem('naviUsers'))['old@example.com'];
  ok(!d.getElementById('appView').classList.contains('hidden'),'legacy login works');
  ok(u.ph&&!u.password,'plain-text password replaced by a hash');
  dom.window.close();
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));PORT=server.address().port;await suite(true);await suite(false);await legacy();console.log('\n'+(fails?fails+' FAILED':'E2E all passed'));server.close();process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(1)});
