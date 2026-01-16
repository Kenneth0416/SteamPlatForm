const { spawnSync } = require("node:child_process")

const args = process.argv.slice(2)
const forwardedArgs = args[0] === "--" ? args.slice(1) : args

const jestBin = require.resolve("jest/bin/jest")

const result = spawnSync(process.execPath, [jestBin, ...forwardedArgs], {
  stdio: "inherit",
})

process.exit(result.status ?? 1)

