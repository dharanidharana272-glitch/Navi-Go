/* Navi Go AI – international flight model
   Needs airports.js (AIRPORTS, DEST_AIRPORT). Pure functions, no DOM: also used by tools/build_dataset.js.
   Schedules and fares are ESTIMATES generated from route distance, time zones and typical airline networks
   (deterministic: the same search always gives the same result). They are not live airline data. */
const AP={};AIRPORTS.forEach(a=>{AP[a[0]]={code:a[0],city:a[1],country:a[2],lat:a[3],lng:a[4],tz:a[5],dst:a[6],size:a[7],feeder:a[8]}});
const AIRPORT_LIST=Object.values(AP);

/* ---------- geometry & time ---------- */
const _rad=x=>x*Math.PI/180;
function llKm(la1,lo1,la2,lo2){const h=Math.sin(_rad(la2-la1)/2)**2+Math.cos(_rad(la1))*Math.cos(_rad(la2))*Math.sin(_rad(lo2-lo1)/2)**2;return 2*6371*Math.asin(Math.sqrt(h))}
const distKm=(a,b)=>llKm(AP[a].lat,AP[a].lng,AP[b].lat,AP[b].lng);
function euDst(ds){                       // EU summer time: last Sunday of March → last Sunday of October
  const y=+ds.slice(0,4),lastSun=m=>{const e=new Date(Date.UTC(y,m+1,0));return Date.UTC(y,m,e.getUTCDate()-e.getUTCDay())};
  const t=Date.parse(ds+"T12:00:00Z");return t>=lastSun(2)&&t<lastSun(9);
}
const tzOff=(code,ds)=>AP[code].tz+(AP[code].dst==="eu"&&euDst(ds)?1:0);
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rngOf(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}

/* ---------- which airport pairs have a direct (non-stop) service in the model ---------- */
const AS_COUNTRIES=["Japan","Nepal","Bhutan","Sri Lanka","Maldives","Bangladesh","Myanmar","Pakistan","Afghanistan","China","Hong Kong","Singapore","Thailand","Malaysia"];
const regionOf=c=>{const k=AP[c].country;return k==="India"?"IN":(k==="United Arab Emirates"||k==="Qatar")?"GULF":k==="Russia"?"RU":AS_COUNTRIES.includes(k)?"AS":"EU"};
const GW_IN={ // European gateways with direct service from each Indian airport
  DEL:["LHR","CDG","FRA","AMS","ZRH","VIE","CPH","IST","FCO","MXP","MAD","MUC","ARN","ATH","SVO","HEL"],
  BOM:["LHR","CDG","FRA","AMS","ZRH","VIE","CPH","IST","FCO","MXP","MAD","MUC","ARN","ATH","SVO"],
  BLR:["LHR","FRA","CDG","AMS","IST","MUC","ZRH"],MAA:["LHR","FRA","CDG","IST","AMS"],HYD:["LHR","FRA","AMS","IST","CDG"],
  CCU:["LHR","IST"],COK:["IST"]};
/* Asia: non-stop links from each Indian airport (India-Pakistan and India-Afghanistan have none: airspace closed / no service) */
const GW_AS={
  DEL:["KTM","PBH","CMB","MLE","DAC","BKK","HKT","KUL","SIN","NRT","HND","CAN","PVG","HKG"],
  BOM:["KTM","PBH","CMB","MLE","DAC","BKK","HKT","KUL","SIN","NRT","HND","HKG"],
  BLR:["KTM","CMB","MLE","BKK","HKT","KUL","SIN"],MAA:["CMB","MLE","BKK","HKT","KUL","SIN"],HYD:["KTM","CMB","MLE","BKK","HKT","KUL","SIN"],
  CCU:["KTM","PBH","DAC","RGN","BKK","KUL","SIN","CAN","HKG","CMB"],COK:["CMB","MLE","BKK","KUL","SIN"]};
