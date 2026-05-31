const TT = {
  // Literals
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  NAME: 'NAME',
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  NIL: 'NIL',
  VARARG: 'VARARG',        // ...

  // Keywords
  AND: 'AND',
  BREAK: 'BREAK',
  DO: 'DO',
  ELSE: 'ELSE',
  ELSEIF: 'ELSEIF',
  END: 'END',
  FOR: 'FOR',
  FUNCTION: 'FUNCTION',
  GOTO: 'GOTO',
  IF: 'IF',
  IN: 'IN',
  LOCAL: 'LOCAL',
  NOT: 'NOT',
  OR: 'OR',
  REPEAT: 'REPEAT',
  RETURN: 'RETURN',
  THEN: 'THEN',
  UNTIL: 'UNTIL',
  WHILE: 'WHILE',
  // Luau
  TYPE: 'TYPE',
  TYPEOF: 'TYPEOF',
  CONTINUE: 'CONTINUE',
  EXPORT: 'EXPORT',

  // Operators
  PLUS: 'PLUS',           // +
  MINUS: 'MINUS',         // -
  STAR: 'STAR',           // *
  SLASH: 'SLASH',         // /
  DOUBLESLASH: 'DOUBLESLASH', // //
  PERCENT: 'PERCENT',     // %
  CARET: 'CARET',         // ^
  HASH: 'HASH',           // #
  AMPERSAND: 'AMPERSAND', // &
  TILDE: 'TILDE',         // ~
  PIPE: 'PIPE',           // |
  LSHIFT: 'LSHIFT',       // <<
  RSHIFT: 'RSHIFT',       // >>
  EQ: 'EQ',               // ==
  NEQ: 'NEQ',             // ~=
  LT: 'LT',               // <
  LE: 'LE',               // <=
  GT: 'GT',               // >
  GE: 'GE',               // >=
  ASSIGN: 'ASSIGN',       // =
  CONCAT: 'CONCAT',       // ..
  DOT: 'DOT',             // .
  COLON: 'COLON',         // :
  DOUBLECOLON: 'DOUBLECOLON', // ::
  SEMICOLON: 'SEMICOLON', // ;
  COMMA: 'COMMA',         // ,

  // Delimiters
  LPAREN: 'LPAREN',       // (
  RPAREN: 'RPAREN',       // )
  LBRACKET: 'LBRACKET',   // [
  RBRACKET: 'RBRACKET',   // ]
  LBRACE: 'LBRACE',       // {
  RBRACE: 'RBRACE',       // }

  // Luau type annotations
  QUESTION: 'QUESTION',   // ?
  ARROW: 'ARROW',         // ->

  EOF: 'EOF',
};

const KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for',
  'function', 'goto', 'if', 'in', 'local', 'nil', 'not', 'or',
  'repeat', 'return', 'then', 'true', 'until', 'while',
  // Luau
  'type', 'typeof', 'continue', 'export',
]);

const KEYWORD_MAP = {
  'and': TT.AND, 'break': TT.BREAK, 'do': TT.DO, 'else': TT.ELSE,
  'elseif': TT.ELSEIF, 'end': TT.END, 'false': TT.FALSE, 'for': TT.FOR,
  'function': TT.FUNCTION, 'goto': TT.GOTO, 'if': TT.IF, 'in': TT.IN,
  'local': TT.LOCAL, 'nil': TT.NIL, 'not': TT.NOT, 'or': TT.OR,
  'repeat': TT.REPEAT, 'return': TT.RETURN, 'then': TT.THEN,
  'true': TT.TRUE, 'until': TT.UNTIL, 'while': TT.WHILE,
  'type': TT.TYPE, 'typeof': TT.TYPEOF, 'continue': TT.CONTINUE,
  'export': TT.EXPORT,
};

class Token {
  constructor(type, value, line, col) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.col = col;
  }
  toString() {
    return `Token(${this.type}, ${JSON.stringify(this.value)}, ${this.line}:${this.col})`;
  }
}

class LexError extends Error {
  constructor(msg, line, col) {
    super(`Lex error at ${line}:${col}: ${msg}`);
    this.line = line;
    this.col = col;
  }
}

class Lexer {
  constructor(source) {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
  }

  error(msg) {
    throw new LexError(msg, this.line, this.col);
  }

  peek(offset = 0) {
    return this.source[this.pos + offset];
  }

  advance() {
    const ch = this.source[this.pos++];
    if (ch === '\n') { this.line++; this.col = 1; }
    else { this.col++; }
    return ch;
  }

  match(ch) {
    if (this.source[this.pos] === ch) { this.advance(); return true; }
    return false;
  }

