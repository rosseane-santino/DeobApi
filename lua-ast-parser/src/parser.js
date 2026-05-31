const { TT } = require('./lexer');
const { Stmt, Expr, Field, Type } = require('./nodes');

class ParseError extends Error {
  constructor(msg, token) {
    super(`Parse error at ${token.line}:${token.col}: ${msg} (got ${token.type}${token.value != null ? ' ' + JSON.stringify(token.value) : ''})`);
    this.token = token;
    this.line = token.line;
    this.col = token.col;
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() { return this.tokens[this.pos]; }
  peek2() { return this.tokens[this.pos + 1]; }

  advance() {
    const tok = this.tokens[this.pos];
    if (tok.type !== TT.EOF) this.pos++;
    return tok;
  }

  check(type) { return this.peek().type === type; }

  match(...types) {
    if (types.includes(this.peek().type)) { return this.advance(); }
    return null;
  }

  expect(type) {
    const tok = this.peek();
    if (tok.type !== type) throw new ParseError(`Expected ${type}`, tok);
    return this.advance();
  }

  error(msg) { throw new ParseError(msg, this.peek()); }

  // ─── Entry ────────────────────────────────────────────────────────────────

  parse() {
    const block = this.parseBlock();
    this.expect(TT.EOF);
    return block;
  }

  // ─── Block ────────────────────────────────────────────────────────────────

  parseBlock() {
    const line = this.peek().line;
    const body = [];
    while (true) {
      this.skipSemicolons();
      const t = this.peek();
      if (t.type === TT.EOF ||
          t.type === TT.END ||
          t.type === TT.ELSE ||
          t.type === TT.ELSEIF ||
          t.type === TT.UNTIL) break;

      const stmt = this.parseStatement();
      if (stmt) {
        body.push(stmt);
        if (stmt.type === 'Return') break;
      }
    }
    return Stmt.Block(body, line);
  }

  skipSemicolons() {
    while (this.check(TT.SEMICOLON)) this.advance();
  }

  // ─── Statements ──────────────────────────────────────────────────────────

  parseStatement() {
    const t = this.peek();
    switch (t.type) {
      case TT.IF:       return this.parseIf();
      case TT.WHILE:    return this.parseWhile();
      case TT.DO:       return this.parseDo();
      case TT.FOR:      return this.parseFor();
      case TT.REPEAT:   return this.parseRepeat();
      case TT.FUNCTION: return this.parseFunctionDecl();
      case TT.LOCAL:    return this.parseLocal();
      case TT.RETURN:   return this.parseReturn();
      case TT.BREAK:    this.advance(); return Stmt.Break(t.line);
      case TT.CONTINUE: this.advance(); return Stmt.Continue(t.line); // Luau
      case TT.GOTO:     return this.parseGoto();
      case TT.DOUBLECOLON: return this.parseLabel();
      case TT.TYPE:     return this.parseTypeAlias(false);
      case TT.EXPORT:   return this.parseExport();
      default:          return this.parseExprStat();
    }
  }

  parseIf() {
    const line = this.peek().line;
    this.expect(TT.IF);
    const clauses = [];
    const cond = this.parseExpr();
    this.expect(TT.THEN);
    const body = this.parseBlock();
    clauses.push({ condition: cond, body });

    while (this.check(TT.ELSEIF)) {
      this.advance();
      const c = this.parseExpr();
      this.expect(TT.THEN);
      const b = this.parseBlock();
      clauses.push({ condition: c, body: b });
    }

    let elseBody = null;
    if (this.match(TT.ELSE)) {
      elseBody = this.parseBlock();
    }
    this.expect(TT.END);
    return Stmt.If(clauses, elseBody, line);
  }

  parseWhile() {
    const line = this.peek().line;
    this.expect(TT.WHILE);
    const cond = this.parseExpr();
    this.expect(TT.DO);
    const body = this.parseBlock();
    this.expect(TT.END);
    return Stmt.While(cond, body, line);
  }

  parseDo() {
    const line = this.peek().line;
    this.expect(TT.DO);
    const body = this.parseBlock();
    this.expect(TT.END);
    return Stmt.Do(body, line);
  }

  parseFor() {
    const line = this.peek().line;
    this.expect(TT.FOR);
    const firstName = this.expect(TT.NAME).value;

    if (this.match(TT.ASSIGN)) {
      // Numeric for
      const start = this.parseExpr();
      this.expect(TT.COMMA);
      const limit = this.parseExpr();
      const step = this.match(TT.COMMA) ? this.parseExpr() : null;
      this.expect(TT.DO);
      const body = this.parseBlock();
      this.expect(TT.END);
      return Stmt.ForNum(firstName, start, limit, step, body, line);
    } else {
      // Generic for
      const names = [firstName];
      while (this.match(TT.COMMA)) names.push(this.expect(TT.NAME).value);
      this.expect(TT.IN);
      const iterators = this.parseExprList();
      this.expect(TT.DO);
      const body = this.parseBlock();
      this.expect(TT.END);
      return Stmt.ForIn(names, iterators, body, line);
    }
  }

  parseRepeat() {
    const line = this.peek().line;
    this.expect(TT.REPEAT);
    const body = this.parseBlock();
    this.expect(TT.UNTIL);
    const cond = this.parseExpr();
    return Stmt.Repeat(body, cond, line);
  }

  parseFunctionDecl() {
    const line = this.peek().line;
    this.expect(TT.FUNCTION);
    // funcname ::= Name {'.' Name} [':' Name]
    let name = Expr.Name(this.expect(TT.NAME).value, line);
    let isMethod = false;
    while (this.check(TT.DOT)) {
      this.advance();
      const field = this.expect(TT.NAME).value;
      name = Expr.Field(name, field, line);
    }
    if (this.check(TT.COLON)) {
      this.advance();
      const method = this.expect(TT.NAME).value;
      name = Expr.Field(name, method, line);
      isMethod = true;
    }
    const func = this.parseFuncBody(isMethod, line);
    return Stmt.FunctionDecl(name, func, line);
  }

  parseLocal() {
    const line = this.peek().line;
    this.expect(TT.LOCAL);

    if (this.check(TT.FUNCTION)) {
      this.advance();
      const name = this.expect(TT.NAME).value;
      const func = this.parseFuncBody(false, line);
      return Stmt.LocalFunction(name, func, line);
    }

    // local namelist ['=' explist]
    const names = [];
    const attribs = [];
    const types = [];

    names.push(this.expect(TT.NAME).value);
    attribs.push(this.parseAttrib());
    types.push(this.parseOptionalTypeAnnotation());

    while (this.match(TT.COMMA)) {
      names.push(this.expect(TT.NAME).value);
      attribs.push(this.parseAttrib());
      types.push(this.parseOptionalTypeAnnotation());
    }

    let values = [];
    if (this.match(TT.ASSIGN)) {
      values = this.parseExprList();
    }
    return Stmt.LocalAssign(names, attribs, types, values, line);
  }

  parseAttrib() {
    // <NAME> attribute: <close> or <const>
    if (this.check(TT.LT)) {
      this.advance();
      const name = this.expect(TT.NAME).value;
      this.expect(TT.GT);
      return name;
    }
    return null;
  }

  parseReturn() {
    const line = this.peek().line;
    this.expect(TT.RETURN);
    let values = [];
    // Check if there's an expression to return
    const t = this.peek();
    if (t.type !== TT.END && t.type !== TT.ELSE &&
        t.type !== TT.ELSEIF && t.type !== TT.UNTIL &&
        t.type !== TT.EOF && t.type !== TT.SEMICOLON) {
      values = this.parseExprList();
    }
    this.match(TT.SEMICOLON);
    return Stmt.Return(values, line);
  }

  parseGoto() {
    const line = this.peek().line;
    this.expect(TT.GOTO);
    const label = this.expect(TT.NAME).value;
    return Stmt.Goto(label, line);
  }

  parseLabel() {
    const line = this.peek().line;
    this.expect(TT.DOUBLECOLON);
    const name = this.expect(TT.NAME).value;
    this.expect(TT.DOUBLECOLON);
    return Stmt.Label(name, line);
  }

  parseExport() {
    const line = this.peek().line;
    this.expect(TT.EXPORT);
    // Currently only `export type` is valid in Luau
    if (this.check(TT.TYPE)) {
      return this.parseTypeAlias(true);
    }
    this.error('Expected "type" after "export"');
  }

  parseTypeAlias(exported) {
    const line = this.peek().line;
    this.expect(TT.TYPE);
    const name = this.expect(TT.NAME).value;
    // Optional generics: <T, U>
    const generics = this.parseTypeGenerics();
    this.expect(TT.ASSIGN);
    const type = this.parseType();
    return Stmt.TypeAlias(name, exported, generics, type, line);
  }

  parseExprStat() {
    const line = this.peek().line;
    const expr = this.parseSuffixedExpr();

    // Assignment?
    if (this.check(TT.ASSIGN) || this.check(TT.COMMA)) {
      const targets = [expr];
      while (this.match(TT.COMMA)) {
        targets.push(this.parseSuffixedExpr());
      }
      this.expect(TT.ASSIGN);
      const values = this.parseExprList();
      return Stmt.Assign(targets, values, line);
    }

    // Must be a call
    if (expr.type !== 'Call' && expr.type !== 'Method') {
      this.error('Syntax error: expression is not a statement');
    }
    return Stmt.ExprStmt(expr, line);
  }

  // ─── Function Body ────────────────────────────────────────────────────────

  parseFuncBody(isMethod, line) {
    // Optional Luau generics: <T, U>
    const generics = this.parseTypeGenerics();
    this.expect(TT.LPAREN);
    const { params, hasVararg, paramTypes } = this.parseParamList(isMethod);
    this.expect(TT.RPAREN);
    // Luau return type annotation
    let returnType = null;
    if (this.check(TT.COLON)) {
      this.advance();
      returnType = this.parseTypeList();
    }
    const body = this.parseBlock();
    this.expect(TT.END);
    return Expr.Function(params, hasVararg, paramTypes, returnType, body, line);
  }

  parseParamList(isMethod) {
    const params = [];
    const paramTypes = [];
    let hasVararg = false;

    if (isMethod) params.push('self');

    if (this.check(TT.RPAREN)) return { params, hasVararg, paramTypes };

    if (this.check(TT.VARARG)) {
      this.advance();
      hasVararg = true;
    } else {
      params.push(this.expect(TT.NAME).value);
      paramTypes.push(this.parseOptionalTypeAnnotation());
      while (this.match(TT.COMMA)) {
        if (this.check(TT.VARARG)) {
          this.advance();
          hasVararg = true;
          break;
        }
        params.push(this.expect(TT.NAME).value);
        paramTypes.push(this.parseOptionalTypeAnnotation());
      }
    }
    return { params, hasVararg, paramTypes };
  }

  // ─── Expressions ─────────────────────────────────────────────────────────

  parseExprList() {
    const exprs = [this.parseExpr()];
    while (this.match(TT.COMMA)) exprs.push(this.parseExpr());
    return exprs;
  }

  // expr ::= subexpr (binop subexpr)*  (Pratt parser)
  parseExpr() { return this.parseSubExpr(0); }

  // Operator precedence table
  // Returns [leftPrio, rightPrio] or null
  getBinOp(t) {
    const ops = {
      [TT.OR]:         ['or',  1,  1],
      [TT.AND]:        ['and', 2,  2],
      [TT.LT]:         ['<',   3,  3],
      [TT.GT]:         ['>',   3,  3],
      [TT.LE]:         ['<=',  3,  3],
      [TT.GE]:         ['>=',  3,  3],
      [TT.NEQ]:        ['~=',  3,  3],
      [TT.EQ]:         ['==',  3,  3],
      [TT.PIPE]:       ['|',   4,  4],
      [TT.TILDE]:      ['~',   5,  5],
      [TT.AMPERSAND]:  ['&',   6,  6],
      [TT.LSHIFT]:     ['<<',  7,  7],
      [TT.RSHIFT]:     ['>>',  7,  7],
      [TT.CONCAT]:     ['..', 10,  9],  // right-associative
      [TT.PLUS]:       ['+',  11, 11],
      [TT.MINUS]:      ['-',  11, 11],
      [TT.STAR]:       ['*',  12, 12],
      [TT.SLASH]:      ['/',  12, 12],
      [TT.DOUBLESLASH]:['//', 12, 12],
      [TT.PERCENT]:    ['%',  12, 12],
      [TT.CARET]:      ['^',  14, 13],  // right-associative
    };
    return ops[t] || null;
  }

  parseSubExpr(minPrec) {
    const line = this.peek().line;
    let left;

    // Unary
    const t = this.peek();
    if (t.type === TT.MINUS || t.type === TT.NOT ||
        t.type === TT.HASH || t.type === TT.TILDE) {
      const op = t.type === TT.MINUS ? '-' :
                 t.type === TT.NOT ? 'not' :
                 t.type === TT.HASH ? '#' : '~';
      this.advance();
      const operand = this.parseSubExpr(12); // unary prio
      left = Expr.UnOp(op, operand, line);
    } else {
      left = this.parseSimpleExpr();
    }

    // Binary
    while (true) {
      const tok = this.peek();
      const info = this.getBinOp(tok.type);
      if (!info || info[1] <= minPrec) break;
      const [op, , rightPrec] = info;
      this.advance();
      const right = this.parseSubExpr(rightPrec);
      left = Expr.BinOp(op, left, right, line);
    }
    return left;
  }

  parseSimpleExpr() {
    const t = this.peek();
    const line = t.line;
    switch (t.type) {
      case TT.NUMBER: {
        this.advance();
        return Expr.Number(parseFloat(t.value), t.value, line);
      }
      case TT.STRING: {
        this.advance();
        return Expr.String(t.value, line);
      }
      case TT.TRUE: this.advance(); return Expr.True(line);
      case TT.FALSE: this.advance(); return Expr.False(line);
      case TT.NIL: this.advance(); return Expr.Nil(line);
      case TT.VARARG: this.advance(); return Expr.Vararg(line);
      case TT.FUNCTION: {
        this.advance();
        return this.parseFuncBody(false, line);
      }
      case TT.LBRACE:
        return this.parseTableConstructor();
      default:
        return this.parseSuffixedExpr();
    }
  }

  parsePrimaryExpr() {
    const t = this.peek();
    const line = t.line;
    if (t.type === TT.NAME) {
      this.advance();
      return Expr.Name(t.value, line);
    }
    if (t.type === TT.LPAREN) {
      this.advance();
      const expr = this.parseExpr();
      this.expect(TT.RPAREN);
      // Wrap in a parenthesized node to handle multiple returns correctly
      return { type: 'Paren', expr, line };
    }
    this.error('Unexpected token in expression');
  }

  parseSuffixedExpr() {
    let expr = this.parsePrimaryExpr();
    const line = expr.line;

    while (true) {
      const t = this.peek();
      if (t.type === TT.DOT) {
        this.advance();
        const field = this.expect(TT.NAME).value;
        expr = Expr.Field(expr, field, t.line);
      } else if (t.type === TT.LBRACKET) {
        this.advance();
        const key = this.parseExpr();
        this.expect(TT.RBRACKET);
        expr = Expr.Index(expr, key, t.line);
      } else if (t.type === TT.COLON) {
        this.advance();
        const method = this.expect(TT.NAME).value;
        const args = this.parseCallArgs(t.line);
        expr = Expr.Method(expr, method, args, t.line);
      } else if (t.type === TT.LPAREN || t.type === TT.STRING ||
                 t.type === TT.LBRACE) {
        const args = this.parseCallArgs(t.line);
        expr = Expr.Call(expr, args, t.line);
      } else {
        break;
      }
    }
    return expr;
  }

  parseCallArgs(line) {
    const t = this.peek();
    if (t.type === TT.LPAREN) {
      this.advance();
      if (this.check(TT.RPAREN)) {
        this.advance();
        return [];
      }
      const args = this.parseExprList();
      this.expect(TT.RPAREN);
      return args;
    }
    if (t.type === TT.STRING) {
      this.advance();
      return [Expr.String(t.value, t.line)];
    }
    if (t.type === TT.LBRACE) {
      return [this.parseTableConstructor()];
    }
    this.error('Expected function arguments');
  }

  // ─── Table Constructor ────────────────────────────────────────────────────

  parseTableConstructor() {
    const line = this.peek().line;
    this.expect(TT.LBRACE);
    const fields = [];
    while (!this.check(TT.RBRACE) && !this.check(TT.EOF)) {
      fields.push(this.parseField());
      if (!this.match(TT.COMMA) && !this.match(TT.SEMICOLON)) break;
    }
    this.expect(TT.RBRACE);
    return Expr.Table(fields, line);
  }

  parseField() {
    const line = this.peek().line;
    // [expr] = expr
    if (this.check(TT.LBRACKET)) {
      this.advance();
      const key = this.parseExpr();
      this.expect(TT.RBRACKET);
      this.expect(TT.ASSIGN);
      const value = this.parseExpr();
      return Field.IndexedField(key, value, line);
    }
    // name = expr
    if (this.check(TT.NAME) && this.peek2().type === TT.ASSIGN) {
      const key = this.advance().value;
      this.advance(); // =
      const value = this.parseExpr();
      return Field.NamedField(key, value, line);
    }
    // expr
    return Field.ValueField(this.parseExpr(), line);
  }

  // ─── Luau Type Parsing ────────────────────────────────────────────────────

  parseOptionalTypeAnnotation() {
    if (this.check(TT.COLON)) {
      this.advance();
      return this.parseType();
    }
    return null;
  }

  parseTypeGenerics() {
    if (this.check(TT.LT)) {
      this.advance();
      const generics = [this.expect(TT.NAME).value];
      while (this.match(TT.COMMA)) generics.push(this.expect(TT.NAME).value);
      this.expect(TT.GT);
      return generics;
    }
    return [];
  }

  parseTypeList() {
    // (Type, Type, ...) or single Type
    if (this.check(TT.LPAREN)) {
      const saved = this.pos;
      this.advance();
      const types = [];
      if (!this.check(TT.RPAREN)) {
        types.push(this.parseType());
        while (this.match(TT.COMMA)) types.push(this.parseType());
      }
      if (this.check(TT.RPAREN)) {
        this.advance();
        return Type.Tuple(types, this.peek().line);
      }
      this.pos = saved;
    }
    return this.parseType();
  }

  parseType() {
    return this.parseUnionType();
  }

  parseUnionType() {
    const line = this.peek().line;
    const types = [this.parseIntersectionType()];
    while (this.check(TT.PIPE)) {
      this.advance();
      types.push(this.parseIntersectionType());
    }
    return types.length === 1 ? types[0] : Type.Union(types, line);
  }

  parseIntersectionType() {
    const line = this.peek().line;
    const types = [this.parseSimpleType()];
    while (this.check(TT.AMPERSAND)) {
      this.advance();
      types.push(this.parseSimpleType());
    }
    return types.length === 1 ? types[0] : Type.Intersection(types, line);
  }

  parseSimpleType() {
    const line = this.peek().line;
    let t = this.parsePrimaryType();
    // Optional ?
    if (this.check(TT.QUESTION)) {
      this.advance();
      t = Type.Optional(t, line);
    }
    return t;
  }

  parsePrimaryType() {
    const tok = this.peek();
    const line = tok.line;

    // typeof(expr)
    if (tok.type === TT.TYPEOF) {
      this.advance();
      this.expect(TT.LPAREN);
      const expr = this.parseExpr();
      this.expect(TT.RPAREN);
      return Type.Typeof(expr, line);
    }

    // (Type) or function type
    if (tok.type === TT.LPAREN) {
      this.advance();
      if (this.check(TT.RPAREN)) {
        this.advance();
        // () -> ReturnType
        if (this.check(TT.ARROW)) {
          this.advance();
          const ret = this.parseTypeList();
          return Type.Function([], ret, line);
        }
        return Type.Tuple([], line);
      }
      // Collect types inside parens
      const innerTypes = [this.parseType()];
      while (this.match(TT.COMMA)) innerTypes.push(this.parseType());
      this.expect(TT.RPAREN);
      if (this.check(TT.ARROW)) {
        this.advance();
        const ret = this.parseTypeList();
        return Type.Function(innerTypes, ret, line);
      }
      // Single type in parens - just return it unwrapped
      return innerTypes.length === 1 ? innerTypes[0] : Type.Tuple(innerTypes, line);
    }

    // { ... } table type
    if (tok.type === TT.LBRACE) {
      this.advance();
      const fields = [];
      let indexer = null;
      while (!this.check(TT.RBRACE) && !this.check(TT.EOF)) {
        // [Type]: Type indexer
        if (this.check(TT.LBRACKET)) {
          this.advance();
          const keyType = this.parseType();
          this.expect(TT.RBRACKET);
          this.expect(TT.COLON);
          const valType = this.parseType();
          indexer = { key: keyType, value: valType };
        } else {
          const fname = this.expect(TT.NAME).value;
          this.expect(TT.COLON);
          const ftype = this.parseType();
          fields.push({ name: fname, type: ftype });
        }
        if (!this.match(TT.COMMA) && !this.match(TT.SEMICOLON)) break;
      }
      this.expect(TT.RBRACE);
      return Type.Table(fields, indexer, line);
    }

    // Name type possibly with generics
    if (tok.type === TT.NAME || tok.type === TT.TRUE ||
        tok.type === TT.FALSE || tok.type === TT.NIL) {
      const name = this.advance().value;
      // Qualified name: A.B
      let fullName = name;
      while (this.check(TT.DOT)) {
        this.advance();
        fullName += '.' + this.expect(TT.NAME).value;
      }
      // Generics
      const generics = [];
      if (this.check(TT.LT)) {
        this.advance();
        generics.push(this.parseType());
        while (this.match(TT.COMMA)) generics.push(this.parseType());
        this.expect(TT.GT);
      }
      // Could be function type: Name -> RetType (rare but handle arrow after name)
      return Type.Name(fullName, generics, line);
    }

    // String literal type
    if (tok.type === TT.STRING) {
      this.advance();
      return Type.Literal(tok.value, line);
    }

    this.error('Expected type');
  }
}

module.exports = { Parser, ParseError };

