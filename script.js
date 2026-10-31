/* Travel Explorer – data comes from data.js (generated from destinations.xlsx) */
const state={user:null,country:null,cat:"All",trip:null,detail:null,flight:false,flightDest:null};
const $=id=>document.getElementById(id);
const norm=s=>String(s||"").trim().toLowerCase();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const countries=[...new Set(demoData.map(d=>d.country))].sort();
const FLAG_CC={Italy:"it",Spain:"es",France:"fr",Austria:"at",Belgium:"be",Denmark:"dk",Germany:"de",Monaco:"mc",Russia:"ru",Greece:"gr",Portugal:"pt",Norway:"no",Sweden:"se",Switzerland:"ch",Turkey:"tr",Ukraine:"ua","United Kingdom":"gb",Malta:"mt",Iceland:"is",Serbia:"rs",Luxembourg:"lu",Japan:"jp",Nepal:"np",Bhutan:"bt","Sri Lanka":"lk",Maldives:"mv",Bangladesh:"bd",Myanmar:"mm",Pakistan:"pk",Afghanistan:"af",China:"cn",Thailand:"th",Malaysia:"my"};
const fl=c=>FLAG_CC[c]?`<img class="flag" src="https://flagcdn.com/w40/${FLAG_CC[c]}.png" alt="" width="20" height="14" loading="lazy" onerror="this.remove()">`:"";
const ic=n=>`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const catIcon=c=>ic(/theme|amusement|museum|opera|cultural/i.test(c)?"star":/beach|coast|island|atoll|cliff|lake|fjord|lagoon|waterfall|spa/i.test(c)?"coast":/mountain|valley|forest|park|glacier|natural/i.test(c)?"mountain":/castle|palace|fortress|monaster|church|mosque|temple|shrine|site|memorial/i.test(c)?"landmark":"city");

/* ---------- storage / toast ---------- */
/* accounts are kept in "naviUsers" (by email); "naviSession" holds the signed-in email, so logout never deletes an account */
function allUsers(){try{return JSON.parse(localStorage.getItem("naviUsers")||"{}")}catch(e){return {}}}
function putUser(u){try{const all=allUsers();all[u.email.toLowerCase()]=u;localStorage.setItem("naviUsers",JSON.stringify(all));state.user=u;return true}catch(e){toast(t("t_storage"),1);return false}}
function findUser(email){return allUsers()[String(email||"").trim().toLowerCase()]||null}
function getUser(){const e=localStorage.getItem("naviSession");return e?findUser(e):null}
(function migrate(){try{const o=JSON.parse(localStorage.getItem("travelUser")||"null");if(o&&o.email&&!findUser(o.email))putUser(o);localStorage.removeItem("travelUser")}catch(e){}})();
function toast(msg,bad){const t=$("toast");t.textContent=msg;t.classList.toggle("bad",!!bad);t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),2600)}
function shake(){const c=$("authCard");c.classList.remove("shake");void c.offsetWidth;c.classList.add("shake")}

/* ---------- date of birth / age ---------- */
function ageFrom(iso){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||"");if(!m)return null;
  const y=+m[1],mo=+m[2],d=+m[3],dob=new Date(y,mo-1,d);
  if(dob.getFullYear()!==y||dob.getMonth()!==mo-1||dob.getDate()!==d)return null; // impossible date
  const t=new Date();let a=t.getFullYear()-y;
  if(t.getMonth()<mo-1||(t.getMonth()===mo-1&&t.getDate()<d))a--;
  return {age:a,future:dob>t};
}
function dobCheck(iso){
  if(!iso)return {ok:false,type:"",msg:""};
  const r=ageFrom(iso);
  if(!r)return {ok:false,type:"bad",msg:t("d_invalid")};
  if(r.future)return {ok:false,type:"bad",msg:t("d_future")};
  if(r.age>120)return {ok:false,type:"bad",msg:t("d_year")};
  if(r.age<18)return {ok:false,type:"bad",msg:t("d_minor",{n:r.age}),age:r.age};
  return {ok:true,type:"good",msg:t("d_ok",{n:r.age}),age:r.age};
}
function checkDob(){const el=$("dobStatus"),r=dobCheck($("signupDob").value);el.textContent=r.msg;el.className="dob-status "+r.type;return r}

/* ---------- password hashing (PBKDF2-SHA256 + random salt; passwords are never stored in plain text) ---------- */
/* NOTE: accounts live in this browser only (localStorage). This is a front-end demo login, not server-side security. */
const PW_ITER=150000,te=new TextEncoder();
const toB64=b=>btoa(String.fromCharCode.apply(null,b)),fromB64=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));
const cat2=(a,b)=>{const o=new Uint8Array(a.length+b.length);o.set(a);o.set(b,a.length);return o};
function sha256(m){                                   // pure-JS fallback for browsers without crypto.subtle (e.g. plain http)
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const l=m.length,n=((l+9+63)>>6)<<6,b=new Uint8Array(n);b.set(m);b[l]=0x80;
  const dv=new DataView(b.buffer);dv.setUint32(n-8,Math.floor(l*8/4294967296));dv.setUint32(n-4,(l*8)>>>0);
  const w=new Uint32Array(64),rr=(x,k)=>(x>>>k)|(x<<(32-k));
  for(let i=0;i<n;i+=64){
    for(let j=0;j<16;j++)w[j]=dv.getUint32(i+j*4);
    for(let j=16;j<64;j++){const s0=rr(w[j-15],7)^rr(w[j-15],18)^(w[j-15]>>>3),s1=rr(w[j-2],17)^rr(w[j-2],19)^(w[j-2]>>>10);w[j]=(w[j-16]+s0+w[j-7]+s1)>>>0}
    let [a,bb,c,d,e,f,g,hh]=h;
    for(let j=0;j<64;j++){
      const S1=rr(e,6)^rr(e,11)^rr(e,25),ch=(e&f)^(~e&g),t1=(hh+S1+ch+K[j]+w[j])>>>0,S0=rr(a,2)^rr(a,13)^rr(a,22),mj=(a&bb)^(a&c)^(bb&c),t2=(S0+mj)>>>0;
      hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=bb;bb=a;a=(t1+t2)>>>0;
    }
    h=[(h[0]+a)>>>0,(h[1]+bb)>>>0,(h[2]+c)>>>0,(h[3]+d)>>>0,(h[4]+e)>>>0,(h[5]+f)>>>0,(h[6]+g)>>>0,(h[7]+hh)>>>0];
  }
  const o=new Uint8Array(32),ov=new DataView(o.buffer);h.forEach((x,i)=>ov.setUint32(i*4,x));return o;
}
async function derive(pw,salt,alg){
  const enc=te.encode(pw);
  if(alg==="pbkdf2"){
    const key=await crypto.subtle.importKey("raw",enc,"PBKDF2",false,["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:PW_ITER},key,256));
  }
  let h=sha256(cat2(salt,enc));for(let i=0;i<20000;i++)h=sha256(cat2(h,enc));return h;
}
const hasSubtle=()=>!!(window.crypto&&crypto.subtle&&crypto.getRandomValues);
async function makeHash(pw){
  const salt=crypto.getRandomValues(new Uint8Array(16)),alg=hasSubtle()?"pbkdf2":"sha256x";
  return {alg,salt:toB64(salt),hash:toB64(await derive(pw,salt,alg))};
}
async function checkHash(pw,ph){
  if(ph.alg==="pbkdf2"&&!hasSubtle())throw new Error("no-subtle");
  const a=await derive(pw,fromB64(ph.salt),ph.alg),b=fromB64(ph.hash);
  let d=a.length^b.length;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0;     // constant-time compare
}
/* brute-force protection: 5 wrong passwords -> locked for 30 s, doubling each further miss (max 5 min) */
function lockGet(e){try{return JSON.parse(localStorage.getItem("naviLock")||"{}")[e]||{n:0,until:0}}catch(x){return{n:0,until:0}}}
function lockSet(e,o){try{const a=JSON.parse(localStorage.getItem("naviLock")||"{}");if(o)a[e]=o;else delete a[e];localStorage.setItem("naviLock",JSON.stringify(a))}catch(x){}}
function lockFail(e){const o=lockGet(e);o.n++;if(o.n>=5)o.until=Date.now()+Math.min(300,30*2**(o.n-5))*1000;lockSet(e,o)}
const strongPw=p=>p.length>=8&&/[A-Za-z]/.test(p)&&/\d/.test(p);

/* ---------- auth ---------- */
function swapAuth(show,hide){
  const a=$(show),b=$(hide);b.classList.remove("fade-in");b.classList.add("hidden");a.classList.remove("hidden","fade-in");
  requestAnimationFrame(()=>requestAnimationFrame(()=>a.classList.add("fade-in")));
}
function togglePw(id,btn){const i=$(id);i.type=i.type==="password"?"text":"password";btn.classList.toggle("on")}
function showLogin(){swapAuth("loginForm","signupForm")}
function showSignup(){swapAuth("signupForm","loginForm")}
async function createAccount(){
  const name=$("signupName").value.trim().slice(0,60),email=$("signupEmail").value.trim().slice(0,120),password=$("signupPassword").value,gender=$("signupGender").value,dob=$("signupDob").value;
  if(!name||!email||!password||!dob){toast(t("t_fill"),1);shake();return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast(t("t_email"),1);shake();return}
  if(!strongPw(password)){toast(t("t_pw8"),1);shake();return}
  const r=checkDob();
  if(!r.ok){toast(r.age!==undefined?t("t_under18"):t("t_dobInvalid"),1);shake();return}
  if(!$("dobConfirm").checked){toast(t("t_confirmDob"),1);shake();return}
  if(findUser(email)){toast(t("t_exists"),1);shake();return}
  try{
    const ph=await makeHash(password);
    if(!putUser({id:"NGA-"+Math.floor(100000+Math.random()*900000),name,email,gender,ph,dob,age:r.age}))return;
    try{localStorage.setItem("naviSession",email.toLowerCase())}catch(e){}
    $("signupPassword").value="";enterApp();toast(t("t_created"));
  }catch(e){toast(t("t_error"),1)}
}
async function login(){
  const email=$("loginEmail").value.trim(),password=$("loginPassword").value;
  if(!email||!password){toast(t("t_enterEP"),1);shake();return}
  const key=email.toLowerCase(),lk=lockGet(key);
  if(lk.until>Date.now()){toast(t("t_locked",{s:Math.ceil((lk.until-Date.now())/1000)}),1);shake();return}
  const u=findUser(email);
  if(!u){toast(t("t_noAcct"),1);shake();showSignup();return}
  try{
    let ok;
    if(u.ph)ok=await checkHash(password,u.ph);
    else{ok=typeof u.password==="string"&&password===u.password;     // older accounts: upgrade the plain-text password to a hash on first login
      if(ok){u.ph=await makeHash(password);delete u.password}}
    if(!ok){lockFail(key);const n=lockGet(key);toast(n.until>Date.now()?t("t_locked",{s:Math.ceil((n.until-Date.now())/1000)}):t("t_wrong"),1);shake();return}
  }catch(e){toast(t("t_error"),1);return}
  lockSet(key,null);
  const r=dobCheck(u.dob);
  if(!r.ok){toast(t("t_denied"),1);shake();return}
  u.age=r.age;if(!putUser(u))return;
  try{localStorage.setItem("naviSession",u.email.toLowerCase())}catch(e){}
  $("loginPassword").value="";enterApp();toast(t("t_welcome"));
}
function enterApp(){
  $("authView").classList.add("hidden");$("appView").classList.remove("hidden");
  updateProfile();buildStatic();applyStatic();showPage("homePage");
}
function logout(){localStorage.removeItem("naviSession");state.user=null;state.trip=null;state.detail=null;state.flight=false;$("loginPassword").value="";$("appView").classList.add("hidden");$("authView").classList.remove("hidden");showLogin();toast(t("t_loggedOut"))}
function updateProfile(){
  const u=state.user||getUser();if(!u)return;
  $("profileId").textContent=u.id||"-";$("profileName").textContent=u.name||"-";$("profileEmail").textContent=u.email||"-";
  $("profileGender").textContent=u.gender?tv("gender",u.gender):"-";$("profileDob").textContent=u.dob?new Date(u.dob+"T00:00:00").toLocaleDateString(locale(),{day:"2-digit",month:"short",year:"numeric"}):"-";$("profileAge").textContent=u.age?t("years",{n:u.age}):"-";
  $("profileAvatar").textContent=(u.name||"U").charAt(0).toUpperCase();
  $("heroHello").removeAttribute("data-i18n");$("heroHello").textContent=u.name?t("hello",{n:u.name.split(" ")[0]}):t("helloTraveller");
}

/* ---------- navigation ---------- */
function showPage(id){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active-page","in"));
  const pg=$(id);pg.classList.add("active-page");
  requestAnimationFrame(()=>requestAnimationFrame(()=>pg.classList.add("in")));window.scrollTo(0,0);
  const map={homePage:"navHome",topPage:"navTop",flightPage:"navFlight",profilePage:"navProfile",countryPage:"navHome",detailsPage:"navHome"};
  document.querySelectorAll(".bottom-nav button").forEach(b=>{b.classList.remove("selected");b.removeAttribute("aria-current")});
  if(map[id]){$(map[id]).classList.add("selected");$(map[id]).setAttribute("aria-current","page")}
  if(id==="homePage")countUp();
}
function goHome(){showPage("homePage")}
function countUp(){document.querySelectorAll("[data-count]").forEach(el=>{el.textContent=el.dataset.count})}

/* ---------- one-time UI built from the sheet ---------- */
function buildStatic(){
  if(!$("heroStats")){
    $("homePage").querySelector(".hero").insertAdjacentHTML("beforeend",`<div id="heroStats" class="hero-stats"><div><b data-count="${demoData.length}">0</b><span data-i18n="destinations"></span></div><div><b data-count="${countries.length}">0</b><span data-i18n="countries"></span></div><div><b data-count="${new Set(demoData.map(d=>d.category)).size}">0</b><span data-i18n="categories"></span></div></div>`);
  }
  buildHome();
  $("countryList").innerHTML=countries.map(c=>`<option value="${esc(tv("country",c))}">`).join("");
  initFlightForm();
  const tot={};demoData.forEach(d=>tot[d.country]=(tot[d.country]||0)+d.tm);
  const top=Object.entries(tot).sort((a,b)=>b[1]-a[1]).slice(0,10);
  $("rankList").innerHTML=top.map(([c,v],i)=>`<button type="button" onclick="openCountry('${c}')"><span>${i+1}</span><i class="rk-img ph" data-img="${esc(photoQ(heroOf(c)))}" style="--h:${hue(c)}"></i><b>${fl(c)} ${esc(tv("country",c))}<small>${t("tourists",{n:Math.round(v)})}</small></b></button>`).join("");
}

/* ---------- home: country rail + themed tiles ---------- */
const heroOf=c=>demoData.filter(d=>d.country===c).sort((a,b)=>b.tm-a.tm)[0];
const THEMES={
  city:{re:/^(city|town|district|square|street|neighbo|bazaar|village|region|spa town)/i},
  coast:{re:/beach|coast|island|atoll|lagoon|cliff|peninsula|fjord/i},
  nature:{re:/mountain|valley|forest|park|glacier|waterfall|lake|natural|garden|geothermal/i},
  heritage:{re:/castle|palace|fortress|monaster|church|mosque|temple|shrine|site|memorial|museum|opera|cultural|railway/i}
};
function themeOf(d){for(const k of ["coast","nature","heritage"])if(THEMES[k].re.test(d.category))return k;return "city"}
function buildHome(){
  const tot={};demoData.forEach(d=>tot[d.country]=(tot[d.country]||0)+d.tm);
  $("countryRail").innerHTML=Object.keys(tot).sort((a,b)=>tot[b]-tot[a]).map(c=>`<button type="button" class="rail-card ph" data-img="${esc(photoQ(heroOf(c)))}" style="--h:${hue(c)}" onclick="openCountry('${c}')"><span class="ph-i">${fl(c)}</span><small>${t("explore")}</small><b>${esc(tv("country",c))}</b></button>`).join("");
  buildVisa();
  const keys=Object.keys(THEMES);if(!state.theme)state.theme="city";
  $("themeTabs").innerHTML=keys.map(k=>`<button type="button" class="${k===state.theme?"on":""}" onclick="setTheme('${k}')">${t("th_"+k)}</button>`).join("");
  const list=demoData.filter(d=>themeOf(d)===state.theme).sort((a,b)=>b.tm-a.tm).slice(0,6);
  $("themeGrid").innerHTML=list.map(d=>`<button type="button" class="tile" onclick="openDetails(${demoData.indexOf(d)})"><i class="ph" role="img" aria-label="${esc(d.destination)}" data-img="${esc(photoQ(d))}" style="--h:${hue(d.destination)}"><span class="ph-i">${catIcon(d.category)}</span></i><span>${esc(d.destination)}</span></button>`).join("");
}
function setTheme(k){state.theme=k;buildHome()}

/* ---------- search & countries ---------- */
const cMatch=(x,q)=>norm(x.country)===q||norm(tv("country",x.country))===q;
function findMatches(q){q=norm(q);return demoData.filter(x=>norm(x.country).includes(q)||norm(tv("country",x.country)).includes(q)||norm(x.destination).includes(q))}
const photoQ=x=>x.wiki||(x.destination+" "+x.country);
function cardHTML(x,i){const idx=demoData.indexOf(x);return `<article class="destination-card"><div class="dc-media ph" role="img" aria-label="${esc(x.destination)}" data-img="${esc(photoQ(x))}" style="--h:${hue(x.destination)}"><span class="ph-i">${catIcon(x.category)}</span><em>${esc(tv("category",x.category))}</em></div><div class="dc-body"><h3>${esc(x.destination)}</h3><p class="dc-sub">${ic("pin")} ${esc(x.region)}, ${esc(tv("country",x.country))}</p><p>${esc(x.description)}</p><button type="button" onclick="openDetails(${idx})">${t("viewDetails")}</button></div></article>`}
function renderCountry(country){
  const all=demoData.filter(x=>cMatch(x,norm(country))||norm(x.destination)===norm(country));
  const c=$("countryContent"),bar=$("chipBar");
  if(!all.length){bar.innerHTML="";c.innerHTML=`<div class="message-card">${t("noDest",{q:esc(country)})} ${countries.slice(0,5).map(n=>`<button type="button" class="mini-link" onclick="openCountry('${n}')">${esc(tv("country",n))}</button>`).join("")}</div>`;return}
  const name=all[0].country;if(state.country!==name){state.country=name;state.cat="All"}
  const cats=["All",...new Set(all.map(x=>x.category))];const catName=k=>k==="All"?t("all"):tv("category",k);
  bar.innerHTML=cats.map(k=>`<button type="button" class="${k===state.cat?"on":""}" onclick="setCat('${k.replace(/'/g,"\\'")}')">${esc(catName(k))}</button>`).join("");
  const list=state.cat==="All"?all:all.filter(x=>x.category===state.cat);
  c.innerHTML=`<h2>${fl(name)} ${esc(tv("country",name))} <small>${t("places",{n:list.length})}</small></h2>${visaCard(name)}<div class="destination-grid">${list.map(cardHTML).join("")}</div>`;
}
function setCat(k){state.cat=k;renderCountry(state.country)}
function openCountry(c){$("countrySearch").value=tv("country",c);state.country=null;showPage("countryPage");renderCountry(c)}
function searchCountry(){const q=$("countrySearch").value.trim();if(!q){toast(t("t_enterCountry"),1);return}state.country=null;renderCountry(q)}
function searchHome(){
  const q=$("homeSearch").value.trim(),box=$("homeResults");if(!q){box.innerHTML="";return}
  const m=findMatches(q).slice(0,12);
  box.innerHTML=m.length?m.map(x=>`<span class="result-chip">${catIcon(x.category)} ${esc(x.destination)}, ${esc(tv("country",x.country))}<button type="button" onclick="openDetails(${demoData.indexOf(x)})">${t("open")}</button></span>`).join(""):`<div class="message-card">${t("noMatch")}</div>`;
}

