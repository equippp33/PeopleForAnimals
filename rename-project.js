#!/usr/bin/env node

// ──────────────────────────────────────────────
// rename-project.js
// Renames the entire project (display name, slug,
// package ID, Android dirs, assets) in one shot.
//
// Usage:
//   node rename-project.js "New Project Name"
// ──────────────────────────────────────────────

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

// ── Parse args ──
const newDisplay = process.argv[2];
if (!newDisplay) {
  console.log('Usage: node rename-project.js "New Display Name"');
  console.log('Example: node rename-project.js "City Animal Care"');
  process.exit(1);
}

const newSlug = newDisplay.toLowerCase().replace(/\s+/g, "");

// ── Read current names from app.config.ts ──
const configPath = path.join(ROOT, "apps", "expo", "app.config.ts");
if (!fs.existsSync(configPath)) {
  console.error("Error: apps/expo/app.config.ts not found. Run from project root.");
  process.exit(1);
}

const configContent = fs.readFileSync(configPath, "utf-8");
const nameMatch = configContent.match(/name:\s*"([^"]+)"/);
const slugMatch = configContent.match(/slug:\s*"([^"]+)"/);

if (!nameMatch || !slugMatch) {
  console.error("Error: Could not read current name/slug from app.config.ts");
  process.exit(1);
}

const oldDisplay = nameMatch[1];
const oldSlug = slugMatch[1];

// ── Show mapping ──
console.log("");
console.log("=== Project Rename ===");
console.log("");
console.log(`  Display name:  "${oldDisplay}"  ->  "${newDisplay}"`);
console.log(`  Slug:          "${oldSlug}"  ->  "${newSlug}"`);
console.log(`  Package ID:    "com.${oldSlug}.app"  ->  "com.${newSlug}.app"`);
console.log(`  Vercel domain: "${oldSlug}.vercel.app"  ->  "${newSlug}.vercel.app"`);
console.log(`  Team name:     "${oldDisplay} Team"  ->  "${newDisplay} Team"`);
console.log("");

if (oldDisplay === newDisplay && oldSlug === newSlug) {
  console.log("Nothing to change - names are already set.");
  process.exit(0);
}

// ── Text file extensions to process ──
const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".json", ".xml",
  ".kt", ".gradle", ".properties", ".env", ".yaml", ".yml",
]);

// ── Directories to skip ──
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".expo", ".turbo", "build", ".git", ".cache",
]);

// ── Collect text files ──
function collectFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Legacy names to also replace ──
const legacyNames = ["People For Animals", "People For Animals", "People For Animals of Hyderabad"];

// ── Replacements (most specific first) ──
const replacements = [
  [`${oldDisplay} Team`, `${newDisplay} Team`],
  [`${oldSlug}.vercel.app`, `${newSlug}.vercel.app`],
  [`com.${oldSlug}.app`, `com.${newSlug}.app`],
  [`com.${oldSlug}`, `com.${newSlug}`],
  [oldDisplay, newDisplay],
  [oldSlug, newSlug],
  // Replace legacy hardcoded names
  ...legacyNames.map((legacy) => [legacy, newDisplay]),
];

console.log("Replacing text in files...");

const files = collectFiles(ROOT);
let filesChanged = 0;

for (const filePath of files) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    continue;
  }

  let newContent = content;
  for (const [from, to] of replacements) {
    newContent = newContent.split(from).join(to);
  }

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, "utf-8");
    filesChanged++;
    console.log(`  Updated: ${path.relative(ROOT, filePath)}`);
  }
}

console.log(`  ${filesChanged} file(s) updated.`);

// ── Rename Android package directory ──
const oldAndroidDir = path.join(ROOT, "apps", "expo", "android", "app", "src", "main", "java", "com", oldSlug, "app");
const newAndroidDir = path.join(ROOT, "apps", "expo", "android", "app", "src", "main", "java", "com", newSlug, "app");

if (fs.existsSync(oldAndroidDir)) {
  const newParent = path.dirname(newAndroidDir);
  fs.mkdirSync(newParent, { recursive: true });
  fs.renameSync(oldAndroidDir, newAndroidDir);
  // Clean up empty old parent
  const oldParent = path.dirname(oldAndroidDir);
  try {
    const remaining = fs.readdirSync(oldParent);
    if (remaining.length === 0) fs.rmdirSync(oldParent);
  } catch {}
  console.log(`  Renamed Android dir: com/${oldSlug}/app -> com/${newSlug}/app`);
}

// ── Rename logo image ──
const oldImg = path.join(ROOT, "apps", "nextjs", "public", "assets", "images", `${oldSlug}.png`);
const newImg = path.join(ROOT, "apps", "nextjs", "public", "assets", "images", `${newSlug}.png`);

if (fs.existsSync(oldImg)) {
  fs.renameSync(oldImg, newImg);
  console.log(`  Renamed image: ${oldSlug}.png -> ${newSlug}.png`);
}

// ── Rename keystore files ──
const expoDir = path.join(ROOT, "apps", "expo");
try {
  const expoFiles = fs.readdirSync(expoDir);
  for (const file of expoFiles) {
    if (file.includes(`@equipppdeveloper__${oldSlug}`) && file.endsWith(".jks")) {
      const newFile = file.replace(oldSlug, newSlug);
      fs.renameSync(path.join(expoDir, file), path.join(expoDir, newFile));
      console.log(`  Renamed keystore: ${file} -> ${newFile}`);
    }
  }
} catch {}

// ── Summary ──
console.log("");
console.log("=== Done! ===");
console.log("");
console.log(`Project renamed to "${newDisplay}" (slug: ${newSlug})`);
console.log("");
console.log("Next steps:");
console.log("  1. Run 'pnpm install' to regenerate lockfile");
console.log("  2. For Android, run 'cd apps/expo && npx expo prebuild --clean'");
console.log("");
