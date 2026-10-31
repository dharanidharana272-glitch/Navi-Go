/* Regenerates the CSV datasets from the same model the website uses.
   Usage:  node tools/build_dataset.js          (run from the project folder) */
const fs=require("fs"),vm=require("vm"),path=require("path"),root=path.join(__dirname,"..");
const load=f=>fs.readFileSync(path.join(root,f),"utf8");
vm.runInThisContext(load("airports.js")+load("flights.js")+load("data.js")+";globalThis.M={AP,AIRPORT_LIST,generateFlights,airportFor,destNote,demoData,llKm}");
const {AP,AIRPORT_LIST,generateFlights,airportFor,destNote,demoData,llKm}=globalThis.M;
const NOTES={note_ua:"Ukraine airspace closed to commercial flights - fly to Rzeszow (Poland) and continue overland",note_mc:"Monaco has no airport - fly to Nice (NCE)",note_ru:"Airport closures possible - check travel advisories"};
const q=v=>{v=String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const csv=(head,rows)=>[head.join(","),...rows.map(r=>r.map(q).join(","))].join("\n")+"\n";
const out=(f,t)=>{fs.writeFileSync(path.join(root,f),"\ufeff"+t);console.log(f,t.split("\n").length-2,"rows")};

out("Airports.csv",csv(["code","city","country","lat","lng","utc_offset","size","feeder_hub"],
  AIRPORT_LIST.map(a=>[a.code,a.city,a.country,a.lat,a.lng,a.tz,a.size,a.feeder])));

out("Destination_Airports.csv",csv(["destination","country","airport_code","airport_city","distance_km","note"],
  demoData.map(x=>{const c=airportFor(x),a=AP[c];return [x.destination,x.country,c,a.city,Math.round(llKm(+x.lat,+x.lng,a.lat,a.lng)),NOTES[destNote(x)]||""]})));

/* India → every airport (7 origins × 109 destinations), base fares without date adjustments */
const IN=AIRPORT_LIST.filter(a=>a.country==="India").map(a=>a.code),rows=[];
for(const o of IN)for(const a of AIRPORT_LIST){if(a.code===o)continue;for(const r of generateFlights(o,a.code))rows.push([r[0],r[1],r[2],r[3],r[4],r[5],r[6],r[7],r[8],r[9]])}
out("International_Flights.csv",csv(["from","to","airline","departure","arrival","duration_min","stops","route","info","price_inr"],rows));