/* ---------- trip type planner ---------- */
const trips={
  Family:{icon:"family",theme:"linear-gradient(135deg,#0f5c4d,#2fa084)",tag:"tag_Family",cats:/theme|amusement|beach|island|park|garden|lake|coastal|museum|forest/i,tips:["tip_f1","tip_f2","tip_f3"],pref:["Medium","Free"]},
  Solo:{icon:"solo",theme:"linear-gradient(135deg,#123c52,#2b7a9b)",tag:"tag_Solo",cats:/^city$|museum|town|cultural|square|street|neighbo|bazaar|district/i,tips:["tip_s1","tip_s2","tip_s3"],pref:["Medium","Free"]},
  Couple:{icon:"couple",theme:"linear-gradient(135deg,#b8641f,#e8a33d)",tag:"tag_Couple",cats:/island|coastal|lake|fjord|castle|palace|spa|lagoon|beach|village|cliff|geothermal/i,tips:["tip_c1","tip_c2","tip_c3"],pref:["Medium-high","High"]},
  Friends:{icon:"friends",theme:"linear-gradient(135deg,#1b6b4a,#5bbf8a)",tag:"tag_Friends",cats:/^city$|beach|island|mountain|amusement|opera|waterfall|bazaar|street|neighbo|coastal/i,tips:["tip_r1","tip_r2","tip_r3"],pref:["Medium"]}
};
function chooseTravelType(type,keep){
  state.trip=type;const tp=trips[type];document.querySelectorAll(".travel-card").forEach(b=>b.classList.toggle("picked",b.dataset.type===type));
  const scored=demoData.map(d=>({d,s:(tp.cats.test(d.category)?3:0)+(/^Generally safe(,|$)/.test(d.safety)&&!/pickpocket/i.test(d.safety)?1.5:0)+(tp.pref.includes(d.cost)?1.5:0)+Math.log10(1+d.tm)})).sort((a,b)=>b.s-a.s);
  const pick=[],cnt={};for(const {d} of scored){if((cnt[d.country]||0)<2){pick.push(d);cnt[d.country]=(cnt[d.country]||0)+1}if(pick.length===6)break}
  const cs=[...new Set(pick.map(p=>p.country))];
  $("homeMessage").removeAttribute("data-i18n");$("homeMessage").innerHTML=`${t("typeSelected",{type:t("ty_"+type)})} ${cs.map(c=>`<button type="button" class="mini-link" onclick="openCountry('${c}')">${fl(c)} ${esc(tv("country",c))}</button>`).join(" ")}`;
  $("tripPanel").innerHTML=`<div class="trip-panel" style="--tp:${tp.theme}"><div class="trip-head"><span class="trip-icon">${ic(tp.icon)}</span><div><h3>${t("tripPlan",{type:t("ty_"+type)})}</h3><p>${t(tp.tag)}</p></div></div><ul class="tips">${tp.tips.map(x=>`<li>${ic("check")}<span>${t(x)}</span></li>`).join("")}</ul><div class="destination-grid">${pick.map(cardHTML).join("")}</div></div>`;
  if(!keep)setTimeout(()=>$("tripPanel").scrollIntoView({behavior:"auto",block:"start"}),80);
}

