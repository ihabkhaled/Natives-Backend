// Skip husky's git-hook install in CI / production installs (Vercel, pipelines)
// where hooks are pointless and husky may not even be installed. Official
// husky v9 pattern: https://typicode.github.io/husky/how-to.html#ci-server-and-docker
if (
  process.env.CI !== undefined ||
  process.env.VERCEL !== undefined ||
  process.env.NODE_ENV === 'production'
) {
  process.exit(0);
}

try {
  const { default: husky } = await import('husky');
  console.log(husky());
} catch {
  // husky not installed (prod-only install) — nothing to do.
  process.exit(0);
}
