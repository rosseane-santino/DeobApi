const { Lexer } = require('./lexer');
const { Parser } = require('./parser');

/**
 * Parse Lua/Luau source code and return an AST.
 * @param {string} source - The source code to parse
 * @param {object} options
 * @param {boolean} [options.luau=true] - Whether to allow Luau extensions
 * @returns {{ ast: object, tokens: object[] }}
 */
function parse(source, options = {}) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  return { ast, tokens };
}

module.exports = { parse };
module.exports.Lexer = require('./lexer').Lexer;
module.exports.Parser = require('./parser').Parser;
module.exports.nodes = require('./nodes');

