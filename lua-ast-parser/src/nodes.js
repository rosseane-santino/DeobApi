function node(type, fields) {
  return Object.assign({ type }, fields);
}

// ─── Statements ──────────────────────────────────────────────────────────────

const Stmt = {
  Block: (body, line) => node('Block', { body, line }),
  Assign: (targets, values, line) => node('Assign', { targets, values, line }),
  LocalAssign: (names, attribs, types, values, line) => node('LocalAssign', { names, attribs, types, values, line }),
  Do: (body, line) => node('Do', { body, line }),
  While: (condition, body, line) => node('While', { condition, body, line }),
  Repeat: (body, condition, line) => node('Repeat', { body, condition, line }),
  If: (clauses, elseBody, line) => node('If', { clauses, elseBody, line }),
  ForNum: (name, start, limit, step, body, line) => node('ForNum', { name, start, limit, step, body, line }),
  ForIn: (names, iterators, body, line) => node('ForIn', { names, iterators, body, line }),
  FunctionDecl: (name, func, line) => node('FunctionDecl', { name, func, line }),
  LocalFunction: (name, func, line) => node('LocalFunction', { name, func, line }),
  Return: (values, line) => node('Return', { values, line }),
  Break: (line) => node('Break', { line }),
  Continue: (line) => node('Continue', { line }),  // Luau
  Goto: (label, line) => node('Goto', { label, line }),
  Label: (name, line) => node('Label', { name, line }),
  ExprStmt: (expr, line) => node('ExprStmt', { expr, line }),
  // Luau
  TypeAlias: (name, exported, generics, typeNode, line) => node('TypeAlias', { name, exported, generics, typeNode, line }),
};

// ─── Expressions ─────────────────────────────────────────────────────────────

const Expr = {
  Nil: (line) => node('Nil', { line }),
  True: (line) => node('True', { line }),
  False: (line) => node('False', { line }),
  Number: (value, raw, line) => node('Number', { value, raw, line }),
  String: (value, line) => node('String', { value, line }),
  Vararg: (line) => node('Vararg', { line }),
  Name: (name, line) => node('Name', { name, line }),
  Index: (object, key, line) => node('Index', { object, key, line }),
  Field: (object, field, line) => node('Field', { object, field, line }),
  Method: (object, method, args, line) => node('Method', { object, method, args, line }),
  Call: (callee, args, line) => node('Call', { callee, args, line }),
  BinOp: (op, left, right, line) => node('BinOp', { op, left, right, line }),
  UnOp: (op, operand, line) => node('UnOp', { op, operand, line }),
  Function: (params, hasVararg, paramTypes, returnType, body, line) =>
    node('Function', { params, hasVararg, paramTypes, returnType, body, line }),
  Table: (fields, line) => node('Table', { fields, line }),
};

// ─── Table Fields ─────────────────────────────────────────────────────────────

const Field = {
  IndexedField: (key, value, line) => node('IndexedField', { key, value, line }),
  NamedField: (key, value, line) => node('NamedField', { key, value, line }),
  ValueField: (value, line) => node('ValueField', { value, line }),
};

// ─── Luau Type Nodes ─────────────────────────────────────────────────────────

const Type = {
  Name: (name, generics, line) => node('TypeName', { name, generics, line }),
  Optional: (inner, line) => node('TypeOptional', { inner, line }),
  Union: (types, line) => node('TypeUnion', { types, line }),
  Intersection: (types, line) => node('TypeIntersection', { types, line }),
  Array: (element, line) => node('TypeArray', { element, line }),
  Table: (fields, indexer, line) => node('TypeTable', { fields, indexer, line }),
  Function: (params, returnTypes, line) => node('TypeFunction', { params, returnTypes, line }),
  Tuple: (types, line) => node('TypeTuple', { types, line }),
  Typeof: (expr, line) => node('TypeTypeof', { expr, line }),
  Literal: (value, line) => node('TypeLiteral', { value, line }),
};

module.exports = { Stmt, Expr, Field, Type };

