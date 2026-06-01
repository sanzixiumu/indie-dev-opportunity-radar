const path = require("path");
const ci = require("miniprogram-ci");

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const result = await ci.packNpmManually({
    packageJsonPath: path.join(projectRoot, "package.json"),
    miniprogramNpmDistDir: projectRoot,
  });

  console.log(
    `miniprogram_npm built: miniProgram=${result.miniProgramPackNum}, other=${result.otherNpmPackNum}, warnings=${result.warnList.length}`,
  );

  if (result.warnList.length > 0) {
    console.warn(JSON.stringify(result.warnList, null, 2));
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
