#!/usr/bin/env node
/**
 * GCIT Arena — installs this theme's pre-commit guard into the repo's
 * local .git/hooks so `static/` (Vite build output) can never be
 * committed stale relative to `assets/` (source).
 *
 * Runs automatically via `yarn install` (see package.json "postinstall").
 * Local-machine, dev-convenience only:
 *   - never touches CTFd's backend/API code
 *   - never touches anything outside this theme folder, except the
 *     untracked, machine-local `.git/hooks/` directory
 *   - safe to re-run; won't clobber an unrelated existing pre-commit hook
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const MARKER = "# gcit-arena-auto-rebuild";

try {
  const repoRoot = execSync("git rev-parse --show-toplevel", {
    cwd: __dirname,
    encoding: "utf8",
  }).trim();

  const hooksDir = path.join(repoRoot, ".git", "hooks");
  if (!fs.existsSync(hooksDir)) {
    process.exit(0); // Not a normal git checkout — nothing to install into.
  }

  const dest = path.join(hooksDir, "pre-commit");
  const themeHookPath = path
    .join(__dirname, "..", "hooks", "pre-commit")
    .replace(/\\/g, "/");

  if (fs.existsSync(dest)) {
    const existing = fs.readFileSync(dest, "utf8");
    if (existing.includes(MARKER)) {
      process.exit(0); // Already installed.
    }
    fs.appendFileSync(dest, `\n${MARKER}\nbash "${themeHookPath}" || exit 1\n`);
  } else {
    fs.writeFileSync(
      dest,
      `#!/usr/bin/env bash\n${MARKER}\nbash "${themeHookPath}" || exit 1\n`,
    );
  }

  fs.chmodSync(dest, 0o755);
  console.log(
    "[gcit-arena] pre-commit hook installed — static/ auto-rebuilds on commit.",
  );
} catch (e) {
  // Never fail `yarn install` because of this convenience step.
  console.warn("[gcit-arena] Skipped pre-commit hook install:", e.message);
}