/* Asia: other non-stop links (Gulf, Europe and Asia partners of each Asian airport) */
const ASL={
  BKK:["DXB","DOH","AUH","LHR","CDG","FRA","AMS","ZRH","VIE","MUC","IST","HEL","CPH","FCO","SVO","HKT","SIN","KUL","HKG","PEK","PVG","CAN","NRT","HND","KIX","KTM","DAC","CMB","MLE","RGN","PBH"],
  SIN:["DXB","DOH","AUH","LHR","CDG","FRA","AMS","ZRH","MUC","IST","BKK","HKT","KUL","HKG","PEK","PVG","CAN","NRT","HND","KIX","CMB","MLE","DAC","RGN"],
  KUL:["DXB","DOH","AUH","LHR","CDG","AMS","IST","BKK","HKT","SIN","HKG","PEK","PVG","CAN","NRT","HND","KIX","KTM","DAC","CMB","MLE","RGN","LHE","ISB","KHI"],
  HKG:["DXB","DOH","AUH","LHR","CDG","FRA","AMS","ZRH","VIE","MUC","IST","HEL","CPH","FCO","MAD","BKK","HKT","SIN","KUL","PEK","PVG","CAN","NRT","HND","KIX"],
  PEK:["DXB","DOH","AUH","LHR","CDG","FRA","AMS","ZRH","VIE","MUC","IST","HEL","FCO","MAD","CPH","SVO","BKK","SIN","KUL","HKG","PVG","CAN","NRT","HND","KIX","KTM","DAC","RGN","KHI","LHE","ISB"],
  PVG:["DXB","DOH","AUH","LHR","CDG","FRA","AMS","ZRH","VIE","MUC","IST","HEL","FCO","MAD","CPH","SVO","BKK","SIN","KUL","HKG","CAN","NRT","HND","KIX","KTM"],
  CAN:["DXB","DOH","AUH","LHR","CDG","FRA","AMS","IST","SVO","BKK","SIN","KUL","HKG","NRT","HND","KIX","KTM","DAC","RGN"],
  NRT:["DXB","DOH","LHR","CDG","FRA","AMS","ZRH","VIE","MUC","IST","HEL","CPH","FCO","BKK","SIN","KUL","HKG","KIX"],
  HND:["DXB","DOH","LHR","CDG","FRA","AMS","ZRH","VIE","MUC","IST","HEL","CPH","FCO","BKK","SIN","KUL","HKG"],
  KIX:["DXB","DOH","IST","HEL","BKK","SIN","KUL","HKG"],
  KTM:["DXB","DOH","AUH","IST","BKK","KUL","SIN","DAC","PBH","CAN"],
  CMB:["DXB","DOH","AUH","IST","LHR","FRA","CDG","SIN","KUL","BKK","MLE","DAC","SVO"],
  MLE:["DXB","DOH","AUH","IST","LHR","FRA","CDG","VIE","ZRH","MUC","HEL","FCO","MXP","SIN","KUL","BKK","CMB","CAN","PVG","SVO"],
  DAC:["DXB","DOH","AUH","IST","LHR","SIN","KUL","BKK","CAN"],
  RGN:["BKK","KUL","SIN","CAN","HKG"],
  PBH:["BKK","KTM","DAC","SIN"],
  HKT:["DXB","DOH","AUH","IST","SVO","HKG"],
  LHE:["DXB","DOH","AUH","IST","LHR","KUL","KHI","ISB"],
  ISB:["DXB","DOH","AUH","IST","LHR","KUL","PEK","KBL","KHI","LHE"],
  KHI:["DXB","DOH","AUH","IST","LHR","KUL","PEK","ISB","LHE"],
  KBL:["DXB","DOH","AUH","ISB"]};
