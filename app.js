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
  return `<section class="card"><div class="card-head"><h2>${labels[role]}</h2><small>${shown.length} of ${all.length} ranked</small></div>${body ? `<div class="scroll"><table aria-label="${labels[role]} rankings"><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Matches</th><th scope="col">Balls</th><th scope="col">Impact rating</th></tr></thead><tbody>${body}</tbody></table></div>` : '<p class="empty">No player matches your search.</p>'}</section>`;
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
  const k = data.prior_balls;
  return `<div class="hero"><div><p class="eyebrow">How the rating works</p><h1>Method</h1></div></div>
  <div class="stack narrow">
  ${step(1, "Win chance before every ball", "For every delivery we estimate the batting side's chance of winning, purely from the supplied matches (no DLS table). <strong>Chasing</strong>: from runs needed, balls left and wickets in hand. <strong>Batting first</strong>: the projected total is judged against a <em>par score</em> for the conditions: the average first-innings total in the same competition and year, adjusted for the venue, the venue that year, and the tournament. Rain-shortened games use their revised overs and target.")}
  ${step(2, "Impact of every ball", "A ball's impact is how much it moved that win chance. Every ball is a gain for one side and an equal loss for the other: the batter gets the change (wides excepted) and the bowler gets the opposite. A six with 11 needed off the last over moves the match a lot; the same six in a chase already won barely moves it. Impact is pressure built in. Because chase balls naturally swing more, each innings is scaled so an average ball carries the same impact whether you bat first or chase.")}
  ${step(3, "Big matches count more", "Pressure compounds in big games. <strong>IPL</strong>: league ×1, playoff ×2, final ×3. <strong>Playing for the country</strong>: bilateral series ×1.25, multi-team tournament group ×1.5, knockout ×2.5, final ×4. Matches from the last two years also get up to 50% extra weight.")}
  ${step(4, "One rating, fair to small samples", `The rating is impact per 100 balls, as a Bayesian average: every player starts with ${k.batters} (batters) or ${k.bowlers} (bowlers) balls of average performance (counted on the same recency and big-match weighting as their own balls), and their own balls take over as evidence builds. These numbers are estimated from how much results vary by chance versus how much players truly differ. Players need 100 balls across 5 matches to be ranked.`)}
  ${step(5, "Checked independently", "Win chances never improve when a wicket falls or a ball is used up. An independent review recomputed the ratings from the raw ball-by-ball data. Rankings were stress-tested by resampling matches 300 times and by halving or doubling the starting balls.")}
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
