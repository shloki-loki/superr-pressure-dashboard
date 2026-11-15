"use strict";
const el = id => document.getElementById(id);
const fmt = value => typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "—";
const make = (tag, text) => Object.assign(document.createElement(tag), {textContent: text});
const demo = role => [1,2,3].map((id) => ({
  player_id: String(id), player_name: `Sample ${role} ${id}`, country: "Demo",
  normal: 16 - id * 4, pressure: 22 - id * 5, normal_balls: 110 + id * 70, normal_matches: 10 + id
}));
let data = window.SUPERR_DATA || {label:"Synthetic demo. Load your analysis JSON to review real results.", roles:{batters:demo("batter"),bowlers:demo("bowler")}};
function rankings() {
  const weight = Number(el("weight").value);
  return data.roles[el("role").value].filter(p => p.eligible !== false && Number.isFinite(p.normal) && Number.isFinite(p.pressure))
    .map(p => ({...p, score: (weight * p.pressure + (100-weight)*p.normal)/100}))
    .sort((a,b) => b.score-a.score || b.normal-a.normal || String(a.player_id).localeCompare(String(b.player_id), "en",{numeric:true}))
    .map((p,i) => ({...p, rank:i+1}));
}
function compare() {
  const list = rankings();
  const a = list.find(p => String(p.player_id) === el("a").value);
  const b = list.find(p => String(p.player_id) === el("b").value);
  const w = Number(el("weight").value)/100;
  el("compare").textContent = a && b ? `${a.player_name} vs ${b.player_name}. Weighted pressure difference ${fmt(w*(a.pressure-b.pressure))}, weighted overall difference ${fmt((1-w)*(a.normal-b.normal))}. Total score difference ${fmt(a.score-b.score)}.` : "Choose two eligible players.";
  el("evidence").replaceChildren();
  for (const p of new Set([a,b])) {
    if (!p) continue;
    el("evidence").append(make("p", `${p.player_name} · ${p.country || "Country unavailable"} · Rank ${p.rank}. Overall ${fmt(p.normal)}, pressure ${fmt(p.pressure)}, delta ${fmt(p.pressure-p.normal)}. ${p.overall_balls ?? p.normal_balls ?? "—"} legal balls. 70/30 rank after removing one match: ${p.removal_min_rank ?? "—"}–${p.removal_max_rank ?? "—"}.`));
    const examples = data.evidence?.[el("role").value]?.[p.player_id] || [];
    if (!examples.length) continue;
    const details = make("details","");
    details.append(make("summary",`Inspect ${p.player_name}’s highest-pressure deliveries`));
    for (const x of examples) details.append(make("p",`Match ${x.match_id}, innings ${x.innings}, delivery ${x.innings_ball_num}. Before: ${x.score_before}/${x.wickets_before}, ${x.balls_remaining} balls left${x.runs_needed == null ? "" : `, ${x.runs_needed} runs needed`}. Possible swing ${fmt(x.pressure*100)} percentage points. Actual value ${fmt(x.value)} runs. Stage weight ${x.stage_weight}×.`));
    el("evidence").append(details);
  }
}
function render() {
  const list = rankings();
  const q = el("search").value.toLowerCase().trim();
  const selected = q ? list.filter(p=>[p.player_name,p.country].some(s=>String(s||"").toLowerCase().includes(q))) : list.slice(0,10);
  el("rows").replaceChildren(...selected.map(p=>{
    const row = make("tr","");
    for (const x of [p.rank,p.player_name,p.country||"—",fmt(p.score),fmt(p.normal),fmt(p.pressure),fmt(p.pressure-p.normal),p.overall_balls??p.normal_balls??"—",p.overall_matches??p.normal_matches??"—"]) row.append(make("td",x));
    return row;
  }));
  for (const [key,index] of [["a",0],["b",1]]) {
    const prev = el(key).value;
    el(key).replaceChildren(...list.map(p=>Object.assign(make("option",`#${p.rank} · ${p.player_name}`),{value:p.player_id})));
    el(key).selectedIndex = list.some(p=>String(p.player_id)===prev) ? list.findIndex(p=>String(p.player_id)===prev) : Math.min(index,list.length-1);
  }
  el("status").textContent = data.label;
  el("coverage").textContent = data.coverage || "Sample data shown for layout only. Files you select are read in this browser.";
  el("notes").textContent = data.notes || "No analysis file loaded.";
  compare();
}
for (const id of ["role","weight"]) el(id).addEventListener("change",render);
el("search").addEventListener("input",render);
for (const id of ["a","b"]) el(id).addEventListener("change",compare);
el("file").addEventListener("change",async event=>{
  try {
    const next = JSON.parse(await event.target.files[0].text());
    for (const role of ["batters","bowlers"]) {
      if (!Array.isArray(next.roles?.[role]) || !next.roles[role].every(x=> typeof x.player_name==="string" && x.player_id!=null)) throw Error("Select a SupeRR analysis JSON file.");
    }
    data = next;
    render();
  } catch(error) { el("status").textContent = error.message; }
});
render();