const asLink=(a,b)=>(ASL[a]||[]).includes(b)||(ASL[b]||[]).includes(a);
const IN_HUBS=["DEL","BOM"];
const HUBS=["DXB","DOH","AUH","IST","FRA","LHR","CDG","AMS","ZRH","VIE","MUC","HEL","CPH","FCO","MAD","ATH","WAW","SIN","BKK","KUL","HKG"];
function canFly(a,b){
  if(a===b)return false;
  const A=AP[a],B=AP[b],ra=regionOf(a),rb=regionOf(b),d=distKm(a,b),pair=(x,y)=>(ra===x&&rb===y)||(ra===y&&rb===x);
  if(ra==="AS"||rb==="AS"){
    if(ra==="IN"||rb==="IN"){const i=ra==="IN"?a:b,o=ra==="IN"?b:a;return (GW_AS[i]||[]).includes(o)}
    return asLink(a,b)||A.feeder===b||B.feeder===a;
  }
  if(ra==="IN"&&rb==="IN")return true;
  if(pair("IN","GULF")||(ra==="GULF"&&rb==="GULF"))return true;
  if(pair("IN","EU")||pair("IN","RU")){const i=ra==="IN"?a:b,o=ra==="IN"?b:a;return GW_IN[i].includes(o)}
  if(pair("GULF","EU")||pair("GULF","RU")){const e=ra==="GULF"?B:A;return e.size>=2&&d<=7600}
  if(ra==="RU"&&rb==="RU")return true;
  if(pair("RU","EU")){const e=ra==="RU"?B:A;return e.country==="Turkey"||e.country==="Serbia"}   // other Russia–Europe routes are suspended
  if(A.feeder===b||B.feeder===a)return true;
  if(A.size===1||B.size===1)return d<=2500&&Math.max(A.size,B.size)===3;                       // small/seasonal airports: served from big hubs
  return d<=3800;
}

/* ---------- itineraries: non-stop first, then one-stop via hubs; small airports connect through their feeder hub ---------- */
const legsKm=p=>{let k=0;for(let i=0;i<p.length-1;i++)k+=distKm(p[i],p[i+1]);return k};
function corePaths(a,b){
  const out=[];if(canFly(a,b))out.push([a,b]);
  const asia=regionOf(a)==="AS"||regionOf(b)==="AS";
  const hubs=asia?[...HUBS,...IN_HUBS]:HUBS;
  for(const h of hubs)if(h!==a&&h!==b&&canFly(a,h)&&canFly(h,b))out.push([a,h,b]);
  if(!out.length)                                   // no common hub (e.g. a small European airport to Myanmar): connect through two hubs
    for(const h of hubs)if(h!==a&&h!==b&&canFly(a,h))for(const g of hubs)if(g!==h&&g!==a&&g!==b&&canFly(h,g)&&canFly(g,b))out.push([a,h,g,b]);
  if(!out.length){                                  // rare pairs between two remote regions: shortest chain of up to three hubs
    const dfs=(path,depth)=>{const last=path[path.length-1];
      if(canFly(last,b)&&path.length>1){out.push([...path,b]);return}
      if(depth===0)return;
      for(const h of hubs)if(!path.includes(h)&&h!==b&&canFly(last,h))dfs([...path,h],depth-1)};
    dfs([a],3);
  }
  return out;
}
function itineraries(o,d){
  const O=AP[o],D=AP[d],oc=O.size===3?o:O.feeder,dc=D.size===3?d:D.feeder,as=[o],bs=[d];
  if(oc&&oc!==o)as.push(oc);if(dc&&dc!==d)bs.push(dc);
  const seen=new Set(),out=[];
  const push=p=>{if(p.length>6||new Set(p).size!==p.length)return;for(let i=0;i<p.length-1;i++)if(!canFly(p[i],p[i+1]))return;const k=p.join(">");if(!seen.has(k)){seen.add(k);out.push(p)}};
  for(const a of as)for(const b of bs)for(const cp of corePaths(a,b))push([...(a!==o?[o]:[]),...cp,...(b!==d?[d]:[])]);
  return out;
}
function pickRoutes(o,d){
  const direct=distKm(o,d),all=itineraries(o,d).map(p=>({p,stops:p.length-2,km:legsKm(p)}));
  const non=all.filter(x=>x.stops===0),multi=all.filter(x=>x.stops>0).sort((x,y)=>x.stops-y.stops||x.km-y.km);
  if(non.length){const one=direct>2500?multi.filter(x=>x.stops===1&&x.km<=direct*1.7+900):[];return [...non,...one.slice(0,4)]}
  const min=multi.length?multi[0].stops:0,best=multi.filter(x=>x.stops===min);
  return [...best,...multi.filter(x=>x.stops===min+1)].slice(0,5);
}

