// ===== Тест-раннер: последовательно запускает все *.test.js =====
const path = require("path");
const fs = require("fs");

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.js")).sort();

let exitCode = 0;
for (const f of files) {
  const p = path.join(dir, f);
  console.log("\n>>> " + f);
  try {
    require("child_process").execFileSync(process.execPath, [p], { stdio: "inherit" });
  } catch (e) {
    exitCode = 1;
  }
}

process.exit(exitCode);