/* ---------- details ---------- */
function openDetails(i,keep){
  state.detail=i;
  const x=demoData[i],rows=[[t("f_Region"),x.region],[t("f_Country"),tv("country",x.country)],[t("f_Category"),tv("category",x.category)],[t("f_Tourists"),tv("tourists",x.tourists)],[t("f_Currency"),tv("currency",x.currency)],[t("f_Religion"),tv("religion",x.religion)],[t("f_Foods"),x.foods],[t("f_Language"),tv("language",x.language)],[t("f_Best"),tv("best",x.best)],[t("f_Cost"),tv("cost",x.cost)],[t("f_Safety"),tv("safety",x.safety)],[t("f_Culture"),x.culture],[t("f_Description"),x.description]];
  const map=x.lat!=null&&x.lng!=null?`<a class="map-link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${x.lat},${x.lng}">${ic("pin")} ${t("mapLink",{c:(+x.lat).toFixed(3)+", "+(+x.lng).toFixed(3)})}</a>`:"";
  $("detailsContent").innerHTML=`<div class="detail-header"><div class="wx-wrap" id="wxBox"></div><div class="dh-banner ph" role="img" aria-label="${esc(x.destination)}" data-img="${esc(photoQ(x))}" style="--h:${hue(x.destination)}"><span class="ph-i">${catIcon(x.category)}</span></div><div class="dh-text"><h1>${esc(x.destination)}</h1><p>${fl(x.country)} ${esc(tv("country",x.country))} · ${esc(x.region)}</p></div></div><div id="wxLive"></div>${map}<div class="detail-actions"><button type="button" class="primary-btn" onclick="openFlights(${i})">${ic("plane")} ${t("findFlights")}</button><small class="muted">${t("nearestAp",{a:esc(apLabel(airportFor(x)))})}</small></div><table class="detail-table">${rows.filter(r=>r[1]).map((r,n)=>`<tr><td>${r[0]}</td><td>${esc(r[1])}</td></tr>`).join("")}</table>`;
  wxMount(i);
  if(!keep)showPage("detailsPage");
}

