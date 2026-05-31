#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parse } = require('./src/index');

function parseLuaSource(source, file = '<memory>', includeTokens = false) {
  const result = parse(source);

  if (includeTokens) {
    return {
      file,
      ast: result.ast,
      tokens: result.tokens
    };
  }

  return {
    file,
    ast: result.ast
  };
}

// ─── CLI Argument Parser ──────────────────────────────────────────────────────

function printHelp() {
  console.log(`
lua-ast - Lua/Luau AST parser

USAGE:
  lua-ast [options] [file]

OPTIONS:
  -i, --input  <file>     Input Lua/Luau file (or use stdin)
  -o, --output <file>     Output file for the AST JSON (default: stdout)
  -t, --tokens            Also output token list alongside the AST
  -p, --pretty            Pretty-print JSON output (default: true)
  -c, --compact           Compact JSON output (no indentation)
      --indent <n>        JSON indentation spaces (default: 2)
  -q, --quiet             Suppress info messages
  -h, --help              Show this help message
  -v, --version           Show version

EXAMPLES:
  lua-ast script.lua
  lua-ast -i script.lua -o ast.json
  lua-ast -i script.lua --tokens
  echo "print('hello')" | lua-ast
  lua-ast script.lua --compact -o ast.json
`);
}

function parseArgs(argv) {
  const args = {
    input: null,
    output: null,
    tokens: false,
    pretty: true,
    indent: 2,
    quiet: false,
    help: false,
    version: false,
    positional: [],
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case '-i': case '--input':
        args.input = argv[++i]; break;
      case '-o': case '--output':
        args.output = argv[++i]; break;
      case '-t': case '--tokens':
        args.tokens = true; break;
      case '-p': case '--pretty':
        args.pretty = true; break;
      case '-c': case '--compact':
        args.pretty = false; break;
      case '--indent':
        args.indent = parseInt(argv[++i], 10); break;
      case '-q': case '--quiet':
        args.quiet = true; break;
      case '-h': case '--help':
        args.help = true; break;
      case '-v': case '--version':
        args.version = true; break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
        args.positional.push(arg);
    }
    i++;
  }

  if (!args.input && args.positional.length > 0) {
    args.input = args.positional[0];
  }

  return args;
}

// ─── Read source ──────────────────────────────────────────────────────────────

function readInput(filePath) {
  if (filePath) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    return { source: fs.readFileSync(resolved, 'utf8'), file: resolved };
  }

  if (process.stdin.isTTY) {
    console.error('Error: No input file specified and no stdin data available.');
    console.error('Use --help for usage information.');
    process.exit(1);
  }

  return { source: fs.readFileSync('/dev/stdin', 'utf8'), file: '<stdin>' };
}

// ─── Write output ─────────────────────────────────────────────────────────────

function writeOutput(filePath, content) {
  if (filePath) {
    const resolved = path.resolve(filePath);
    const dir = path.dirname(resolved);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(resolved, content, 'utf8');
  } else {
    process.stdout.write(content + '\n');
  }
}

// ─── Format error ─────────────────────────────────────────────────────────────

function formatError(err, source, file) {
  const lines = source.split('\n');
  const lineNum = err.line || 0;
  const colNum = err.col || 0;

  let out = `\n  ${err.message}\n`;

  if (lineNum > 0 && lineNum <= lines.length) {
    const srcLine = lines[lineNum - 1];

    out += `\n  File: ${file}\n`;
    out += `  ${lineNum} | ${srcLine}\n`;
    out += `  ${' '.repeat(String(lineNum).length + 2 + colNum - 1)}^\n`;
  }

  return out;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  if (args.version) {
    const pkg = require('./package.json');
    console.log(`lua-ast v${pkg.version}`);
    process.exit(0);
  }

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const { source, file } = readInput(args.input);

  if (!args.quiet) {
    process.stderr.write(`Parsing: ${file}\n`);
  }

  let result;

  try {
    result = parse(source);
  } catch (err) {
    if (err.line !== undefined) {
      process.stderr.write(
        '\x1b[31mParse Error:\x1b[0m' +
        formatError(err, source, file)
      );
    } else {
      process.stderr.write(`\x1b[31mError:\x1b[0m ${err.message}\n`);
    }

    process.exit(1);
  }

  const indent = args.pretty ? args.indent : undefined;

  let output;

  if (args.tokens) {
    output = JSON.stringify(
      {
        file,
        ast: result.ast,
        tokens: result.tokens
      },
      null,
      indent
    );
  } else {
    output = JSON.stringify(
      {
        file,
        ast: result.ast
      },
      null,
      indent
    );
  }

  writeOutput(args.output, output);

  if (!args.quiet && args.output) {
    const nodeCount = countNodes(result.ast);

    process.stderr.write(
      `\x1b[32m✓\x1b[0m AST written to ${args.output} (${nodeCount} nodes)\n`
    );
  }
}

function countNodes(node) {
  if (!node || typeof node !== 'object') {
    return 0;
  }

  let count = node.type ? 1 : 0;

  for (const val of Object.values(node)) {
    if (Array.isArray(val)) {
      for (const item of val) {
        count += countNodes(item);
      }
    } else if (val && typeof val === 'object') {
      count += countNodes(val);
    }
  }

  return count;
}

module.exports = {
  parseLuaSource
};

if (require.main === module) {
  main();
                                 }
