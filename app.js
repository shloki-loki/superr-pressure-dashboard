"use strict";

const dashboard = document.querySelector("#dashboard");
const dialog = document.querySelector("#player");
const detail = document.querySelector("#player-detail");
const labels = { batters: "Batters", bowlers: "Bowlers" };
const state = { role: "both", query: "", all: false, weight: 70, compareRole: "batters", compare: [], trace: 0 };
let data;
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const decimal = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : "—";
const count = value => Number.isFinite(value) ? value.toLocaleString("en-US") : "—";
const pct = value => value == null ? "—" : decimal(value * 100, 4);
const signed = value => (value > 0 ? "+" : "") + decimal(value);
const rank = player => player["rank_" + state.weight];
const score = player => player["score_" + state.weight];
const ranked = role => data.roles[role].filter(player => player.eligible).sort((a, b) => rank(a) - rank(b));
const selected = (actual, expected) => actual === expected ? " selected" : "";

function hero(title, copy, extra = "") {
  return `<section class="hero"><div><p class="eyebrow">IPL &amp; T20I · Retrospective analysis</p><h1>${title}</h1><p class="muted">${copy}</p></div>${extra}</section>`;
}

function slider() {
  return `<div class="weight"><label for="weight">Rank blend <output id="blend">Pressure ${state.weight}% · Overall ${100 - state.weight}%</output></label><input aria-label="Pressure weight" aria-describedby="blend" id="weight" type="range" min="60" max="80" step="10" value="${state.weight}"></div>`;
}

function playerButton(role, player) {
  return `<button class="player-link" data-player="${escape(player.player_id)}" data-role="${role}">${escape(player.player_name)}</button>`;
}

function rankTable(role) {
  const query = state.query.trim().toLowerCase();
  const players = ranked(role).filter(player => !query || [player.player_name, player.country].some(value => value?.toLowerCase().includes(query)));
  const shown = state.all || query ? players : players.slice(0, 10);
  const rows = shown.map(player => `<tr><td>${rank(player)}</td><td>${playerButton(role, player)}<small>${escape(player.country || "Unknown")}</small></td><td>${decimal(player.normal, 1)}</td><td>${decimal(player.pressure, 1)}</td><td class="${player.delta >= 0 ? "positive" : "negative"}">${signed(player.delta)}</td><td class="score">${decimal(score(player))}</td></tr>`).join("");
  return `<section class="card"><div class="card-head"><h2>${labels[role]}</h2><small>${shown.length} of ${ranked(role).length} eligible</small></div>${rows ? `<div class="scroll"><table aria-label="${labels[role]} rankings"><thead><tr><th scope="col">Rank</th><th scope="col">Player / country</th><th scope="col">Overall</th><th scope="col">Pressure</th><th scope="col">Lift</th><th scope="col">Blend</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="empty">No eligible players match your search.</p>'}</section>`;
}

function rankingTables() {
  document.querySelector("#tables").innerHTML = Object.keys(labels).filter(role => state.role === "both" || state.role === role).map(rankTable).join("");
}

function rankings() {
  return hero("Performance under pressure", "Recent matches count more toward player form. Match weight halves every year.", '<p class="coverage muted"><strong>764</strong> matches · <strong>182,713</strong> deliveries<br>Run value per 100 weighted legal balls</p>') + `
  <div class="bar">
    <div class="controls">
      <label>Role<select id="role"><option value="both"${selected(state.role,"both")}>Both roles</option>${Object.entries(labels).map(([role,label]) => `<option value="${role}"${selected(state.role,role)}>${label}</option>`).join("")}</select></label>
      <label>Find a player<input id="search" type="search" placeholder="Player or country" value="${escape(state.query)}"></label>
      <label>Show<select id="limit"><option value="top"${selected(state.all,false)}>Top 10</option><option value="all"${selected(state.all,true)}>All eligible</option></select></label>
    </div>${slider()}
  </div>
  <div id="tables" class="grid"></div>
  <p class="footnote">Country / team uses international representation or official nationality where sourced. Overall and pressure use all deliveries with different weights. Lift equals pressure minus overall.</p>`;
}