/* ---------- flights: international (airports.js + flights.js) ---------- */
const hm=m=>`${Math.floor(m/60)}${t("u_h")} ${String(m%60).padStart(2,"0")}${t("u_m")}`;
const inr=n=>"₹"+Math.round(n).toLocaleString("en-IN");
const flightState={list:[],sort:"price",shown:8};
const cityName=c=>tv("city",AP[c].city);
const apLabel=c=>`${cityName(c)} (${c})`;
const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return ymd(d)};
const FIRST_GROUPS=["India","United Arab Emirates","Qatar"];

function initFlightForm(){
  const g={};AIRPORT_LIST.forEach(a=>(g[a.country]=g[a.country]||[]).push(a));
  const order=[...FIRST_GROUPS,...Object.keys(g).filter(c=>!FIRST_GROUPS.includes(c)).sort()];
  const opts=order.map(c=>`<optgroup label="${esc(tv("country",c))}">${g[c].slice().sort((x,y)=>x.city.localeCompare(y.city)).map(a=>`<option value="${a.code}">${esc(apLabel(a.code))}</option>`).join("")}</optgroup>`).join("");
  const f=$("fromPlace"),to=$("toPlace"),fv=f.value,tov=to.value,head=`<option value="">${t("selCity")}</option>`;
  f.innerHTML=head+opts;to.innerHTML=head+opts;f.value=fv;to.value=tov;
  $("flightDate").min=ymd(new Date());
}
function swapCities(){const f=$("fromPlace"),to=$("toPlace"),v=f.value;f.value=to.value;to.value=v;state.flightDest=null}

