const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const sharedSource = path.join(rootDir, "cloudfunctions", "_shared");
const targets = [
  "createIncubationQuestions",
  "generateIncubationAnalysis",
  "saveGeneratedProject",
  "listGeneratedProjects",
];

for (const target of targets) {
  const functionDir = path.join(rootDir, "cloudfunctions", target);
  const sharedTarget = path.join(functionDir, "_shared");

  fs.mkdirSync(functionDir, { recursive: true });
  fs.rmSync(sharedTarget, { recursive: true, force: true });
  fs.cpSync(sharedSource, sharedTarget, { recursive: true });
}

console.log(`Synced cloudfunctions/_shared to ${targets.length} functions.`);
