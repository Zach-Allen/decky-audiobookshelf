// Rollup 4 + Node 24 on macOS can leave a dependency-owned handle open after
// the bundle is written. Drive the same official Decky config through the API,
// close the bundle, then terminate cleanly. Store CI on Node 16+ gets the same
// output as `rollup -c`.
import { rollup } from "rollup";
import config from "../rollup.config.js";

const configurations = Array.isArray(config) ? config : [config];

for (const configuration of configurations) {
  const { output, ...input } = configuration;
  const bundle = await rollup(input);
  const outputs = Array.isArray(output) ? output : [output];
  for (const outputOptions of outputs) {
    await bundle.write(outputOptions);
  }
  await bundle.close();
}

console.log("Decky frontend written to dist/index.js");
process.exit(0);
