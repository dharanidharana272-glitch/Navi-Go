/* Navi Go AI - LIVE weather for every destination (current conditions only, no forecast)
   Source  : Open-Meteo "current" endpoint (free, no API key) for the destination's exact latitude/longitude.
   Needs   : an internet connection. Offline -> clear "No internet" message; old data is never shown as live.
   Refresh : re-requested every 60 s while the destination page is open (Open-Meteo publishes a new value every 15 min,
             so a new reading appears as soon as it exists). HTTP cache is bypassed; only a 45 s in-memory cache is kept.
   Honesty : the card shows the reading's own timestamp (destination local time) and its age, so it can be checked. */
const WX_URL="https://api.open-meteo.com/v1/forecast",
  WX_FIELDS="temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day",
  WX_REFRESH=60*1000, WX_MEM=45*1000, WX_OLD=35*60*1000;
let wxSeq=0,wxIdx=null,wxData=null,wxErr=null,wxBusy=false,wxTimer=0,wxTick=0;
const wxMem={};

/* WMO weather code -> kind (Open-Meteo documentation) */
const wxKind=c=>c===0?"clear":c===1?"mostly":c===2?"partly":c===3?"cloudy":(c===45||c===48)?"fog":(c>=51&&c<=57)?"drizzle":(c>=61&&c<=67)?"rain":((c>=71&&c<=77)||c===85||c===86)?"snow":(c>=80&&c<=82)?"showers":c>=95?"storm":"cloudy";
const WX_ICON={clear:["sun","moon"],mostly:["sun","moon"],partly:["cloud-sun","cloud-moon"],cloudy:["cloud","cloud"],fog:["fog","fog"],drizzle:["rain","rain"],rain:["rain","rain"],showers:["rain","rain"],snow:["snow","snow"],storm:["storm","storm"]};
const wxIcon=(code,day)=>ic("wx-"+WX_ICON[wxKind(code)][day?0:1]);
const wxDir=d=>["N","NE","E","SE","S","SW","W","NW"][Math.round((((+d%360)+360)%360)/45)%8];

/* ---------- data ---------- */
function wxValid(d){
  const c=d&&d.current;if(!c)return false;
  const n=k=>typeof c[k]==="number"&&isFinite(c[k]);
  return n("temperature_2m")&&c.temperature_2m>-90&&c.temperature_2m<60&&n("weather_code")&&n("wind_speed_10m")&&n("relative_humidity_2m")&&c.relative_humidity_2m>=0&&c.relative_humidity_2m<=100&&typeof c.time==="string";
}
const wxObserved=d=>{const t=Date.parse(d.current.time+":00Z");return isFinite(t)?t-(d.utc_offset_seconds||0)*1000:NaN};   // reading time as a real instant
function wxFetch(la,lo){
  if(navigator.onLine===false)return Promise.reject(new Error("offline"));
  const key=la.toFixed(4)+","+lo.toFixed(4),hit=wxMem[key];
  if(hit&&Date.now()-hit.at<WX_MEM)return Promise.resolve(hit.d);
  const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),8000);
  const url=WX_URL+"?latitude="+la+"&longitude="+lo+"&current="+WX_FIELDS+"&timezone=auto&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm";
  return fetch(url,{signal:ctl.signal,cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("http "+r.status);return r.json()}).finally(()=>clearTimeout(tm)).then(d=>{
    if(!wxValid(d))throw new Error("bad data");
    wxMem[key]={at:Date.now(),d};return d;
  });
}
function wxLoad(){                                  // one request for the destination on screen
  if(wxIdx===null||wxBusy)return;
  const i=wxIdx,x=demoData[i],seq=wxSeq;
  if(navigator.onLine===false){wxData=null;wxErr="offline";wxDraw();return}
  wxBusy=true;
  wxFetch(+x.lat,+x.lng).then(d=>{if(seq!==wxSeq||wxIdx!==i)return;wxData=d;wxErr=null})
    .catch(e=>{if(seq!==wxSeq||wxIdx!==i)return;
      if(navigator.onLine===false||(e&&e.message==="offline")){wxData=null;wxErr="offline"}
      else if(!wxData)wxErr="error";})                 // keep the last good reading (its age is shown) if a refresh fails
    .finally(()=>{wxBusy=false;if(seq===wxSeq)wxDraw()});
}
const wxVisible=()=>wxIdx!==null&&state.detail===wxIdx&&$("detailsPage")&&$("detailsPage").classList.contains("active-page");
function wxTimers(){
  clearInterval(wxTimer);clearInterval(wxTick);
  wxTimer=setInterval(()=>{if(!wxVisible()){clearInterval(wxTimer);clearInterval(wxTick);wxTimer=wxTick=0;return}if(!document.hidden)wxLoad()},WX_REFRESH);
  wxTick=setInterval(()=>{if(wxVisible())wxDraw()},30000);   // keeps "x min ago" and local time moving
}
function wxMount(i){                                // called by openDetails()
  if(wxIdx!==i){wxData=null;wxErr=null}
  wxIdx=i;wxSeq++;wxBusy=false;
  wxDraw();wxLoad();wxTimers();
}
function wxRetry(){wxErr=null;wxBusy=false;wxDraw();wxLoad()}
function wxJump(){const e=$("wxLive");if(e)e.scrollIntoView({behavior:"smooth",block:"center"})}

