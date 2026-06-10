const esbuild = require("esbuild");

async function build() {
  console.log("Building extension scripts...");
  try {
    // 1. Build background service worker (ESM format is supported by type: module)
    await esbuild.build({
      entryPoints: ["background.ts"],
      bundle: true,
      outfile: "dist/background.js",
      format: "esm",
      minify: false,
      sourcemap: true,
      target: ["chrome100"],
    });

    // 2. Build content script (IIFE format is highly compatible with page injection)
    await esbuild.build({
      entryPoints: ["content.ts"],
      bundle: true,
      outfile: "dist/content.js",
      format: "iife",
      minify: false,
      sourcemap: true,
      target: ["chrome100"],
    });

    console.log("Extension scripts compiled successfully to dist/");
  } catch (err) {
    console.error("Build failed:", err);
    process.exit(1);
  }
}

build();
