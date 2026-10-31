/* Navi Go AI - entry rules for Indian passport holders (shown on Home and on each country page).
   Source: Ministry of External Affairs "Visa Facility for Indian Nationals" list (updated 2 Feb 2026) plus the official
   announcements for Thailand (30 days from 15 Sep 2026) and Sri Lanka (free 30-day ETA from 25 May 2026), checked on 12 Oct 2026.
   Rules change often: update VISA and VISA_CHECKED together. k: "free" = no visa needed; "eta" = free online authorisation, not strictly visa-free. */
const VISA_CHECKED="12 Oct 2026";
const VISA={
  Nepal:{k:"free",n:"np"},Bhutan:{k:"free",n:"bt"},Maldives:{k:"free",n:"mv"},
  Thailand:{k:"free",n:"th"},Malaysia:{k:"free",n:"my"},"Sri Lanka":{k:"eta",n:"lk"}
};
const visaBadge=c=>VISA[c]?`<span class="visa-badge ${VISA[c].k}">${ic("check")}${t(VISA[c].k==="free"?"v_free":"v_eta")}</span>`:"";
function buildVisa(){
  const box=$("visaRail");if(!box)return;
  const order=Object.keys(VISA).filter(c=>demoData.some(d=>d.country===c)).sort((a,b)=>(VISA[a].k===VISA[b].k?0:VISA[a].k==="free"?-1:1)||tot(b)-tot(a));
  function tot(c){return demoData.filter(d=>d.country===c).reduce((s,d)=>s+d.tm,0)}
  box.innerHTML=order.map(c=>`<button type="button" class="rail-card visa-card ph" data-img="${esc(photoQ(heroOf(c)))}" style="--h:${hue(c)}" onclick="openCountry('${c}')"><span class="ph-i">${fl(c)}</span>${visaBadge(c)}<b>${esc(tv("country",c))}</b><em>${t("vs_"+VISA[c].n)}</em></button>`).join("");
  $("visaNote").textContent=t("visa_note",{d:VISA_CHECKED});
}
function visaCard(c){
  const v=VISA[c];if(!v)return "";
  return `<section class="visa-card-info ${v.k}" aria-label="${esc(t("visaTitle"))}"><h3>${ic("check")}${t("visaTitle")} ${visaBadge(c)}</h3><p>${t("visa_"+v.n)}</p><small>${t("visa_note",{d:VISA_CHECKED})}</small></section>`;
}