/* ---------- drawing ---------- */
function wxLocalTime(d){try{return new Intl.DateTimeFormat(locale(),{timeZone:d.timezone,hour:"2-digit",minute:"2-digit"}).format(new Date())}catch(e){return ""}}
function wxCard(x){
  const head=`<div class="wx-head"><span class="wx-badge"><i></i>${t("wx_badge")}</span><h2>${t("wx_title")}</h2><span class="wx-loc">${esc(tv("country",x.country))}</span></div>`;
  if(wxErr==="offline")return head+`<div class="wx-msg">${ic("wx-cloud-off")}<p>${t("wx_offline")}</p></div>`;
  if(!wxData&&wxErr)return head+`<div class="wx-msg">${ic("wx-cloud-off")}<p>${t("wx_err")}</p><button type="button" class="secondary-btn" onclick="wxRetry()">${t("wx_retry")}</button></div>`;
  if(!wxData)return head+`<div class="wx-msg"><p>${t("wx_loading")}</p></div>`;
  const d=wxData,c=d.current,day=c.is_day===1,obs=wxObserved(d),age=Date.now()-obs;
  const ageMin=isFinite(age)&&age>=-5*60000&&age<6*3600000?Math.max(0,Math.floor(age/60000)):null;
  const hhmm=c.time.slice(11,16);
  const ago=ageMin===null?"":" · "+(ageMin<1?t("wx_justnow"):t("wx_ago",{n:ageMin}));
  const old=ageMin!==null&&age>WX_OLD?`<div class="wx-warn">${ic("info")}<span>${t("wx_stale",{n:ageMin})}</span></div>`:"";
  const gust=typeof c.wind_gusts_10m==="number"&&c.wind_gusts_10m-c.wind_speed_10m>=10?` <small>${t("wx_gust")} ${Math.round(c.wind_gusts_10m)}</small>`:"";
  const cell=(k,v)=>`<div><dt>${t(k)}</dt><dd>${v}</dd></div>`;
  const coords=(+x.lat).toFixed(3)+", "+(+x.lng).toFixed(3);
  return head+old+`<div class="wx-main">${wxIcon(c.weather_code,day)}<div class="wx-temp"><strong>${Math.round(c.temperature_2m)}°C</strong><span>${t("wx_"+wxKind(c.weather_code))}</span></div><div class="wx-side"><small>${t("wx_feels")}</small><b>${Math.round(c.apparent_temperature)}°C</b><small>${t("wx_local")}</small><b>${esc(wxLocalTime(d))}</b></div></div>`+
    `<dl class="wx-grid">${cell("wx_hum",Math.round(c.relative_humidity_2m)+"%")}${cell("wx_wind",Math.round(c.wind_speed_10m)+" km/h "+(typeof c.wind_direction_10m==="number"?wxDir(c.wind_direction_10m):"")+gust)}${cell("wx_precip",(c.precipitation||0).toFixed(1)+" mm")}${cell("wx_cloud",Math.round(c.cloud_cover)+"%")}${cell("wx_press",Math.round(c.pressure_msl)+" hPa")}</dl>`+
    `<p class="wx-upd">${ic("clock")}${t("wx_updated",{t:hhmm})}${ago}</p><p class="wx-foot">${t("wx_auto")} ${t("wx_point",{c:coords})}</p>`+
    `<div class="wx-links"><a target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent("weather "+x.destination+" "+x.country)}">${t("wx_google")}</a><span>${t("wx_source")}</span></div>`;
}
function wxDraw(){
  if(wxIdx===null)return;
  const x=demoData[wxIdx],box=$("wxBox"),live=$("wxLive");
  if(box){
    let icon=ic("wx-cloud"),txt="--",cls="";
    if(wxData){const c=wxData.current;icon=wxIcon(c.weather_code,c.is_day===1);txt=Math.round(c.temperature_2m)+"°"}
    else if(wxErr){icon=ic("wx-cloud-off");txt=wxErr==="offline"?t("wx_chip_off"):"!";cls=" off"}
    box.innerHTML=`<button class="wx${cls}" type="button" aria-label="${esc(t("wx_title"))}" onclick="wxJump()">${icon}<span>${esc(txt)}</span></button>`;
  }
  if(live)live.innerHTML=`<section class="wx-card" aria-live="polite">${wxCard(x)}</section>`;
}
window.addEventListener("online",()=>{if(wxVisible()){wxErr=null;wxLoad()}});                    // connection is back -> load live weather
window.addEventListener("offline",()=>{if(wxVisible()){wxSeq++;wxBusy=false;wxData=null;wxErr="offline";wxDraw()}});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&wxVisible())wxLoad()});   // came back to the tab -> refresh now
