#!/usr/bin/env node
// Update the simulator's group-stage data (PLAYED + FIXTURES) from live results.
//
//   node update-scores.mjs
//
// Source: Wikipedia's MediaWiki API (no key required). For each of the 12 group
// pages it reads the match templates, sorts finished matches into PLAYED and the
// rest into FIXTURES, and rewrites those two blocks in index.html in place.
// Requires Node 18+ (global fetch).

import { readFile, writeFile } from "node:fs/promises";

const HTML = new URL("index.html", import.meta.url);          // resolves next to this script

// FIFA 3-letter code → our canonical team name (must match the GROUPS object in index.html)
const CODE = {
  MEX:"Mexico", RSA:"South Africa", KOR:"South Korea", CZE:"Czechia",
  CAN:"Canada", SUI:"Switzerland", BIH:"Bosnia", QAT:"Qatar",
  BRA:"Brazil", MAR:"Morocco", SCO:"Scotland", HAI:"Haiti",
  USA:"USA", AUS:"Australia", PAR:"Paraguay", TUR:"Türkiye",
  GER:"Germany", CIV:"Ivory Coast", ECU:"Ecuador", CUW:"Curaçao",
  NED:"Netherlands", JPN:"Japan", SWE:"Sweden", TUN:"Tunisia",
  BEL:"Belgium", EGY:"Egypt", IRN:"Iran", NZL:"New Zealand",
  ESP:"Spain", URU:"Uruguay", CPV:"Cape Verde", KSA:"Saudi Arabia",
  FRA:"France", NOR:"Norway", SEN:"Senegal", IRQ:"Iraq",
  ARG:"Argentina", AUT:"Austria", JOR:"Jordan", ALG:"Algeria",
  COL:"Colombia", COD:"DR Congo", POR:"Portugal", UZB:"Uzbekistan",
  ENG:"England", CRO:"Croatia", GHA:"Ghana", PAN:"Panama"
};
const GROUPS = "ABCDEFGHIJKL".split("");

// Match the footballbox triple:  |team1={{#invoke:flag|fb-rt|XXX}} \n |score=... \n |team2={{#invoke:flag|fb|YYY}}
const RX = /\|\s*team1\s*=\s*\{\{#invoke:flag\|fb-rt\|([A-Z]{3})\}\}\s*\n\|\s*score\s*=([^\n]*)\n\|\s*team2\s*=\s*\{\{#invoke:flag\|fb\|([A-Z]{3})\}\}/g;

// Fetch the wikitext of all 12 group pages in ONE API call → { A: wikitext, ... }
async function fetchAllGroups(){
  const titles = GROUPS.map(g => `2026 FIFA World Cup Group ${g}`).join("|");
  const url = "https://en.wikipedia.org/w/api.php?action=query&prop=revisions" +
    "&rvprop=content&rvslots=main&format=json&formatversion=2&titles=" + encodeURIComponent(titles);
  const r = await fetch(url, { headers: { "User-Agent": "wc2026-sim/1.0 (github.com/thatjpcsguy/wc-2026)" } });
  if (!r.ok) throw new Error(`Wikipedia API HTTP ${r.status}`);
  const pages = (await r.json())?.query?.pages || [];
  const out = {};
  for (const p of pages){
    const g = (p.title || "").trim().slice(-1);              // "…Group A" → "A"
    const content = p.revisions?.[0]?.slots?.main?.content;
    if (GROUPS.includes(g) && content) out[g] = content;
  }
  const missing = GROUPS.filter(g => !out[g]);
  if (missing.length) throw new Error("missing group pages: " + missing.join(","));
  return out;
}

function parseGroup(wt){
  const played = [], fixtures = [];
  let m;
  while ((m = RX.exec(wt)) !== null){
    const home = CODE[m[1]], away = CODE[m[3]];
    if (!home || !away){ console.warn("⚠ unknown code:", m[1], m[3]); continue; }
    const scores = [...m[2].matchAll(/(\d+)\s*[–-]\s*(\d+)/g)];      // last digit–digit on the line is the result
    if (scores.length){
      const s = scores[scores.length - 1];
      played.push([home, Number(s[1]), Number(s[2]), away]);
    } else {
      fixtures.push([home, away]);
    }
  }
  return { played, fixtures };
}

async function main(){
  const played = {}, fixtures = {};
  const wt = await fetchAllGroups();
  for (const g of GROUPS){
    const { played: p, fixtures: f } = parseGroup(wt[g]);
    played[g] = p; fixtures[g] = f;
  }

  const line = (g, arr) => ` ${g}:[${arr.map(x => JSON.stringify(x)).join(",")}]`;
  const playedBlock =
    "const PLAYED = {\n" + GROUPS.map(g => line(g, played[g])).join(",\n") + "\n};";
  const today = new Date().toISOString().slice(0, 10);
  const fixturesBlock =
    `// Remaining (unplayed) group fixtures — auto-updated ${today} from Wikipedia.\n` +
    "const FIXTURES = {\n" + GROUPS.map(g => line(g, fixtures[g])).join(",\n") + "\n};";

  const np = Object.values(played).reduce((s, a) => s + a.length, 0);
  const nf = Object.values(fixtures).reduce((s, a) => s + a.length, 0);
  if (np + nf !== 72){                    // safety: never overwrite with an incomplete parse
    const short = GROUPS.filter(g => played[g].length + fixtures[g].length !== 6);
    console.error(`✖ Parsed ${np + nf}/72 matches (groups short: ${short.join(",") || "none"}). ` +
      `Source page may be mid-edit — NOT writing. Re-run shortly.`);
    process.exit(1);
  }

  let html = await readFile(HTML, "utf8");
  const before = html;
  html = html.replace(/const PLAYED = \{[\s\S]*?\n\};/, playedBlock);
  html = html.replace(/(?:\/\/[^\n]*\n)*const FIXTURES = \{[\s\S]*?\n\};/, fixturesBlock);
  if (html === before){ console.error("✖ Could not locate PLAYED/FIXTURES blocks in index.html"); process.exit(1); }
  await writeFile(HTML, html);
  console.log(`✓ Updated index.html — ${np} played, ${nf} remaining group matches.`);
  console.log("Next: review the diff, then commit & push to redeploy.");
}

main().catch(e => { console.error("✖ Update failed:", e.message); process.exit(1); });