/* world map: land outline is fetched once (Natural Earth via world-atlas) and cached; the route works without it */
const LAND_URL="https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json";
let LAND=null,landReq=null;
function decodeLand(topo){
  const [sx,sy]=topo.transform.scale,[tx,ty]=topo.transform.translate;
  const arcs=topo.arcs.map(a=>{let x=0,y=0;return a.map(p=>{x+=p[0];y+=p[1];return [x*sx+tx,y*sy+ty]})});
  const arc=i=>i>=0?arcs[i]:arcs[~i].slice().reverse();
  const ring=ids=>{let pts=[];ids.forEach((id,k)=>{const a=arc(id);pts=pts.concat(k?a.slice(1):a)});return pts};
  const obj=topo.objects.land,geoms=obj.geometries||[obj],rings=[];
  geoms.forEach(g=>{
    const polys=g.type==="Polygon"?[g.arcs]:g.type==="MultiPolygon"?g.arcs:[];
    polys.forEach(p=>p.forEach(r=>{const pts=ring(r);let a=1e9,b=1e9,c=-1e9,d=-1e9;pts.forEach(q=>{a=Math.min(a,q[0]);c=Math.max(c,q[0]);b=Math.min(b,q[1]);d=Math.max(d,q[1])});rings.push({pts,bb:[a,b,c,d]})}));
  });
  return rings;
}
function loadLand(){
  if(LAND)return Promise.resolve(LAND);
  if(landReq)return landReq;
  let raw=null;try{raw=localStorage.getItem("naviLand1")}catch(e){}
  landReq=(raw?Promise.resolve(JSON.parse(raw)):fetch(LAND_URL).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(j=>{try{localStorage.setItem("naviLand1",JSON.stringify(j))}catch(e){}return j}))
    .then(j=>(LAND=decodeLand(j))).catch(()=>{landReq=null;return null});
  return landReq;
}
function gcPoints(la1,lo1,la2,lo2,n){                     // great-circle arc between two airports
  const r=Math.PI/180,v=(la,lo)=>[Math.cos(la*r)*Math.cos(lo*r),Math.cos(la*r)*Math.sin(lo*r),Math.sin(la*r)];
  const A=v(la1,lo1),B=v(la2,lo2),w=Math.acos(Math.max(-1,Math.min(1,A[0]*B[0]+A[1]*B[1]+A[2]*B[2]))),out=[];
  for(let i=0;i<=n;i++){
    const u=i/n,s1=w?Math.sin((1-u)*w)/Math.sin(w):1-u,s2=w?Math.sin(u*w)/Math.sin(w):u;
    const x=s1*A[0]+s2*B[0],y=s1*A[1]+s2*B[1],z=s1*A[2]+s2*B[2];out.push([Math.atan2(z,Math.hypot(x,y))/r,Math.atan2(y,x)/r]);
  }
  return out;
}
function mapSVG(from,to){
  const a=AP[from],b=AP[to],pts=gcPoints(a.lat,a.lng,b.lat,b.lng,72),W=600;
  const los=pts.map(p=>p[1]),las=pts.map(p=>p[0]);
  let lo0=Math.min(...los),lo1=Math.max(...los),la0=Math.min(...las),la1=Math.max(...las);
  const pl=Math.max(9,(lo1-lo0)*.16),pa=Math.max(6,(la1-la0)*.2);lo0-=pl;lo1+=pl;la0-=pa;la1+=pa;
  const kx=Math.cos(((la0+la1)/2)*Math.PI/180);let H=W*(la1-la0)/((lo1-lo0)*kx);
  if(H<250){const sp=250*(lo1-lo0)*kx/W,c=(la0+la1)/2;la0=c-sp/2;la1=c+sp/2;H=250}
  else if(H>470){const sp=W*(la1-la0)/(470*kx),c=(lo0+lo1)/2;lo0=c-sp/2;lo1=c+sp/2;H=470}
  const P=(la,lo)=>[(lo-lo0)/(lo1-lo0)*W,(la1-la)/(la1-la0)*H],f1=v=>v.toFixed(1);
  const A=P(a.lat,a.lng),B=P(b.lat,b.lng),d="M"+pts.map(p=>P(p[0],p[1]).map(f1).join(",")).join(" L");
  const step=(lo1-lo0)>70?20:(lo1-lo0)>35?10:5,grid=[];
  for(let lo=Math.ceil(lo0/step)*step;lo<=lo1;lo+=step){const x=f1(P(0,lo)[0]);grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${f1(H)}"/>`)}
  for(let la=Math.ceil(la0/step)*step;la<=la1;la+=step){const y=f1(P(la,0)[1]);grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`)}
  const dot=(c,p)=>`<g class="city on"><circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="7"/><text x="${f1(p[0]+(p[0]>W*.62?-24:24))}" y="${f1(p[1]+5)}" text-anchor="${p[0]>W*.62?"end":"start"}">${esc(cityName(c))}</text></g>`;
  const landD=rings=>rings.filter(r=>!(r.bb[2]<lo0||r.bb[0]>lo1||r.bb[3]<la0||r.bb[1]>la1)).map(r=>"M"+r.pts.map(q=>P(q[1],q[0]).map(f1).join(",")).join("L")+"Z").join("");
  return {land:landD,html:`<svg id="flightMap" viewBox="0 0 ${W} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(cityName(from))} – ${esc(cityName(to))}"><defs><linearGradient id="trail" x1="0" x2="1"><stop offset="0" stop-color="#f6c667"/><stop offset="1" stop-color="#e8a33d"/></linearGradient></defs><g class="grid">${grid.join("")}</g><path id="landP" class="land" fill-rule="evenodd" d=""/><path id="routeGhost" d="${d}"/><path id="routeTrail" d="${d}"/>${dot(from,A)}${dot(to,B)}<circle class="ring" cx="${f1(A[0])}" cy="${f1(A[1])}" r="11"/><circle class="ring" cx="${f1(B[0])}" cy="${f1(B[1])}" r="11"/><g id="planeG"><path class="plane" d="M16 0 L-1 -3.5 L-8 -14 L-12 -14 L-8 -2.5 L-13 -2.5 L-15.5 -7 L-18 -7 L-15.5 0 L-18 7 L-15.5 7 L-13 2.5 L-8 2.5 L-12 14 L-8 14 L-1 3.5 Z"/></g></svg>`};
}
function drawRoute(){                                     // plane parked at the destination, route fully drawn
  const path=$("routeTrail"),plane=$("planeG");if(!path)return;
  const L=path.getTotalLength(),p=path.getPointAtLength(L),q=path.getPointAtLength(Math.max(0,L-2));
  plane.setAttribute("transform",`translate(${p.x},${p.y}) rotate(${Math.atan2(p.y-q.y,p.x-q.x)*180/Math.PI})`);
}
function sortFlights(k){flightState.sort=k;flightState.shown=8;renderFlightList()}
function moreFlights(){flightState.shown+=10;renderFlightList()}
function renderFlightList(){
  const {list,sort,shown}=flightState,box=$("flightList");if(!box)return;
  let l=[...list];
  if(sort==="price")l.sort((a,b)=>a[9]-b[9]);else if(sort==="fast")l.sort((a,b)=>a[5]-b[5]);else l=l.filter(x=>x[6]===0).sort((a,b)=>a[9]-b[9]);
  document.querySelectorAll("#flightFilters button").forEach(b=>b.classList.toggle("on",b.dataset.k===sort));
  if(!l.length){box.innerHTML=`<div class="message-card">${t("noNonstop")}</div>`;return}
  box.innerHTML=l.slice(0,shown).map(f=>`<article class="fl-card"><div class="fl-top"><b>${esc(tv("airline",f[2]))}</b><span class="fl-price">${inr(f[9])}<small>${t("est")}</small></span></div><div class="fl-times"><div><strong>${f[3]}</strong><small>${esc(cityName(f[0]))}</small></div><div class="fl-mid"><small>${hm(f[5])}</small><i></i><small>${f[6]===0?t("nonstop"):t(f[6]>1?"stopN":"stop1",{n:f[6]})}</small></div><div><strong>${f[4]}</strong><small>${esc(cityName(f[1]))}</small></div></div><div class="fl-meta"><span>${ic("plane")}${esc(f[7])}</span><span>${ic("info")}${esc(tv("finfo",f[8]))}</span></div></article>`).join("")+(l.length>shown?`<button type="button" class="secondary-btn more" onclick="moreFlights()">${t("showMore",{n:l.length-shown})}</button>`:"");
}
function searchFlight(silent){
  const from=$("fromPlace").value,to=$("toPlace").value,date=$("flightDate").value;
  if(!from||!to||!date){toast(t("t_selFlight"),1);return}
  if(from===to){toast(t("t_same"),1);return}
  if(new Date(date+"T00:00:00")<new Date(new Date().toDateString())){toast(t("t_pastDate"),1);return}
  try{localStorage.setItem("naviFrom",from)}catch(e){}
  const rows=generateFlights(from,to,date),dist=Math.round(distKm(from,to)),best=Math.min(...rows.map(r=>r[5])),cheapest=Math.min(...rows.map(r=>r[9]));
  const m=mapSVG(from,to),pretty=new Date(date+"T00:00:00").toLocaleDateString(locale(),{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  const dx=state.flightDest!=null?demoData[state.flightDest]:null,note=to==="RZE"?"note_ua":(dx?destNote(dx):"");
  const banner=dx?`<div class="dest-banner">${ic("pin")}<div><b>${esc(dx.destination)}</b>, ${esc(tv("country",dx.country))}<small>${t("nearestAp",{a:esc(apLabel(to))})}</small></div></div>`:"";
  state.flight=true;if(silent!==true){flightState.sort="price";flightState.shown=8}flightState.list=rows;
  $("flightResult").innerHTML=`<div class="fl-wrap">${banner}${note?`<div class="note-card">${ic("info")}<span>${t(note)}</span></div>`:""}<div class="route-card"><div class="rc-head"><div><b>${esc(cityName(from))}</b><small>${from}</small></div><span>${ic("plane")}</span><div><b>${esc(cityName(to))}</b><small>${to}</small></div></div><div class="map-box">${m.html}</div><div class="fl-stats"><span>${ic("route")}${t("km",{n:dist.toLocaleString("en-IN")})}</span><span>${ic("clock")}${hm(best)}</span><span>${pretty}</span></div></div><div class="fl-summary"><div><b>${rows.length}</b><span>${t("flightsFound")}</span></div><div><b>${inr(cheapest)}</b><span>${t("cheapest")}</span></div><div><b>${hm(best)}</b><span>${t("fastest")}</span></div></div><div id="flightFilters" class="chip-bar"><button type="button" data-k="price" onclick="sortFlights('price')">${t("fCheap")}</button><button type="button" data-k="fast" onclick="sortFlights('fast')">${t("fFast")}</button><button type="button" data-k="non" onclick="sortFlights('non')">${t("fNon")}</button></div><div id="flightList"></div><small class="demo-note">${t("demoNote")}</small></div>`;
  renderFlightList();drawRoute();
  loadLand().then(L=>{const p=$("landP");if(p&&L)p.setAttribute("d",m.land(L))});
  if(silent!==true)$("flightResult").scrollIntoView({behavior:"auto",block:"start"});
}
/* "Find flights" on a destination page: pre-fills the nearest airport and searches */
function openFlights(i){
  const x=demoData[i];state.flightDest=i;initFlightForm();
  $("toPlace").value=airportFor(x);
  if(!$("fromPlace").value){let v="";try{v=localStorage.getItem("naviFrom")||""}catch(e){}$("fromPlace").value=AP[v]?v:"DEL"}
  if(!$("flightDate").value)$("flightDate").value=addDays(21);
  showPage("flightPage");searchFlight();
}
/* ---------- language change: redraw everything that is built from JS ---------- */
function refreshLanguage(){
  const u=state.user||getUser();
  if($("dobStatus")&&$("signupDob").value)checkDob();
  if(!u||$("appView").classList.contains("hidden"))return;
  updateProfile();buildStatic();applyStatic();
  if($("homeSearch").value.trim())searchHome();
  if(state.trip)chooseTravelType(state.trip,true);
  if(state.country)renderCountry(state.country);
  if(state.country)$("countrySearch").value=tv("country",state.country);
  if(state.detail!==null)openDetails(state.detail,true);
  if(state.flight&&$("fromPlace").value&&$("toPlace").value&&$("flightDate").value)searchFlight(true);
}
window.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".travel-card").forEach(b=>{const m=/chooseTravelType\('(\w+)'\)/.exec(b.getAttribute("onclick"));if(m)b.dataset.type=m[1]});
  $("signupDob").max=ymd(new Date());
  const u=getUser();if(u){state.user=u;const r=dobCheck(u.dob);r.ok?enterApp():localStorage.removeItem("naviSession")}
});

/* offline-capable app shell (only on http/https; sw.js is network-first so updates always arrive) */
if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol))window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
