import path from "node:path";

function normalizeFilename(filename) {
  return filename.replaceAll("\\", "/");
}

export function getFilename(context) {
  return normalizeFilename(context.physicalFilename ?? context.filename);
}

export function getImportSource(node) {
  if (typeof node.source.value === "string") {
    return node.source.value;
  }
  if (
    node.source.type === "TemplateLiteral" &&
    node.source.expressions.length === 0
  ) {
    return node.source.quasis[0]?.value.cooked ?? "";
  }
  return "";
}

function getSrcRoot(filename) {
  if (filename.startsWith("src/")) {
    return "src/";
  }
  const srcIndex = filename.lastIndexOf("/src/");

  return srcIndex === -1 ? "" : filename.slice(0, srcIndex + 5);
}

const projectAliases = [
  ["@modules/", "modules/"],
  ["@shared/", "shared/"],
  ["@config/", "config/"],
  ["@core/", "core/"],
  ["@app/", ""],
  ["@/", ""],
];

function resolveProjectImportPath(source, filename) {
  if (source.startsWith(".")) {
    return normalizeFilename(path.resolve(path.dirname(filename), source));
  }

  if (source.startsWith("src/")) {
    const srcRoot = getSrcRoot(filename);

    return srcRoot === ""
      ? ""
      : normalizeFilename(path.join(srcRoot, source.slice(4)));
  }

  for (const [prefix, target] of projectAliases) {
    if (source.startsWith(prefix)) {
      const srcRoot = getSrcRoot(filename);
      return srcRoot === ""
        ? ""
        : normalizeFilename(
            path.join(srcRoot, target, source.slice(prefix.length)),
          );
    }
  }

  return "";
}

export function getImportCandidates(source, filename) {
  const normalizedSource = normalizeFilename(source);
  const resolvedSource = resolveProjectImportPath(source, filename);

  return resolvedSource === ""
    ? [normalizedSource]
    : [normalizedSource, resolvedSource];
}
