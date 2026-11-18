const state = { rows: "10", query: "" };
let data;
const main = document.querySelector("#dashboard");
const labels = { batters: "Batters", bowlers: "Bowlers" };
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const count = value => Number(value).toLocaleString("en-US");

function table(role) {
  const all = data.roles[role];
  const q = state.query.trim().toLowerCase();
  const filtered = all.filter(p => !q || p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q));
  const shown = state.rows === "all" ? filtered : filtered.slice(0, Number(state.rows));
  const body = shown.map(p => `<tr><td>${p.rank}</td><td><strong>${escape(p.name)}</strong><small>${escape(p.country)}</small></td><td>${p.matches}</td><td>${count(p.balls)}</td><td class="score">${p.rating.toFixed(2)}</td></tr>`).join("");
  return `<section class="card"><div class="card-head"><h2>${labels[role]}</h2><small>${shown.length} of ${all.length} ranked</small></div>${body ? `<div class="scroll"><table aria-label="${labels[role]} rankings"><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Matches</th><th scope="col">Balls</th><th scope="col">Pressure rating</th></tr></thead><tbody>${body}</tbody></table></div>` : '<p class="empty">No player matches your search.</p>'}</section>`;
}

function rankings() {
  return `<div class="hero"><div><p class="eyebrow">IPL &amp; T20I · 2022–2026</p><h1>Most reliable under pressure</h1></div><p class="coverage muted"><strong>${count(data.matches)}</strong> matches · <strong>${count(data.deliveries)}</strong> deliveries</p></div>
  <div class="bar"><div class="controls">
    <label>Rows to show<select id="rows">${["10", "25", "50", "100", "all"].map(v => `<option value="${v}"${state.rows === v ? " selected" : ""}>${v === "all" ? "All players" : `Top ${v}`}</option>`).join("")}</select></label>
    <label>Find a player<input id="search" type="search" placeholder="Player or country" value="${escape(state.query)}"></label>
  </div></div>
  <div class="grid" id="tables">${table("batters")}${table("bowlers")}</div>`;
}

function method() {
  const step = (n, title, text) => `<section class="card card-body step"><span class="number">${n}</span><div><h3>${title}</h3><p>${text}</p></div></section>`;
  return `<div class="hero"><div><p class="eyebrow">How the rating works</p><h1>Method</h1></div></div>
  <div class="stack narrow">
  ${step(1, "Measure the pressure on every ball", "Before each delivery we estimate the win probability after every possible outcome (dot, single, boundary, wicket, wide…). Pressure is how much the match result can swing on that ball. A tight chase in the 19th over scores high; a dead rubber scores low. Win probabilities come from the supplied matches only. We do not use the DLS table, and rain-revised matches are excluded.")}
  ${step(2, "Grade what the player actually did", "Each ball is compared with what a typical player achieves in the same situation: same innings, phase, balls and wickets left, required rate, batting position, bowling type and venue. Runs above expectation and wickets are credited. A good innings in a losing cause still earns full credit.")}
  ${step(3, "Count the big matches more", `Pressure compounds in big games. Each match carries a multiplier: <strong>IPL</strong> league ×1, playoff ×2, final ×3. <strong>Playing for the country</strong>: bilateral series ×1.25, multi-team tournament group ×1.5, tournament knockout ×2.5, tournament final ×4.`)}
  ${step(4, "Combine into one rating", "The pressure rating is 70% performance weighted by pressure and 30% normal performance, in runs above expectation per 100 balls. Recent matches get up to 50% extra weight. Players need 100 balls across 5 matches. Smaller samples are scaled towards average so a few lucky games cannot top the list.")}
  ${step(5, "Check it holds up", "Losing a wicket or a ball never improves the batting side's forecast (zero violations across all 182,713 deliveries). Wides never earn bowlers credit. The top 10s were re-checked by resampling matches 300 times and by changing the 70/30 blend to 60/40 and 80/20.")}
  </div>`;
}

function render() {
  const page = location.hash === "#method" ? "method" : "rankings";
  document.querySelectorAll(".nav a").forEach(a => a.toggleAttribute("aria-current", a.getAttribute("href") === `#${page}`));
  main.innerHTML = page === "method" ? method() : rankings();
  if (page === "rankings") {
    document.querySelector("#rows").addEventListener("change", e => { state.rows = e.target.value; render(); });
    const search = document.querySelector("#search");
    search.addEventListener("input", e => {
      state.query = e.target.value;
      document.querySelector("#tables").innerHTML = table("batters") + table("bowlers");
    });
  }
}

addEventListener("hashchange", render);
fetch("data.json").then(r => r.json()).then(json => { data = json; render(); })
  .catch(() => { main.innerHTML = '<p class="empty">Could not load the rankings.</p>'; });
