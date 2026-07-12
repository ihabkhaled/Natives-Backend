import { tokenize } from './extract-doc-metadata.mjs';

// The fixed 5-file constant warm-up — copied verbatim from
// memory/ai-context-map.md's own "orientation sequence" table (steps 1-5).
// This is the executable form of a decision that document already makes;
// resolve-context.mjs does not invent its own warm-up set.
export const WARMUP_PATHS = [
  'claude.md',
  'rules/00-non-negotiable-rules.md',
  'context/architecture-map.md',
  'context/stack-and-toolchain.md',
  'memory/known-pitfalls.md',
];

const KNOWN_MODULES = [
  'articles',
  'auth',
  'users',
  'core',
  'config',
  'bootstrap',
  'shared',
];

// Mirrors the "Route by goal → reviewer agent" table already in
// memory/ai-context-map.md — a static verb→path-substring boost table, not
// a generic search heuristic invented from scratch.
const GOAL_VERB_BOOSTS = [
  { verbs: ['review', 'audit'], pathIncludes: ['rules/15', 'agents/'] },
  {
    verbs: ['test', 'coverage', 'spec'],
    pathIncludes: ['testing/', 'rules/11'],
  },
  {
    verbs: ['security', 'auth', 'permission', 'guard'],
    pathIncludes: ['rules/07', 'rules/08', 'security'],
  },
  {
    verbs: ['performance', 'slow', 'latency'],
    pathIncludes: ['rules/09', 'performance'],
  },
  {
    verbs: ['simplify', 'readable', 'boring', 'clever', 'refactor'],
    pathIncludes: [
      'rules/20',
      'rules/21',
      'rules/22',
      'rules/23',
      'rules/24',
      'simple',
    ],
  },
  {
    verbs: ['database', 'query', 'migration', 'repository'],
    pathIncludes: ['rules/04', 'rules/08', 'database'],
  },
  {
    verbs: ['reliability', 'retry', 'timeout'],
    pathIncludes: ['rules/10', 'reliability'],
  },
  {
    verbs: ['observability', 'logging', 'metrics'],
    pathIncludes: ['rules/14', 'observability'],
  },
];

const GOAL_VERB_BOOST_SCORE = 6;
const TITLE_MATCH_SCORE = 5;
const FILENAME_MATCH_SCORE = 4;
const KEYWORD_MATCH_SCORE = 3;
const MODULE_OVERLAP_SCORE = 6;
const RULE_NUMBER_MATCH_SCORE = 8;
const LAYER_MATCH_SCORE = 4;
const DEPENDENCY_OVERLAP_SCORE = 5;

function pathTokens(relativePath) {
  return tokenize(relativePath.replace(/[/-]/g, ' ').replace(/\.\w+$/, ''));
}

function extractQueryModules(queryTokens) {
  return KNOWN_MODULES.filter(module => queryTokens.includes(module));
}

function extractQueryRuleNumbers(task) {
  if (!task) {
    return [];
  }
  return [...task.matchAll(/\b\d{1,2}\b/g)].map(match => Number(match[0]));
}

function scoreDocument(doc, { queryTokens, queryModules, ruleNumbers }) {
  let score = 0;
  const reasons = [];
  const titleTokens = tokenize(doc.title ?? '');
  const filenameTokens = pathTokens(doc.path);

  for (const token of queryTokens) {
    if (titleTokens.includes(token)) {
      score += TITLE_MATCH_SCORE;
      reasons.push(`title mentions "${token}"`);
    }
    if (filenameTokens.includes(token)) {
      score += FILENAME_MATCH_SCORE;
      reasons.push(`filename mentions "${token}"`);
    }
    if (doc.keywords.includes(token)) {
      score += KEYWORD_MATCH_SCORE;
      reasons.push(`keyword "${token}"`);
    }
  }
  for (const module of queryModules) {
    if (doc.path.includes(module)) {
      score += MODULE_OVERLAP_SCORE;
      reasons.push(`covers the "${module}" module`);
    }
  }
  if (doc.ruleNumber !== null && ruleNumbers.includes(doc.ruleNumber)) {
    score += RULE_NUMBER_MATCH_SCORE;
    reasons.push(`is rule ${doc.ruleNumber}`);
  }
  for (const entry of GOAL_VERB_BOOSTS) {
    const verbHit = entry.verbs.some(verb => queryTokens.includes(verb));
    const pathHit = entry.pathIncludes.some(fragment =>
      doc.path.includes(fragment),
    );
    if (verbHit && pathHit) {
      score += GOAL_VERB_BOOST_SCORE;
      reasons.push("matches the task's goal area");
    }
  }
  return { score, reasons };
}

