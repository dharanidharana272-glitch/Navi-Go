/* Server-backed accounts, favourites, reviews, saved trips. Loaded after script.js: replaces its localStorage login. */
(function () {
  let offline = false;
  const oCreate = createAccount, oLogin = login, oGet = getUser;
  const api = async (m, u, b) => {
    let r; try { r = await fetch(u, { method: m, credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Requested-With": "navigo" }, body: b ? JSON.stringify(b) : undefined }); } catch (e) { return { status: 0, error: "offline" }; }
    if (!/json/.test((r.headers && r.headers.get && r.headers.get("content-type")) || "")) return { status: 0, error: "offline" }; // static host (VS Code Live Server etc.) has no /api
    const j = await r.json().catch(() => ({})); j.status = r.status; return j;
  };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const key = i => demoData[i].destination + "|" + demoData[i].country;
  const errMap = { email: "t_email", pw: "t_pw8", dob: "t_dobInvalid", under18: "t_under18", exists: "t_exists", noacct: "t_noAcct", wrong: "t_wrong" };
  const fail = (j) => { const k = errMap[j.error]; toast(j.error === "locked" ? t("t_locked", { s: j.seconds }) : k ? t(k) : t("t_error"), 1); shake(); };
  getUser = () => (offline ? oGet() : null); // session is now a server cookie; restored in boot() below

  createAccount = async function () {
    const name = $("signupName").value.trim(), email = $("signupEmail").value.trim(), password = $("signupPassword").value, gender = $("signupGender").value, dob = $("signupDob").value;
    if (!name || !email || !password || !dob) { toast(t("t_fill"), 1); shake(); return; }
    if (!strongPw(password)) { toast(t("t_pw8"), 1); shake(); return; }
    const r = checkDob(); if (!r.ok) { toast(r.age !== undefined ? t("t_under18") : t("t_dobInvalid"), 1); shake(); return; }
    if (!$("dobConfirm").checked) { toast(t("t_confirmDob"), 1); shake(); return; }
    const j = await api("POST", "/api/register", { name, email, password, gender, dob });
    if (j.status === 0) { offline = true; return oCreate(); }
    if (!j.user) return fail(j);
    state.user = j.user; $("signupPassword").value = ""; enterApp(); toast(t("t_created"));
  };
  login = async function () {
    const email = $("loginEmail").value.trim(), password = $("loginPassword").value;
    if (!email || !password) { toast(t("t_enterEP"), 1); shake(); return; }
    const j = await api("POST", "/api/login", { email, password });
    if (j.status === 0) { offline = true; return oLogin(); }
    if (!j.user) { fail(j); if (j.error === "noacct") showSignup(); return; }
    state.user = j.user; $("loginPassword").value = ""; enterApp(); toast(t("t_welcome"));
  };
  const origLogout = logout;
  logout = function () { api("POST", "/api/logout"); origLogout(); };

  /* favourites + reviews + save trip on the details page */
  const origOpen = openDetails;
  openDetails = function (i, keep) {
    origOpen(i, keep);
    const box = $("detailsContent"), k = key(i); if (!box || !state.user || offline) return;
    const p = document.createElement("section"); p.className = "profile-box"; p.id = "socialBox"; p.style.marginTop = "16px";
    p.innerHTML = '<button type="button" class="secondary-btn" id="favBtn">♡ Save</button> <button type="button" class="secondary-btn" id="tripBtn">+ Add to my trips</button><h3 style="margin:14px 0 6px">Traveller reviews <span id="revAvg"></span></h3><div id="revList" class="muted">Loading…</div><div style="margin-top:10px"><label>Your rating <select id="revRate"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label><br><textarea id="revText" maxlength="800" rows="3" style="width:100%;margin:6px 0" placeholder="Share your experience"></textarea><button type="button" class="secondary-btn" id="revBtn">Post review</button></div>';
    box.appendChild(p);
    const setFav = on => $("favBtn").textContent = on ? "♥ Saved" : "♡ Save";
    api("GET", "/api/favorites").then(j => setFav((j.items || []).includes(k)));
    $("favBtn").onclick = async () => { const j = await api("POST", "/api/favorites", { dest: k }); if (j.status === 200) setFav(j.saved); };
    $("tripBtn").onclick = async () => { const j = await api("POST", "/api/trips", { dest: k }); toast(j.id ? "Added to your trips" : t("t_error"), !j.id); };
    const load = async () => {
      const j = await api("GET", "/api/reviews?dest=" + encodeURIComponent(k));
      $("revAvg").textContent = j.count ? "★ " + j.avg + " (" + j.count + ")" : "";
      $("revList").innerHTML = j.count ? j.items.map(r => "<p><b>" + esc(r.name) + "</b> " + "★".repeat(r.rating) + "<br>" + esc(r.body) + "</p>").join("") : "No reviews yet. Be the first.";
    };
    load();
    $("revBtn").onclick = async () => { const j = await api("POST", "/api/reviews", { dest: k, rating: +$("revRate").value, body: $("revText").value }); if (j.ok) { $("revText").value = ""; toast("Review saved"); load(); } else toast(t("t_error"), 1); };
  };

  /* saved places and trips on the profile page */
  const origUpd = updateProfile;
  updateProfile = function () {
    origUpd();
    const pg = $("profilePage"); if (!pg || !state.user || offline) return;
    let b = $("myLists"); if (!b) { b = document.createElement("div"); b.id = "myLists"; b.className = "profile-box"; b.style.margin = "14px 0"; pg.insertBefore(b, pg.querySelector(".secondary-btn")); }
    Promise.all([api("GET", "/api/favorites"), api("GET", "/api/trips")]).then(([f, tr]) => {
      const nm = d => esc(d.split("|")[0]) + ", " + esc(d.split("|")[1]);
      b.innerHTML = "<h3>Saved places</h3>" + ((f.items || []).map(d => "<div>♥ " + nm(d) + "</div>").join("") || '<div class="muted">None yet.</div>') + '<h3 style="margin-top:12px">My trips</h3>' + ((tr.items || []).map(x => "<div>✈ " + esc(x.title) + " <span class=\"muted\">" + esc(x.dest.split("|")[1]) + "</span></div>").join("") || '<div class="muted">None yet.</div>') + (state.user.role === "admin" ? '<p><a href="/admin">Admin panel</a></p>' : "");
    });
  };

  window.addEventListener("DOMContentLoaded", async () => {
    const j = await api("GET", "/api/me");
    if (j.status === 0) { offline = true; const u = oGet(); if (u && dobCheck(u.dob).ok) { state.user = u; enterApp(); } return; }
    if (j.user) { state.user = j.user; enterApp(); }
  });
})();
