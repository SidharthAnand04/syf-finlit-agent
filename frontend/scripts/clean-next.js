/**
 * Remove .next (and optional webpack cache) so dev/build regenerate client chunks.
 * Fixes 404s on /_next/static/chunks/main-app.js when the cache is stale or incomplete
 * (common with cloud-synced folders on Windows).
 *
 * When next.config.js uses a temp distDir for `next dev`, that folder is removed too
 * (same hash as next.config.js).
 */
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.join(__dirname, "..");
const devDistDir = path.join(
  os.tmpdir(),
  `syf-finlit-next-dev-${crypto.createHash("sha1").update(root).digest("hex").slice(0, 12)}`
);

function rm(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
    const rel = path.relative(root, p);
    console.log("[clean-next] removed", rel && !rel.startsWith("..") ? rel : p);
  } catch (e) {
    if (e.code !== "ENOENT") console.warn("[clean-next]", p, e.message);
  }
}

rm(path.join(root, ".next"));
rm(devDistDir);
rm(path.join(root, "node_modules", ".cache"));
