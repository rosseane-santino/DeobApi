const fs   = require('fs');
const path = require('path');

function extractPayload(src) {
  const m = src.match(/VMCall\("(LOL![^"]+)"/);
  if (!m) throw new Error('VMCall payload not found.');
  return m[1];
}

function decodePayload(payload) {
  const hex = payload.slice(4);
  const out = [];
  let rep = null;
  for (let i = 0; i < hex.length - 1; i += 2) {
    const a = hex[i], b = hex[i + 1];
    if (b === 'Q') { rep = parseInt(a, 10); continue; }
    const byte = parseInt(a + b, 16);
    if (rep !== null) { for (let r = 0; r < rep; r++) out.push(byte); rep = null; }
    else out.push(byte);
  }
  return Buffer.from(out);
}

class Reader {
  constructor(buf) { this.b = buf; this.p = 0; }
  u8()  { return this.b[this.p++]; }
  u16() { const a = this.u8(), b = this.u8(); return (b << 8) | a; }
  u32() { const a=this.u8(),b=this.u8(),c=this.u8(),d=this.u8();
          return ((d*0x1000000)+(c<<16)+(b<<8)+a)>>>0; }
  f64() { const v = this.b.readDoubleLE(this.p); this.p += 8; return v; }
  str() { const l = this.u32(); if (!l) return '';
          const s = this.b.slice(this.p, this.p+l).toString('utf8'); this.p += l; return s; }
}

function gBit(n, lo, hi) {
  if (hi !== undefined) return (Math.floor(n / 2**(lo-1)) % 2**(hi-lo+1))|0;
  const p = 2**(lo-1); return ((n%(p*2)) >= p) ? 1 : 0;
}

function parseChunk(r) {
  const consts = [];
  for (let i = 0, cc = r.u32(); i < cc; i++) {
    const t = r.u8();
    if      (t===1) consts.push({t:'bool',   v: r.u8()!==0});
    else if (t===2) consts.push({t:'number', v: r.f64()});
    else if (t===3) consts.push({t:'string', v: r.str()});
    else            consts.push(null);
  }

  const paramCount = r.u8();
  const instrs = [];
  for (let i = 0, ic = r.u32(); i < ic; i++) {
    const desc = r.u8();
    const isPseudo = gBit(desc,1,1) === 1;
    const itype = gBit(desc,2,3), mask = gBit(desc,4,6);
    const op = r.u16(), rB = r.u16();
    let rC = null, rD = null;

    if      (itype===0) { rC=r.u16(); rD=r.u16(); }
    else if (itype===1) { rC=r.u32(); }
    else if (itype===2) { rC=r.u32()-0x10000; }
    else if (itype===3) { rC=r.u32()-0x10000; rD=r.u16(); }

    const res = v => (v!==null && v>=0 && v<consts.length) ? consts[v] : v;
    const B = (!isPseudo && gBit(mask,1,1)) ? res(rB) : rB;
    const C = (!isPseudo && gBit(mask,2,2)) ? res(rC) : rC;
    const D = (!isPseudo && gBit(mask,3,3)) ? res(rD) : rD;

    instrs.push({ op, B, C, D, rB, rC, rD, isPseudo });
  }

  const funcs = [];
  for (let i = 0, fc = r.u32(); i < fc; i++) funcs.push(parseChunk(r));
  return { consts, paramCount, instrs, funcs };
}

const isCO  = v => v !== null && typeof v === 'object' && v.t !== undefined;
const strOf = v => (isCO(v) && v.t === 'string') ? v.v : null;
const isNum = v => typeof v === 'number';

function litVal(v) {
  if (v === null || v === undefined) return 'nil';
  if (isCO(v)) {
    if (v.t==='string')  return JSON.stringify(v.v);
    if (v.t==='bool')    return v.v ? 'true' : 'false';
    if (v.t==='number') {
      if (!Number.isFinite(v.v)) return v.v > 0 ? 'math.huge' : '-math.huge';
      return String(v.v);
    }
    return 'nil';
  }
  return String(v);
}

function fKey(v) {
  const s = strOf(v);
  if (s && /^[A-Za-z_]\w*$/.test(s)) return '.' + s;
  return '[' + litVal(v) + ']';
}

const fVal = (v, rn) => isCO(v) ? litVal(v) : (isNum(v) ? rn(v) : 'nil');

function emitChunk(chunk, name, uvMap, depth, out) {
  const pad = d => '  '.repeat(d);

  const subUvMaps = chunk.funcs.map(() => []);

  const subNames = chunk.funcs.map((_, i) => (name || 'chunk') + '_f' + i);
  for (let i = 0; i < chunk.funcs.length; i++) {
    emitChunk(chunk.funcs[i], subNames[i], subUvMaps[i], depth, out);
    out.push('');
  }

  const params = Array.from({length: chunk.paramCount}, (_, i) => 'p' + i);

  if (name) out.push(pad(depth) + `local function ${name}(${params.join(', ')})`);

  const D = depth + (name ? 1 : 0);
  const line = s => out.push(pad(D) + s);
  const rn = n => 'v' + n;

  for (const inst of chunk.instrs) {
    if (!inst || inst.isPseudo) continue;

    const { op, rB, rC } = inst;
    const dest = rB;

    switch (op) {
      case 30: case 94:
        line(`${rn(dest)} = ${litVal(inst.C)}`); break;

      case 54: case 125:
        line(`${rn(dest)} = ${rn(rC)}`); break;

      case 2:
        line(`${rn(dest)} = {}`); break;

      case 63: case 116:
        line(`${rn(dest)} = ${rn(rC)} + ${rn(inst.rD)}`); break;

      case 56: case 110:
        line(`return ${rn(dest)}`); break;

      case 67:
        line(`return`); break;

      default:
        line(`-- op ${op}`);
    }
  }

  if (name) out.push(pad(depth) + 'end');
}

async function luaObfDeobfuscate(source) {
  const payload = extractPayload(source);
  const bytecode = decodePayload(payload);
  const reader = new Reader(bytecode);
  const root = parseChunk(reader);

  const lines = ['-- deobf', ''];
  emitChunk(root, null, [], 0, lines);
  return lines.join('\\n');
}

module.exports = { luaObfDeobfuscate };

if (require.main === module) {
  const [,, inputArg, outputArg] = process.argv;
  if (!inputArg) throw new Error("missing input");

  const src = fs.readFileSync(path.resolve(inputArg), "utf8");

  luaObfDeobfuscate(src).then(out => {
    if (outputArg) fs.writeFileSync(outputArg, out);
    else process.stdout.write(out);
  });
      }