/* ---------- airlines ---------- */
const HUB_CARRIERS={BKK:["Thai Airways"],SIN:["Singapore Airlines"],KUL:["Malaysia Airlines"],HKG:["Cathay Pacific"],NRT:["Japan Airlines","ANA"],HND:["Japan Airlines","ANA"],KIX:["Japan Airlines","ANA"],PEK:["Air China"],PVG:["China Eastern"],CAN:["China Southern"],KTM:["Nepal Airlines"],PBH:["Drukair"],CMB:["SriLankan Airlines"],DAC:["Biman Bangladesh Airlines"],RGN:["Myanmar Airways International"],LHE:["Pakistan International Airlines"],ISB:["Pakistan International Airlines"],KHI:["Pakistan International Airlines"],KBL:["Ariana Afghan Airlines","Kam Air"],LHR:["British Airways","Virgin Atlantic"],CDG:["Air France"],AMS:["KLM"],FRA:["Lufthansa"],MUC:["Lufthansa"],ZRH:["SWISS"],GVA:["SWISS"],VIE:["Austrian Airlines"],BRU:["Brussels Airlines"],FCO:["ITA Airways"],MXP:["ITA Airways"],MAD:["Iberia"],LIS:["TAP Air Portugal"],OPO:["TAP Air Portugal"],ATH:["Aegean Airlines"],IST:["Turkish Airlines"],CPH:["SAS"],ARN:["SAS"],OSL:["SAS"],HEL:["Finnair"],KEF:["Icelandair"],MLA:["KM Malta Airlines"],LUX:["Luxair"],BEG:["Air Serbia"],SVO:["Aeroflot"],WAW:["LOT Polish Airlines"],DXB:["Emirates"],AUH:["Etihad Airways"],DOH:["Qatar Airways"]};
const COUNTRY_FS={Japan:["Japan Airlines","ANA"],China:["Air China","China Eastern","China Southern"],Thailand:["Thai Airways"],Malaysia:["Malaysia Airlines"],Nepal:["Nepal Airlines"],Bhutan:["Drukair","Bhutan Airlines"],"Sri Lanka":["SriLankan Airlines"],Bangladesh:["Biman Bangladesh Airlines"],Pakistan:["Pakistan International Airlines"],Myanmar:["Myanmar Airways International"],Singapore:["Singapore Airlines"],"Hong Kong":["Cathay Pacific"],Afghanistan:["Ariana Afghan Airlines","Kam Air"],Italy:["ITA Airways"],Spain:["Iberia"],France:["Air France"],Austria:["Austrian Airlines"],Belgium:["Brussels Airlines"],Denmark:["SAS"],Germany:["Lufthansa"],Russia:["Aeroflot","S7 Airlines"],Greece:["Aegean Airlines"],Portugal:["TAP Air Portugal"],Norway:["SAS"],Sweden:["SAS"],Switzerland:["SWISS"],Turkey:["Turkish Airlines"],"United Kingdom":["British Airways"],Luxembourg:["Luxair"],Malta:["KM Malta Airlines"],Iceland:["Icelandair"],Serbia:["Air Serbia"],Poland:["LOT Polish Airlines"],Netherlands:["KLM"],Finland:["Finnair"]};
const COUNTRY_LCC={Japan:["Peach"],Thailand:["Thai AirAsia","Thai Lion Air"],Malaysia:["AirAsia"],Singapore:["Scoot"],Bangladesh:["US-Bangla Airlines"],Nepal:["Buddha Air","Yeti Airlines","Tara Air"],China:["Spring Airlines"],Italy:["Ryanair","easyJet"],Spain:["Vueling","Ryanair"],France:["easyJet","Transavia"],Austria:["Eurowings","Wizz Air"],Belgium:["Ryanair"],Denmark:["Norwegian","Ryanair"],Germany:["Eurowings","Ryanair"],Russia:["Pobeda"],Greece:["Ryanair","SKY express"],Portugal:["Ryanair","easyJet"],Norway:["Norwegian"],Sweden:["Norwegian","Ryanair"],Switzerland:["easyJet"],Turkey:["Pegasus Airlines","AJet"],"United Kingdom":["easyJet","Ryanair","Jet2"],Luxembourg:["Ryanair"],Malta:["Ryanair"],Iceland:["easyJet","Wizz Air"],Serbia:["Wizz Air"],Poland:["Ryanair","Wizz Air"],Netherlands:["easyJet","Transavia"],Finland:["Norwegian"]};
const INDIGO_EU=["IST","AMS","CPH","ATH","LHR"],INDIGO_AS=["BKK","HKT","KUL","SIN","CMB","KTM","DAC","MLE","HKG","CAN"];
const fsOf=c=>HUB_CARRIERS[c]||COUNTRY_FS[AP[c].country]||[];
function carriersFor(a,b){                      // → [{n:name, lcc:boolean}]
  const ra=regionOf(a),rb=regionOf(b),F=n=>({n,lcc:false}),L=n=>({n,lcc:true}),d=distKm(a,b);
  if(ra==="IN"&&rb==="IN")return [L("IndiGo"),F("Air India"),L("Akasa Air"),L("Air India Express"),L("SpiceJet")];
  const gulf=ra==="GULF"?a:rb==="GULF"?b:null,ind=ra==="IN"?a:rb==="IN"?b:null,oth=ind===a?b:a;
  if(ind&&gulf){const g=gulf==="DXB"?[F("Emirates"),L("flydubai")]:fsOf(gulf).map(F);return [...g,F("Air India"),L("IndiGo"),L("Air India Express")]}
  if(gulf)return [...fsOf(gulf).map(F),...(gulf==="DXB"?[L("flydubai")]:[])];
  if(ind)return [F("Air India"),...fsOf(oth).map(F),...((INDIGO_EU.includes(oth)||INDIGO_AS.includes(oth))?[L("IndiGo")]:[])];
  const LONG_AS=["BKK","SIN","KUL","HKG","NRT","HND","KIX","PEK","PVG","CAN","CMB"],asE=ra==="AS"?a:rb==="AS"?b:null,euE=asE===a?b:a;
  if(asE&&(regionOf(euE)==="EU"||regionOf(euE)==="RU")&&!LONG_AS.includes(asE)){const only=fsOf(euE).map(F);return only.length?only:[F("Multiple carriers")]}
  const pool=[...new Set([...fsOf(a),...fsOf(b)])].map(F);
  if(d<=3800)for(const n of new Set([...(COUNTRY_LCC[AP[a].country]||[]),...(COUNTRY_LCC[AP[b].country]||[])]))pool.push(L(n));
  return pool.length?pool:[F("Multiple carriers")];
}