function scoreSourceFile(file, { queryTokens, queryModules, layerTokens }) {
  let score = 0;
  const reasons = [];
  const filenameTokens = pathTokens(file.path);

  for (const token of queryTokens) {
    if (filenameTokens.includes(token)) {
      score += FILENAME_MATCH_SCORE;
      reasons.push(`filename mentions "${token}"`);
    }
  }
  for (const module of queryModules) {
    if (file.module === module) {
      score += MODULE_OVERLAP_SCORE;
      reasons.push(`is in the "${module}" module`);
    }
  }
  if (layerTokens.includes(file.layer)) {
    score += LAYER_MATCH_SCORE;
    reasons.push(`is a ${file.layer}`);
  }
  return { score, reasons };
}

// Depth-1 neighbors (both directions) of the given seed files, per
// dependency-graph.json — the direct scoring input that earns that
// manifest its keep, not decoration.
function findDependencyNeighbors(seedPaths, edges) {
  const seedSet = new Set(seedPaths);
  const neighbors = new Map();
  for (const edge of edges) {
    if (seedSet.has(edge.from) && !seedSet.has(edge.to)) {
      neighbors.set(edge.to, edge.from);
    }
    if (seedSet.has(edge.to) && !seedSet.has(edge.from)) {
      neighbors.set(edge.from, edge.to);
    }
  }
  return neighbors;
}

const DEFAULT_TOP_N = 12;

// Pure ranking core — no disk I/O, no process.argv. Given a task string
// and/or a list of touched files, plus the 4 pre-built manifests, returns
// the warm-up set + a ranked, deduplicated, top-N list with human-readable
// reasons. resolve-context.mjs (the CLI) loads manifests from disk and
// calls this; tests call this directly against fixture manifests.
export function rankContext({
  task = '',
  files = [],
  manifests,
  warmupPaths = WARMUP_PATHS,
  topN = DEFAULT_TOP_N,
}) {
  const queryTokens = tokenize(task);
  const queryModules = extractQueryModules(queryTokens);
  const ruleNumbers = extractQueryRuleNumbers(task);
  const layerTokens = queryTokens;

  const scored = new Map();

  const addScore = (item, delta, reasons) => {
    const existing = scored.get(item.path) ?? {
      path: item.path,
      score: 0,
      reasons: [],
    };
    existing.score += delta;
    existing.reasons.push(...reasons);
    scored.set(item.path, existing);
  };

  for (const doc of manifests.documents.documents) {
    if (warmupPaths.includes(doc.path)) {
      continue;
    }
    const { score, reasons } = scoreDocument(doc, {
      queryTokens,
      queryModules,
      ruleNumbers,
    });
    if (score > 0) {
      addScore(doc, score, reasons);
    }
  }

  if (queryTokens.length > 0 || queryModules.length > 0) {
    for (const file of manifests.repository.files) {
      if (file.kind !== 'source') {
        continue;
      }
      const { score, reasons } = scoreSourceFile(file, {
        queryTokens,
        queryModules,
        layerTokens,
      });
      if (score > 0) {
        addScore(file, score, reasons);
      }
    }
  }

  const seedPaths = [...new Set(files)];
  for (const seedPath of seedPaths) {
    addScore({ path: seedPath }, Number.POSITIVE_INFINITY, [
      'explicitly touched file',
    ]);
  }
  if (seedPaths.length > 0) {
    const neighbors = findDependencyNeighbors(
      seedPaths,
      manifests.dependencyGraph.edges,
    );
    for (const [neighborPath, viaPath] of neighbors) {
      addScore({ path: neighborPath }, DEPENDENCY_OVERLAP_SCORE, [
        `depth-1 dependency neighbor of ${viaPath}`,
      ]);
    }
  }

  const ranked = [...scored.values()]
    .filter(entry => !warmupPaths.includes(entry.path))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.path.localeCompare(b.path);
    })
    .slice(0, topN);

  const touchedModules = new Set(queryModules);
  for (const seedPath of seedPaths) {
    const file = manifests.repository.files.find(
      candidate => candidate.path === seedPath,
    );
    if (file) {
      touchedModules.add(file.module);
    }
  }
  const modules = manifests.modules.modules.filter(module =>
    touchedModules.has(module.name),
  );

  return { warmup: warmupPaths, ranked, modules };
}
