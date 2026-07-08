import path from "node:path";

function normalizeFilename(filename) {
  return filename.replaceAll("\\", "/");
}

export function getFilename(context) {
  return normalizeFilename(context.physicalFilename ?? context.filename);
}

export function getImportSource(node) {
  return typeof node.source.value === "string" ? node.source.value : "";
}

function getSrcRoot(filename) {
  const srcIndex = filename.lastIndexOf("/src/");

  return srcIndex === -1 ? "" : filename.slice(0, srcIndex + 5);
}

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

  return "";
}

export function getImportCandidates(source, filename) {
  const normalizedSource = normalizeFilename(source);
  const resolvedSource = resolveProjectImportPath(source, filename);

  return resolvedSource === ""
    ? [normalizedSource]
    : [normalizedSource, resolvedSource];
}
