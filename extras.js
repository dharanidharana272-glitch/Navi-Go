/* Per-country travel tools: emergency numbers, INR currency converter (live rates), packing checklist. */
(function () {
  const EM = { Italy: "112 (all)", Spain: "112 (all)", France: "112 (all)", Austria: "112 (all)", Belgium: "112 (all)", Denmark: "112 (all)", Germany: "112 (all)", Monaco: "112 (all); police 17", Russia: "112 (all)", Greece: "112 (all)", Portugal: "112 (all)", Norway: "112 police, 113 ambulance", Sweden: "112 (all)", Switzerland: "112 (all); police 117, ambulance 144", Turkey: "112 (all)", Ukraine: "112 (all)", "United Kingdom": "999 or 112 (all)", Luxembourg: "112 (all)", Malta: "112 (all)", Iceland: "112 (all)", Serbia: "112 (all)", Japan: "110 police, 119 ambulance and fire", Nepal: "100 police, 102 ambulance", Bhutan: "113 police, 112 ambulance", "Sri Lanka": "119 police, 1990 ambulance", Maldives: "119 police, 102 ambulance", Bangladesh: "999 (all)", Myanmar: "199 police, 192 ambulance", Pakistan: "15 police, 115 ambulance", Afghanistan: "119 police", China: "110 police, 120 ambulance", Thailand: "191 police, 1669 medical, 1155 tourist police", Malaysia: "999 (all); 112 from mobile" };
  const PACK = ["Passport (valid 6+ months) and visa/e-visa printout", "Tickets and hotel bookings", "Travel insurance", "Phone, charger and power adapter", "Medicines and a copy of prescriptions", "Some local cash and a card that works abroad", "Weather-suitable clothes and comfortable shoes", "Copies of documents stored separately"];
  const TX = { en: ["Travel tools", "Emergency numbers", "Currency converter", "Packing checklist", "(also confirm locally)"], ta: ["பயணக் கருவிகள்", "அவசர எண்கள்", "நாணய மாற்றி", "பேக்கிங் பட்டியல்", "(உள்ளூரிலும் உறுதிசெய்யவும்)"], hi: ["यात्रा उपकरण", "आपातकालीन नंबर", "मुद्रा परिवर्तक", "पैकिंग सूची", "(स्थानीय रूप से भी पुष्टि करें)"], ml: ["യാത്രാ ഉപകരണങ്ങൾ", "അടിയന്തര നമ്പറുകൾ", "കറൻസി കൺവെർട്ടർ", "പാക്കിംഗ് പട്ടിക", "(പ്രാദേശികമായും ഉറപ്പാക്കുക)"] };
  let rates = null;
  const getRates = () => rates || (rates = fetch("https://open.er-api.com/v6/latest/INR").then(r => r.json()).then(j => { if (j.result !== "success") throw 0; return j.rates; }).catch(() => (rates = null, null)));
  const E = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const orig = renderCountry;
  renderCountry = function (name) {
    orig(name);
    const grid = document.querySelector("#countryResult .destination-grid, .destination-grid"); if (!grid) return;
    document.getElementById("travelTools")?.remove();
    const cur = (demoData.find(d => d.country === name) || {}).currency || "", code = (/\(([A-Z]{3})\)/.exec(cur) || [])[1];
    const s = document.createElement("section"); s.id = "travelTools"; s.className = "visa-card-info"; s.style.margin = "12px 0";
    const L = TX[typeof LANG === "string" && TX[LANG] ? LANG : "en"];
    s.innerHTML = "<h3>" + L[0] + "</h3>" + (EM[name] ? "<p><b>" + L[1] + ":</b> " + E(EM[name]) + " <small>" + L[4] + "</small></p>" : "") +
      (code ? '<p><b>' + L[2] + ':</b> ₹ <input id="cvIn" type="number" min="0" value="1000" style="width:100px"> = <b id="cvOut">…</b> ' + E(code) + ' <small id="cvNote"></small></p>' : "") +
      "<details><summary><b>" + L[3] + "</b></summary>" + PACK.map((p, i) => '<label style="display:block"><input type="checkbox" data-p="' + i + '"> ' + E(p) + "</label>").join("") + "</details>";
    grid.parentNode.insertBefore(s, grid);
    if (code) getRates().then(r => {
      const o = document.getElementById("cvOut"), n = document.getElementById("cvNote"); if (!o) return;
      if (!r || !r[code]) { o.textContent = "n/a"; n.textContent = "(live rates need internet, or this currency is unsupported)"; return; }
      const f = () => { const v = +document.getElementById("cvIn").value || 0; o.textContent = (v * r[code]).toLocaleString(undefined, { maximumFractionDigits: 2 }); };
      document.getElementById("cvIn").oninput = f; f(); n.textContent = "(approximate market rate, not a bank rate)";
    });
  };
})();
