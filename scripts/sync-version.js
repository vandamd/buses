const { execFileSync } = require("node:child_process");
const fs = require("node:fs");

const JSON_FILES_TO_FORMAT = ["app.json", "package.json"];
const BUNX_COMMAND = process.platform === "win32" ? "bunx.cmd" : "bunx";

function formatJsonFiles() {
  execFileSync(
    BUNX_COMMAND,
    ["@biomejs/biome", "format", "--write", ...JSON_FILES_TO_FORMAT],
    {
      stdio: "inherit",
    }
  );
}

console.log("Syncing version from app.json...\n");

try {
  const appConfig = JSON.parse(fs.readFileSync("app.json", "utf8"));
  const version = appConfig.expo.version;

  console.log(`Target version: ${version}`);

  // Update package.json
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const oldPackageVersion = packageJson.version;
  packageJson.version = version;
  fs.writeFileSync("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
  console.log(`Updated package.json: ${oldPackageVersion} -> ${version}`);

  // Update Android build.gradle
  const buildGradlePath = "android/app/build.gradle";
  if (fs.existsSync(buildGradlePath)) {
    let buildGradle = fs.readFileSync(buildGradlePath, "utf8");
    const currentVersionMatch = buildGradle.match(/versionName\s+"([^"]*)"/);
    const oldAndroidVersion = currentVersionMatch
      ? currentVersionMatch[1]
      : "unknown";

    buildGradle = buildGradle.replace(
      /versionName\s+"[^"]*"/,
      `versionName "${version}"`
    );
    fs.writeFileSync(buildGradlePath, buildGradle);
    console.log(
      `Updated android/app/build.gradle: ${oldAndroidVersion} -> ${version}`
    );
  } else {
    console.log("android/app/build.gradle not found (run build first)");
  }

  formatJsonFiles();

  console.log("\nVersion sync complete!");
} catch (error) {
  console.error("Error syncing version:", error.message);
  process.exit(1);
}
