const fs = require("fs");  
  
const { parseArgs } = require("./args");  
const { ensureParentDirectory, resolveInputPath, resolveOutputPath } = require("./paths");  
const { deobfuscateSourceDetailed } = require("../passes/pipeline");  
  
/**  
 * CORE FUNCTION (usable by API + CLI)  
 */  
async function deobfuscateFile(inputPath, outputPath, options = {}) {  
  const resolvedInput = resolveInputPath(inputPath);  
  const resolvedOutput = resolveOutputPath(resolvedInput, outputPath);  
  
  const source = fs.readFileSync(resolvedInput, "utf8");  
  
  const result = deobfuscateSourceDetailed(source, {  
    inputPath: resolvedInput,  
    debug: options.debug ?? false,  
  });  
  
  ensureParentDirectory(resolvedOutput);  
  fs.writeFileSync(resolvedOutput, result.output, "utf8");  
  
  return {  
    outputPath: resolvedOutput,  
    output: result.output,  
  };  
}  
  
/**  
 * CLI wrapper only  
 */  
async function runCli() {  
  const { inputPath, outputPath, debug } = parseArgs(process.argv.slice(2));  
  
  const result = await deobfuscateFile(inputPath, outputPath, { debug });  
  
  process.stdout.write(`${result.outputPath}\n`);  
}  
  
module.exports = {  
  deobfuscateFile,  
  runCli,  
};
