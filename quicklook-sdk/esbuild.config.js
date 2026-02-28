import * as esbuild from "esbuild";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "dist");
try {
  mkdirSync(distDir, { recursive: true });
} catch (e) {}

try {
  await esbuild.build({
    entryPoints: [join(__dirname, "src", "index.js")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    outfile: join(distDir, "quicklook-sdk.js"),
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    mainFields: ["module", "main"],
  });

  await esbuild.build({
    entryPoints: [join(__dirname, "worker", "compress.worker.js")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    outfile: join(distDir, "compress.worker.js"),
  });

  console.log("Built dist/quicklook-sdk.js and dist/compress.worker.js");
} catch (err) {
  console.error("Build failed:", err);
  process.exit(1);
}