/* ---------- time, price ---------- */
function legMin(a,b){
  const d=distKm(a,b),sp=d<=1000?680:d<=3000?760:840,east=(((AP[b].lng-AP[a].lng)+540)%360)-180>0;
  return Math.round((d/sp*60+(d<=1000?42:d<=3000?30:35))*(d>3000?(east?0.97:1.04):1)/5)*5;
}
const basePrice=(d,dom)=>dom?2200+2.6*d:d<=3500?3200+4.3*d:18250+(d-3500)*6.0;      // INR
function dateFactor(ds){
  if(!ds)return 1;const dt=new Date(ds+"T00:00:00"),m=dt.getMonth()+1,day=dt.getDate(),wk=dt.getDay();
  let f=1;if(wk===5||wk===0)f*=1.06;
  if((m===6&&day>=15)||m===7||m===8||(m===12&&day>=15)||(m===1&&day<=5))f*=1.16;
  const days=Math.round((dt-new Date(new Date().toDateString()))/864e5);
  if(days<=3)f*=1.35;else if(days<=14)f*=1.18;else if(days<=30)f*=1.06;else if(days>75)f*=0.93;
  return f;
}
const SLOTS_LONG=["00:55","02:10","03:35","05:50","08:25","10:40","13:15","15:45","18:10","20:35","22:15","23:40"];
const SLOTS_SHORT=["06:10","07:25","08:50","10:15","11:40","13:05","14:35","16:00","17:30","19:05","20:25","21:50"];
const pad2=n=>String(n).padStart(2,"0"),fmt=m=>pad2(Math.floor(m/60))+":"+pad2(m%60);