  skipWhitespaceAndComments() {
    while (this.pos < this.source.length) {
      const ch = this.peek();
      // Whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance();
        continue;
      }
      // Comment
      if (ch === '-' && this.peek(1) === '-') {
        this.advance(); this.advance();
        // Long comment?
        if (this.peek() === '[') {
          const level = this.checkLongBracketOpen();
          if (level >= 0) { this.readLongString(level); continue; }
        }
        // Short comment - skip to end of line
        while (this.pos < this.source.length && this.peek() !== '\n') this.advance();
        continue;
      }
      break;
    }
  }

  checkLongBracketOpen() {
    // Returns level if [=*[ found, else -1
    let i = this.pos;
    if (this.source[i] !== '[') return -1;
    i++;
    let level = 0;
    while (this.source[i] === '=') { level++; i++; }
    if (this.source[i] === '[') return level;
    return -1;
  }

  readLongString(level) {
    // Consume opening [=..=[
    this.advance(); // [
    for (let i = 0; i < level; i++) this.advance(); // =s
    this.advance(); // [
    // Skip first newline if present
    if (this.peek() === '\n') this.advance();
    else if (this.peek() === '\r') {
      this.advance();
      if (this.peek() === '\n') this.advance();
    }
    const closing = ']' + '='.repeat(level) + ']';
    let str = '';
    while (this.pos < this.source.length) {
      if (this.source.startsWith(closing, this.pos)) {
        for (let i = 0; i < closing.length; i++) this.advance();
        return str;
      }
      str += this.advance();
    }
    this.error('Unfinished long string');
  }

  readString(quote) {
    this.advance(); // opening quote
    let str = '';
    while (this.pos < this.source.length) {
      const ch = this.peek();
      if (ch === quote) { this.advance(); return str; }
      if (ch === '\n' || ch === '\r') this.error('Unfinished string');
      if (ch === '\\') {
        this.advance();
        const esc = this.advance();
        switch (esc) {
          case 'a': str += '\x07'; break;
          case 'b': str += '\b'; break;
          case 'f': str += '\f'; break;
          case 'n': str += '\n'; break;
          case 'r': str += '\r'; break;
          case 't': str += '\t'; break;
          case 'v': str += '\x0B'; break;
          case '\\': str += '\\'; break;
          case '\'': str += '\''; break;
          case '"': str += '"'; break;
          case '\n': case '\r': str += '\n'; break;
          case 'x': {
            let hex = '';
            for (let i = 0; i < 2; i++) {
              if (/[0-9a-fA-F]/.test(this.peek())) hex += this.advance();
              else this.error('Invalid hex escape');
            }
            str += String.fromCharCode(parseInt(hex, 16));
            break;
          }
          case 'u': {
            if (this.peek() !== '{') this.error('Missing { in \\u escape');
            this.advance();
            let hex = '';
            while (/[0-9a-fA-F]/.test(this.peek())) hex += this.advance();
            if (this.peek() !== '}') this.error('Missing } in \\u escape');
            this.advance();
            str += String.fromCodePoint(parseInt(hex, 16));
            break;
          }
          case 'z': {
            while (/\s/.test(this.peek())) this.advance();
            break;
          }
          default:
            if (/[0-9]/.test(esc)) {
              let num = esc;
              for (let i = 0; i < 2 && /[0-9]/.test(this.peek()); i++) num += this.advance();
              const code = parseInt(num, 10);
              if (code > 255) this.error('Decimal escape too large');
              str += String.fromCharCode(code);
            } else {
              this.error(`Invalid escape sequence \\${esc}`);
            }
        }
      } else {
        str += this.advance();
      }
    }
    this.error('Unfinished string');
  }

  readNumber() {
    let num = '';
    const start = this.pos;
    // Hex
    if (this.peek() === '0' && (this.peek(1) === 'x' || this.peek(1) === 'X')) {
      num += this.advance() + this.advance();
      while (this.pos < this.source.length && /[0-9a-fA-F_]/.test(this.source[this.pos])) num += this.advance();
      if (this.peek() === '.') {
        num += this.advance();
        while (this.pos < this.source.length && /[0-9a-fA-F_]/.test(this.source[this.pos])) num += this.advance();
      }
      if (this.peek() === 'p' || this.peek() === 'P') {
        num += this.advance();
        if (this.peek() === '+' || this.peek() === '-') num += this.advance();
        while (this.pos < this.source.length && /[0-9]/.test(this.source[this.pos])) num += this.advance();
      }
    } else {
      while (this.pos < this.source.length && /[0-9_]/.test(this.source[this.pos])) num += this.advance();
      if (this.peek() === '.') {
        num += this.advance();
        while (this.pos < this.source.length && /[0-9_]/.test(this.source[this.pos])) num += this.advance();
      }
      if (this.peek() === 'e' || this.peek() === 'E') {
        num += this.advance();
        if (this.peek() === '+' || this.peek() === '-') num += this.advance();
        while (this.pos < this.source.length && /[0-9]/.test(this.source[this.pos])) num += this.advance();
      }
    }
    return num.replace(/_/g, '');
  }

  tokenize() {
    while (true) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.source.length) {
        this.tokens.push(new Token(TT.EOF, null, this.line, this.col));
        break;
      }
      const line = this.line, col = this.col;
      const ch = this.peek();

      // Numbers
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(this.peek(1)))) {
        const num = this.readNumber();
        this.tokens.push(new Token(TT.NUMBER, num, line, col));
        continue;
      }

      // Identifiers / keywords
      if (/[a-zA-Z_]/.test(ch)) {
        let name = '';
        while (this.pos < this.source.length && /[a-zA-Z0-9_]/.test(this.source[this.pos])) name += this.advance();
        const tt = KEYWORD_MAP[name] || TT.NAME;
        this.tokens.push(new Token(tt, name, line, col));
        continue;
      }

      // Strings
      if (ch === '"' || ch === "'") {
        const str = this.readString(ch);
        this.tokens.push(new Token(TT.STRING, str, line, col));
        continue;
      }

      // Long strings
      if (ch === '[') {
        const level = this.checkLongBracketOpen();
        if (level >= 0) {
          const str = this.readLongString(level);
          this.tokens.push(new Token(TT.STRING, str, line, col));
          continue;
        }
      }

      // Operators and punctuation
      this.advance();
      switch (ch) {
        case '+': this.tokens.push(new Token(TT.PLUS, '+', line, col)); break;
        case '*': this.tokens.push(new Token(TT.STAR, '*', line, col)); break;
        case '%': this.tokens.push(new Token(TT.PERCENT, '%', line, col)); break;
        case '^': this.tokens.push(new Token(TT.CARET, '^', line, col)); break;
        case '#': this.tokens.push(new Token(TT.HASH, '#', line, col)); break;
        case '&': this.tokens.push(new Token(TT.AMPERSAND, '&', line, col)); break;
        case '|': this.tokens.push(new Token(TT.PIPE, '|', line, col)); break;
        case '(': this.tokens.push(new Token(TT.LPAREN, '(', line, col)); break;
        case ')': this.tokens.push(new Token(TT.RPAREN, ')', line, col)); break;
        case ']': this.tokens.push(new Token(TT.RBRACKET, ']', line, col)); break;
        case '{': this.tokens.push(new Token(TT.LBRACE, '{', line, col)); break;
        case '}': this.tokens.push(new Token(TT.RBRACE, '}', line, col)); break;
        case ';': this.tokens.push(new Token(TT.SEMICOLON, ';', line, col)); break;
        case ',': this.tokens.push(new Token(TT.COMMA, ',', line, col)); break;
        case '?': this.tokens.push(new Token(TT.QUESTION, '?', line, col)); break;
        case '-':
          if (this.match('>')) this.tokens.push(new Token(TT.ARROW, '->', line, col));
          else this.tokens.push(new Token(TT.MINUS, '-', line, col));
          break;
        case '/':
          if (this.match('/')) this.tokens.push(new Token(TT.DOUBLESLASH, '//', line, col));
          else this.tokens.push(new Token(TT.SLASH, '/', line, col));
          break;
        case '~':
          if (this.match('=')) this.tokens.push(new Token(TT.NEQ, '~=', line, col));
          else this.tokens.push(new Token(TT.TILDE, '~', line, col));
          break;
        case '<':
          if (this.match('<')) this.tokens.push(new Token(TT.LSHIFT, '<<', line, col));
          else if (this.match('=')) this.tokens.push(new Token(TT.LE, '<=', line, col));
          else this.tokens.push(new Token(TT.LT, '<', line, col));
          break;
        case '>':
          if (this.match('>')) this.tokens.push(new Token(TT.RSHIFT, '>>', line, col));
          else if (this.match('=')) this.tokens.push(new Token(TT.GE, '>=', line, col));
          else this.tokens.push(new Token(TT.GT, '>', line, col));
          break;
        case '=':
          if (this.match('=')) this.tokens.push(new Token(TT.EQ, '==', line, col));
          else this.tokens.push(new Token(TT.ASSIGN, '=', line, col));
          break;
        case ':':
          if (this.match(':')) this.tokens.push(new Token(TT.DOUBLECOLON, '::', line, col));
          else this.tokens.push(new Token(TT.COLON, ':', line, col));
          break;
        case '.':
          if (this.peek() === '.' && this.peek(1) === '.') {
            this.advance(); this.advance();
            this.tokens.push(new Token(TT.VARARG, '...', line, col));
          } else if (this.peek() === '.') {
            this.advance();
            this.tokens.push(new Token(TT.CONCAT, '..', line, col));
          } else {
            this.tokens.push(new Token(TT.DOT, '.', line, col));
          }
          break;
        case '[':
          this.tokens.push(new Token(TT.LBRACKET, '[', line, col)); break;
        default:
          this.error(`Unexpected character: ${JSON.stringify(ch)}`);
      }
    }
    return this.tokens;
  }
}

module.exports = { Lexer, Token, TT, KEYWORDS };