function metric(label, value) {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function profile(player) {
  return `<div class="metrics">${[
    ["Blend", decimal(score(player))], ["Overall", decimal(player.normal)], ["Pressure", decimal(player.pressure)], ["Reweighting lift", signed(player.delta)]
  ].map(pair => metric(...pair)).join("")}</div>
  <p><strong>${count(player.normal_balls)}</strong> legal balls across <strong>${count(player.normal_matches)}</strong> matches. After weighting for recency and match stage, that counts as ${decimal(player.normal_weighted_balls, 1)} balls overall and ${decimal(player.pressure_weighted_balls, 1)} for pressure.</p>
  <p><strong>Match-removal rank range at 70/30</strong><br>${count(player.removal_min_rank)}–${count(player.removal_max_rank)} · largest blend change ${decimal(player.removal_max_abs_score_change)}${player.removal_ineligible ? ` · Ineligible in ${count(player.removal_ineligible)} removals` : ""}</p>
  <p class="footnote">Fixed-model sensitivity. Each match is removed from player aggregates in turn, with the fitted models held fixed.</p>`;
}

function openPlayer(role, id) {
  const player = data.roles[role].find(row => String(row.player_id) === id);
  if (!player) return;
  const examples = data.evidence?.[role]?.[id] ?? [];
  detail.innerHTML = `<div class="detail-head"><div><p class="eyebrow">${labels[role]} · Rank ${rank(player)}</p><h2 id="player-title">${escape(player.player_name)}</h2><p class="muted">Country / team · ${escape(player.country || "Unknown")}${player.country_source?.startsWith("https://") ? ` · <a href="${escape(player.country_source)}">Official IPL source</a>` : ""}</p></div><form method="dialog"><button aria-label="Close player details">Close</button></form></div>
  ${profile(player)}
  <h3>Delivery examples</h3>
  ${examples.length ? `<p class="footnote">Selected high-pressure deliveries. Value is execution relative to expectation, in runs.</p><div class="scroll"><table><thead><tr><th>Match</th><th>Delivery</th><th>Pre-ball score</th><th>Balls left</th><th>Pressure (pp)</th><th>Value</th></tr></thead><tbody>${examples.map(ball => `<tr><td>${escape(ball.match_id)}</td><td>Inn. ${escape(ball.innings)} · Event ${escape(ball.innings_ball_num)}</td><td>${ball.score_before}/${ball.wickets_before}</td><td>${ball.balls_remaining}</td><td>${pct(ball.pressure)}</td><td>${signed(ball.value)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">No delivery examples are available for this player.</p>'}`;
  dialog.setAttribute("aria-labelledby", "player-title");
  dialog.showModal();
}

function compareCards() {
  const players = ranked(state.compareRole);
  const pair = state.compare.map(id => players.find(player => String(player.player_id) === id));
  document.querySelector("#pair").innerHTML = pair.map(player => `<section class="card card-body"><p class="eyebrow">Rank ${rank(player)}</p><h2>${playerButton(state.compareRole, player)}</h2><p class="muted">${escape(player.country || "Country / team unknown")}</p>${profile(player)}</section>`).join("");
  const [a,b] = pair;
  const gap = score(a) - score(b);
  const summary = gap === 0 ? "The players have the same blend score." : `${escape((gap > 0 ? a : b).player_name)} leads by <strong>${decimal(Math.abs(gap))}</strong> run value per 100 weighted legal balls at this blend.`;
  document.querySelector("#gap").innerHTML = summary;
}

function compare() {
  const players = ranked(state.compareRole);
  if (!state.compare.length) state.compare = players.slice(0, 2).map(player => String(player.player_id));
  const options = (id) => [...players].sort((a,b) => a.player_name.localeCompare(b.player_name)).map(player => `<option value="${escape(player.player_id)}"${selected(id,String(player.player_id))}>${escape(player.player_name)}</option>`).join("");
  return hero("Compare players", "See how overall form and pressure-weighted form contribute to the ranking.") + `<div class="bar"><div class="controls"><label>Role<select id="compare-role">${Object.entries(labels).map(([role,label]) => `<option value="${role}"${selected(state.compareRole,role)}>${label}</option>`).join("")}</select></label>
  ${state.compare.map((id,index) => `<label>Player ${index + 1}<select data-side="${index}">${options(id)}</select></label>`).join("")}</div>${slider()}</div>
  <p id="gap" class="formula"></p><div class="grid" id="pair"></div>`;
}

function branchName(branch) {
  const runs = branch.team_runs === 1 ? "1 run" : `${branch.team_runs} runs`;
  return [runs, branch.legal ? "legal" : "illegal", branch.wicket ? "wicket" : ""].filter(Boolean).join(" · ");
}

function ballLab() {
  const traces = data.traces ?? [];
  const intro = hero("Ball lab", "Work through real pre-delivery estimates and the outcomes that contribute to pressure.");
  if (!traces.length) return intro + '<p class="empty">Delivery calculations are unavailable in this data release.</p>';
  const trace = traces[state.trace];
  const ball = trace.state ?? {};
  const match = trace.match ?? {};
  return intro + `<div class="bar"><div class="controls"><label>Delivery<select id="trace">${traces.map((item, i) => `<option value="${i}"${selected(state.trace,i)}>Match ${escape(item.match_id)} · Innings ${item.innings} · Event ${item.innings_ball_num}</option>`).join("")}</select></label></div></div>
    <section class="card ball-card">
    <div class="card-body"><p class="eyebrow">${[ball.comp_name, match.match_date].filter(Boolean).map(escape).join(" · ")}</p><h2>${ball.bowler_name && ball.striker_name ? `${escape(ball.bowler_name)} to ${escape(ball.striker_name)}` : `Match ${escape(trace.match_id)}`}</h2>
    <p>${trace.innings === 1 ? "Setting a target" : "Chasing"} · ${ball.score_before ?? "—"}/${ball.wickets_before ?? "—"} before the ball · ${ball.balls_remaining ?? "—"} legal balls left${ball.runs_needed == null ? "" : ` · ${ball.runs_needed} runs needed`}</p>
    <div class="metrics">${metric("Central win credit (%)",pct(trace.win_estimate))}${metric("Pressure (pp)",pct(trace.pressure))}${metric("Exact-state observations",count(trace.exact_state_events))}</div>
    <p><strong>Observed outcome</strong> · ${ball.total_runs ?? "—"} team runs, ${ball.is_legal ? "legal delivery" : "illegal delivery"}, ${String(ball.is_wicket).toLowerCase() === "true" ? "wicket" : "no wicket"}. Execution value was ${signed(ball.bat_value)} for the batter and ${signed(ball.bowl_value)} for the bowler.</p>
    <p>Each row multiplies outcome probability by the absolute gap between the next win credit and the central estimate. Adding the contributions gives delivery pressure.</p></div>
    <div class="scroll"><table><thead><tr><th>Outcome</th><th>Probability (%)</th><th>Next win credit (%)</th><th>Gap (pp)</th><th>Contribution (pp)</th></tr></thead><tbody>
    ${trace.outcomes.map(branch => `<tr><td>${branchName(branch)}</td><td>${pct(branch.probability)}</td><td>${pct(branch.next_win_credit)}</td><td>${pct(Math.abs(branch.next_win_credit - trace.win_estimate))}</td><td class="score">${pct(branch.pressure_contribution)}</td></tr>`).join("")}
    <tr><th scope="row">Total</th><td>${pct(trace.outcomes.reduce((sum,branch) => sum + branch.probability,0))}</td><td></td><td></td><td class="score">${pct(trace.outcomes.reduce((sum,branch) => sum + branch.pressure_contribution,0))}</td></tr>
    </tbody></table></div>
    <div class="card-body"><p class="footnote">Win credit scores a win as 100%, a tie as 50%, and a loss as 0%. Table values are rounded for display.</p><p class="footnote">Pooling samples · ${count(trace.nearby_state_events)} nearby-state events and ${count(trace.phase_events)} phase events.</p></div></section>`;
}

function method() {
  const audit = data.audit ?? {};
  const exclusions = audit.exclusion_counts_overlap;
  const reasons = exclusions && !Array.isArray(exclusions) && typeof exclusions === "object" ? Object.entries(exclusions) : [];
  const steps = [
    ["Prepare the match history", "Use reconciled, regulation IPL and T20I deliveries. Fit five groups of models so every match is assessed using other matches. The retrospective fit can use later matches when assessing earlier ones."],
    ["Estimate the possible outcomes", "Before each ball, estimate the chances of possible runs, legality and wicket outcomes from historical states. Pool nearby and broader samples when exact examples are sparse."],
    ["Calculate pressure before the delivery", "For a chase, estimate win credit from the runs needed, legal balls and wickets left after each possible outcome. For a setting innings, project the range of finishes and their chances of being defended. Pressure is the probability-weighted absolute distance from central win credit."],
    ["Grade execution and build the rankings", "The observed result grades execution against the expected result. Both ratings use every delivery. Overall weights are 1.00 for regular matches, 1.25 for other knockouts and 1.50 for finals. Both ratings multiply the stage weight by 0.5 raised to the age of the match in years, measured from the latest eligible match (1 November 2026). Pressure form then multiplies that weight by (1 + ball pressure ÷ mean pressure for the innings) ÷ 2."],
    ["Scale and blend the ratings", "Divide weighted run value by weighted legal balls plus 50, then multiply by 100. Rank players with at least 100 legal balls across five matches. The default blend is 70% pressure and 30% overall. Lift describes the change from reweighting deliveries."]
  ];
  return hero("Method & coverage", "How historical deliveries become player scores, and what the source audit included.") +
    `<div class="grid"><section class="card card-body stack"><h2>From delivery to rank</h2>${steps.map(([title,body],i) => `<article><h3><span class="number">${i + 1}.</span> ${title}</h3><p>${body}</p></article>`).join("")}</section>
    <div class="stack"><section class="card card-body"><h2>Coverage audit</h2><div class="metrics">${metric("Source matches",count(audit.source_matches))}${metric("Reconciled matches",count(audit.included_matches))}${metric("Excluded matches",count(audit.excluded_matches))}${metric("Source deliveries",count(audit.source_deliveries))}${metric("Reconciled deliveries",count(audit.included_deliveries))}${metric("Excluded deliveries",count(audit.excluded_deliveries))}</div>
    <p>The reconciled pool excludes revised games, super overs and other failed checks. The IPL and T20I ranking sample contains <strong>${count(audit.eligible_matches ?? 764)}</strong> matches and <strong>${count(audit.eligible_deliveries ?? 182713)}</strong> deliveries after removing ${count(audit.out_of_scope_matches)} emerging-team matches.</p>
    ${reasons.length ? `<h3>Recorded exclusion reasons</h3><p class="footnote">Reasons can overlap. Counts may sum to more than the excluded total.</p><ul>${reasons.map(([label,value]) => `<li>${escape(label.replaceAll("_"," "))} · ${escape(typeof value === "object" ? JSON.stringify(value) : value)}</li>`).join("")}</ul>` : ""}</section>
    <section class="card card-body"><h2>Model checks</h2><p>Held-out Brier loss was 0.223 for setting and 0.124 for chasing. A flat 50% baseline scores 0.250. Lower loss is better.</p><p>The separate past-only check trains on 615 matches and predicts 149 later matches from 5 November 2025.</p><p>Match-removal sensitivity holds the models fixed and recalculates player aggregates and ranks after each match is removed. The resulting range measures the effect of removing individual matches.</p></section><section class="card card-body"><h2>Review limitations</h2><p>Opposition strength is only partially accounted for. Bucketed state estimates and finish projections can shift between nearby situations. Monotonicity across states remains unverified.</p><p>The 70/30 blend, 50-ball denominator adjustment, one-year recency half-life and stage weights are modelling assumptions. Lift measures how the score changes when deliveries are reweighted. It does not estimate a causal clutch effect.</p><p><a href="review-summary.md">Read the full review summary</a></p></section></div></div>`;
}

function render() {
  const views = { rankings, compare, "ball-lab": ballLab, method };
  const hash = location.hash.slice(1);
  const page = Object.hasOwn(views, hash) ? hash : "rankings";
  document.querySelectorAll(".nav a").forEach(link => {
    if (link.hash === "#" + page) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  dashboard.innerHTML = views[page]();
  if (page === "rankings") rankingTables();
  if (page === "compare") compareCards();
}

dashboard.addEventListener("click", event => {
  const button = event.target.closest("[data-player]");
  if (button) openPlayer(button.dataset.role, button.dataset.player);
});
dashboard.addEventListener("input", event => {
  if (event.target.id === "search") {
    state.query = event.target.value;
    rankingTables();
  }
  if (event.target.id === "weight") {
    state.weight = Number(event.target.value);
    document.querySelector("#blend").textContent = `Pressure ${state.weight}% · Overall ${100 - state.weight}%`;
    if (document.querySelector("#tables")) rankingTables();
    else compareCards();
  }
});
dashboard.addEventListener("change", event => {
  const { id, value, dataset } = event.target;
  if (id === "role") state.role = value;
  if (id === "limit") state.all = value === "all";
  if (id === "role" || id === "limit") rankingTables();
  if (id === "compare-role") {
    state.compareRole = value;
    state.compare = [];
    render();
    document.querySelector("#compare-role").focus();
  }
  if (dataset.side != null) {
    state.compare[Number(dataset.side)] = value;
    compareCards();
  }
  if (id === "trace") {
    state.trace = Number(value);
    render();
    document.querySelector("#trace").focus();
  }
});
window.addEventListener("hashchange", () => { if (data) render(); });

fetch("./data.json")
  .then(response => {
    if (!response.ok) throw new Error("Data request failed");
    return response.json();
  })
  .then(payload => {
    data = payload;
    render();
  })
  .catch(error => {
    console.error(error);
    dashboard.innerHTML = '<h1>Analysis unavailable</h1><p>The match analysis could not be loaded. Reload this page to try again.</p><button id="reload">Reload analysis</button>';
    document.querySelector("#reload").addEventListener("click", () => location.reload());
  });