/* ---------- the generator: rows = [from,to,airline,dep,arr,durMin,stops,route,info,priceINR,0,1] ---------- */
function generateFlights(o,d,ds){
  const rng=rngOf(hash(o+">"+d)),refDate=ds||"2026-11-15",dom=regionOf(o)==="IN"&&regionOf(d)==="IN",D0=distKm(o,d),rows=[];
  const routes=pickRoutes(o,d),slots=D0>3500?SLOTS_LONG:SLOTS_SHORT;
  routes.forEach((r,ri)=>{
    const p=r.p,stops=r.stops,variants=stops===0?(routes.length>1?3:5):2,used=new Set();
    for(let v=0;v<variants;v++){
      let k=Math.floor(rng()*slots.length);while(used.has(k))k=(k+1)%slots.length;used.add(k);
      const dep=slots[k].split(":").map(Number),depMin=dep[0]*60+dep[1]+(Math.floor(rng()*5)-2)*5,depLocal=((depMin%1440)+1440)%1440;
      const legs=[],lay=[];let tot=0,lcc=0,longest=-1,airline="";
      for(let i=0;i<p.length-1;i++){
        const pool=carriersFor(p[i],p[i+1]),pick=(stops>0?pool.filter(c=>!c.lcc):pool),use=pick.length?pick:pool,c=use[Math.floor(rng()*use.length)],m=legMin(p[i],p[i+1]);
        legs.push({c,m});tot+=m;if(c.lcc)lcc++;if(m>longest){longest=m;airline=c.n}
        if(i<p.length-2){const L=Math.round((rng()<0.14?250+rng()*160:75+rng()*155)/5)*5;lay.push(L);tot+=L}
      }
      const business=ri===0&&v===variants-1&&D0>2500&&!dom;
      const arrAbs=depLocal+tot+Math.round((tzOff(p[p.length-1],refDate)-tzOff(o,refDate))*60),dayN=Math.floor(arrAbs/1440),arrLocal=((arrAbs%1440)+1440)%1440;
      const long=lay.filter(x=>x>=240).length;
      let info=business?"Business class":long?(long>1?"2 Long layover":"1 Long layover"):(stops===1&&lay[0]<110)?"1 Short layover":(depLocal>=1320||depLocal<300)?"Red-eye flight":lcc?"No check-in baggage included":"Meal and baggage included";
      const lccShare=lcc/legs.length,carrierF=1-lccShare*(dom?0.18:0.4),stopF=stops===0?1.1:stops===1?0.95:0.88;
      let price=basePrice(stops>0?Math.max(D0,0.8*legsKm(p)):D0,dom)*carrierF*stopF*(0.92+rng()*0.38)*(business?3.2:1)*dateFactor(ds);
      rows.push([o,d,airline,fmt(depLocal),fmt(arrLocal)+(dayN>0?" +"+dayN:dayN<0?" "+dayN:""),tot,stops,p.join(" > "),info,Math.round(price/5)*5,0,1]);
    }
  });
  return rows;
}

/* ---------- destinations ---------- */
function airportFor(x){
  const k=x.destination+"|"+x.country;if(DEST_AIRPORT[k])return DEST_AIRPORT[k];
  let best="",bd=1e9;AIRPORT_LIST.forEach(a=>{if(a.country===x.country){const dd=llKm(+x.lat,+x.lng,a.lat,a.lng);if(dd<bd){bd=dd;best=a.code}}});return best;
}
function destNote(x){return x.country==="Ukraine"?"note_ua":x.country==="Monaco"?"note_mc":x.country==="Russia"?"note_ru":x.country==="Pakistan"?"note_pk":x.country==="Afghanistan"?"note_af":x.country==="Myanmar"?"note_mm":x.country==="Bhutan"?"note_bt":""}
