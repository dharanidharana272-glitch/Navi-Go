/* Navi Go AI – place photos
   Every element with [data-img="<search text>"] gets a real photo of that place.
   Source : Wikipedia page images (public CORS API), looked up lazily when the element scrolls into view.
   Cache  : localStorage ("naviImg2"), so each photo is fetched only once.
   Offline: the element keeps its coloured gradient + category icon (graceful fallback). */
const IMG_KEY="naviImg2",IMG_BAD=/\.svg|flag|map|coat_of|logo|locator|emblem|seal/i;
let imgCache={};try{imgCache=JSON.parse(localStorage.getItem(IMG_KEY)||"{}")}catch(e){}
const imgQueue=[],imgSeen=new Set();let imgBusy=0;
const hue=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%360;return 150+h%70};

function lookupImage(q){
  const url="https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=3&gsrsearch="+encodeURIComponent(q)+"&prop=pageimages&piprop=thumbnail&pithumbsize=480&pilimit=3";
  const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),10000);
  return fetch(url,{signal:ctl.signal}).then(r=>r.json()).finally(()=>clearTimeout(tm)).then(j=>{
    const pages=Object.values((j.query||{}).pages||{}).filter(p=>p.thumbnail&&!IMG_BAD.test(p.thumbnail.source)).sort((a,b)=>a.index-b.index);
    return pages.length?pages[0].thumbnail.source:"";
  });
}
function paint(el,src){
  const im=new Image();
  im.onload=()=>{el.style.backgroundImage=`url("${src}")`;el.classList.add("has-img")};
  im.src=src;
}
const warmQueue=[],MAX_PARALLEL=4;
function store(q,src){imgCache[q]=src;try{localStorage.setItem(IMG_KEY,JSON.stringify(imgCache))}catch(e){}}
/* visible images first, then the background "warm-up" list */
function pump(){
  while(imgBusy<MAX_PARALLEL&&(imgQueue.length||warmQueue.length)){
    const el=imgQueue.shift(),q=el?el.dataset.img:warmQueue.shift();
    if(el&&imgCache[q]){paint(el,imgCache[q]);continue}
    if(!el&&imgCache[q])continue;
    imgBusy++;
    lookupImage(q).then(src=>{if(src){store(q,src);if(el)paint(el,src)}}).catch(()=>{}).finally(()=>{imgBusy--;pump()});
  }
}
/* after login, look up every destination photo in the background so later pages open instantly */
function warmAll(){
  const nc=navigator.connection;if((nc&&nc.saveData)||navigator.onLine===false)return;     // data-saver / offline: load photos only when they scroll into view
  const app=document.getElementById("appView");
  if(!app||app.classList.contains("hidden")||typeof demoData==="undefined"||typeof photoQ==="undefined"){setTimeout(warmAll,2000);return}
  demoData.forEach(x=>{const q=photoQ(x);if(!imgCache[q]&&!warmQueue.includes(q))warmQueue.push(q)});pump();
}
setTimeout(warmAll,1200);
const imgObserver="IntersectionObserver" in window?new IntersectionObserver(es=>es.forEach(e=>{
  if(!e.isIntersecting)return;imgObserver.unobserve(e.target);
  const el=e.target,q=el.dataset.img;
  if(imgCache[q])paint(el,imgCache[q]);else{imgQueue.push(el);pump()}
}),{rootMargin:"700px"}):null;

function scanImages(){
  document.querySelectorAll("[data-img]").forEach(el=>{
    if(imgSeen.has(el))return;imgSeen.add(el);
    if(imgObserver)imgObserver.observe(el);else if(imgCache[el.dataset.img])paint(el,imgCache[el.dataset.img]);
  });
}
let scanTimer;
new MutationObserver(()=>{clearTimeout(scanTimer);scanTimer=setTimeout(scanImages,60)}).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener("DOMContentLoaded",scanImages);
