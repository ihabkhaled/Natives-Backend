import { ROUTING_MAP } from '../data/routing-map.mjs';
import { tokenize } from './extract-doc-metadata.mjs';

// Given a task string, find the routing-map entries whose keywords it triggers.
// Multi-word keywords ("new module") are substring-matched against the lowercased
// task; single-word keywords ("guard") are token-matched so they cannot fire on a
// spurious substring (e.g. "guard" inside "safeguarding"). Returns entries ordered
// by hit count, ties broken by id for determinism.
export function resolvePacks(task, routingMap = ROUTING_MAP) {
  if (!task) {
    return [];
  }
  const lower = task.toLowerCase();
  const tokens = new Set(tokenize(task));
  const matches = [];
  for (const entry of routingMap) {
    let hits = 0;
    for (const keyword of entry.keywords) {
      const isPhrase = keyword.includes(' ');
      if (isPhrase ? lower.includes(keyword) : tokens.has(keyword)) {
        hits += 1;
      }
    }
    if (hits > 0) {
      matches.push({ entry, hits });
    }
  }
  matches.sort(
    (a, b) => b.hits - a.hits || a.entry.id.localeCompare(b.entry.id),
  );
  return matches.map(match => match.entry);
}

const LANE_RANK = { fast: 0, standard: 1, critical: 2 };

function highestLane(entries) {
  let lane = 'fast';
  for (const entry of entries) {
    if (LANE_RANK[entry.lane] > LANE_RANK[lane]) {
      lane = entry.lane;
    }
  }
  return lane;
}

function unionSorted(entries, key) {
  const set = new Set();
  for (const entry of entries) {
    for (const value of entry[key]) {
      set.add(value);
    }
  }
  return [...set].sort();
}

const DEFAULT_MAX_ENTRIES = 3;

// Merge the top matched entries into one guaranteed bundle: the strictest lane,
// and the union (deduped, sorted) of their rules, skills, reviewers, and
// validation commands. Returns null when nothing matched — the resolver then
// falls back to keyword-ranked results only.
export function mergePack(
  task,
  { routingMap = ROUTING_MAP, maxEntries = DEFAULT_MAX_ENTRIES } = {},
) {
  const matched = resolvePacks(task, routingMap).slice(0, maxEntries);
  if (matched.length === 0) {
    return null;
  }
  return {
    matchedTaskTypes: matched.map(entry => entry.id),
    lane: highestLane(matched),
    rules: unionSorted(matched, 'rules'),
    skills: unionSorted(matched, 'skills'),
    reviewers: unionSorted(matched, 'reviewers'),
    validation: unionSorted(matched, 'validation'),
  };
}
