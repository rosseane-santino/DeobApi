const express = require("express");  
const fs = require("fs");  
const path = require("path");  
const multer = require("multer");  
const { renameCode } = require("./renamer");  
const { parseLuaSource } = require("./lua-ast-parser/cli.js");
const { luaObfDeobfuscate } = require("./luaobf");
  
const { deobfuscate } = require("./index");  
const { deobfuscateFile } = require("./white/cli/run");  
  
const app = express();  
const upload = multer({ dest: "uploads/" });  
  
  
// -------------------- /deobf1 --------------------  
app.post("/deobf1", upload.single("file"), async (req, res) => {  
    try {  
        if (!req.file) {  
            return res.status(400).json({ error: "No file uploaded" });  
        }  
  
        const inputPath = req.file.path;  
        const outputPath = path.join(__dirname, "output.lua");  
  
        await deobfuscate(inputPath, outputPath);  
  
        const result = fs.readFileSync(outputPath, "utf8");  
  
        fs.unlinkSync(inputPath);  
        fs.unlinkSync(outputPath);  
  
        res.json({  
            success: true,  
            output: result  
        });  
  
    } catch (err) {  
        res.status(500).json({  
            success: false,  
            error: err.message  
        });  
    }  
});  
  
  
// -------------------- /deobf2 (CLEAN API VERSION) --------------------  
app.post("/deobf2", upload.single("file"), async (req, res) => {  
    try {  
        if (!req.file) {  
            return res.status(400).json({ error: "No file uploaded" });  
        }  
  
        const inputPath = req.file.path;  
        const outputPath = path.join(__dirname, "output.lua");  
  
        const result = await deobfuscateFile(inputPath, outputPath, {  
            debug: false  
        });  
  
        fs.unlinkSync(inputPath);  
        fs.unlinkSync(outputPath);  
  
        res.json({  
            success: true,  
            output: result.output  
        });  
  
    } catch (err) {  
        res.status(500).json({  
            success: false,  
            error: err.message  
        });  
    }  
});  
  
  
// -------------------- /moon --------------------  
app.post("/moon", upload.single("file"), async (req, res) => {  
    try {  
        if (!req.file) {  
            return res.status(400).json({  
                success: false,  
                error: "No file uploaded"  
            });  
        }  
  
        // Create temp file with .lua extension  
        const tempLuaPath = path.join(  
            __dirname,  
            `temp_${Date.now()}.lua`  
        );  
  
        fs.copyFileSync(req.file.path, tempLuaPath);  
  
        const fileBuffer = fs.readFileSync(tempLuaPath);  
  
        const blob = new Blob([fileBuffer]);  
  
        const formData = new FormData();  
  
        formData.append(  
            "file",  
            blob,  
            "script.lua"  
        );  
  
        const response = await fetch(  
            "https://leakd-detector.up.railway.app/moonsec",  
            {  
                method: "POST",  
                body: formData  
            }  
        );  
  
        const data = await response.json();  
  
        // Cleanup  
        fs.unlinkSync(req.file.path);  
        fs.unlinkSync(tempLuaPath);  
  
        if (!data.success) {  
            return res.status(400).json({  
                success: false,  
                error: data.error || "Failed to deobfuscate"  
            });  
        }  
  
        let output = data.deobfuscated_code || "";  
  
        // Remove first 2 lines  
        output = output  
            .split("\n")  
            .slice(2)  
            .join("\n");  
  
        res.json({  
            success: true,  
            output  
        });  
  
    } catch (err) {  
        res.status(500).json({  
            success: false,  
            error: err.message  
        });  
    }  
});  
  
// -------------------- /ib2 --------------------  
app.post("/ib2", upload.single("file"), async (req, res) => {  
    try {  
        if (!req.file) {  
            return res.status(400).json({  
                success: false,  
                error: "No file uploaded"  
            });  
        }  
  
        // Create temp .lua file  
        const tempLuaPath = path.join(  
            __dirname,  
            `temp_${Date.now()}.lua`  
        );  
  
        fs.copyFileSync(req.file.path, tempLuaPath);  
  
        const fileBuffer = fs.readFileSync(tempLuaPath);  
  
        const blob = new Blob([fileBuffer]);  
  
        const formData = new FormData();  
  
        formData.append(  
            "file",  
            blob,  
            "script.lua"  
        );  
  
        const response = await fetch(  
            "https://leakd-detector.up.railway.app/ironbrew2",  
            {  
                method: "POST",  
                body: formData  
            }  
        );  
  
        const data = await response.json();  
  
        // Cleanup  
        fs.unlinkSync(req.file.path);  
        fs.unlinkSync(tempLuaPath);  
  
        if (!data.success) {  
            return res.status(400).json({  
                success: false,  
                error: data.error || "Failed to deobfuscate"  
            });  
        }  
  
        let output = data.deobfuscated_code || "";  
  
        // Remove first 2 lines  
        output = output  
            .split("\n")  
            .slice(2)  
            .join("\n");  
  
        res.json({  
            success: true,  
            output  
        });  
  
    } catch (err) {  
        res.status(500).json({  
            success: false,  
            error: err.message  
        });  
    }  
});  
  
// -------------------- /rename --------------------
app.post("/rename", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const code = fs.readFileSync(req.file.path, "utf8");
        fs.unlinkSync(req.file.path);

        function splitTopLevel(str) {
            const parts = [];
            let cur = "";
            let depth = 0;
            let quote = null;
            let escaped = false;

            for (let i = 0; i < str.length; i++) {
                const ch = str[i];

                if (quote) {
                    cur += ch;
                    if (escaped) {
                        escaped = false;
                    } else if (ch === "\\") {
                        escaped = true;
                    } else if (ch === quote) {
                        quote = null;
                    }
                    continue;
                }

                if (ch === '"' || ch === "'") {
                    quote = ch;
                    cur += ch;
                    continue;
                }

                if (ch === "(" || ch === "[" || ch === "{") {
                    depth++;
                    cur += ch;
                    continue;
                }

                if (ch === ")" || ch === "]" || ch === "}") {
                    depth = Math.max(0, depth - 1);
                    cur += ch;
                    continue;
                }

                if (ch === "," && depth === 0) {
                    parts.push(cur.trim());
                    cur = "";
                    continue;
                }

                cur += ch;
            }

            if (cur.trim() !== "" || str.trim() === "") parts.push(cur.trim());
            return parts;
        }

        function rewriteText(text, map) {
            let out = "";
            let i = 0;
            let quote = null;
            let escaped = false;

            while (i < text.length) {
                const ch = text[i];
                const next = text[i + 1];

                if (!quote && ch === "-" && next === "-") {
                    out += text.slice(i);
                    break;
                }

                if (quote) {
                    out += ch;
                    if (escaped) {
                        escaped = false;
                    } else if (ch === "\\") {
                        escaped = true;
                    } else if (ch === quote) {
                        quote = null;
                    }
                    i++;
                    continue;
                }

                if (ch === '"' || ch === "'") {
                    quote = ch;
                    out += ch;
                    i++;
                    continue;
                }

                if (/[A-Za-z_]/.test(ch)) {
                    let j = i + 1;
                    while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j++;
                    const id = text.slice(i, j);
                    out += map[id] || id;
                    i = j;
                    continue;
                }

                out += ch;
                i++;
            }

            return out;
        }

        function directCanonical(expr) {
            const s = expr.trim();

            const service = s.match(/^game:GetService\(["']([^"']+)["']\)$/);
            if (service) return service[1];

            const inst = s.match(/^Instance\.new\(["']([^"']+)["']\)$/);
            if (inst) return inst[1];

            const prop = s.match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\.([A-Z][A-Za-z0-9_]*)$/);
            if (prop) return prop[2];

            return null;
        }

        const localLine = /^(\s*)local\s+(.+?)\s*=\s*(.+)$/;

        const directMap = {};
        const aliasLink = {};

        const lines = code.split(/\r?\n/);

        for (const line of lines) {
            const m = line.match(localLine);
            if (!m) continue;

            const lhsList = splitTopLevel(m[2]);
            const rhsList = splitTopLevel(m[3]);

            if (lhsList.length !== rhsList.length) continue;

            for (let i = 0; i < lhsList.length; i++) {
                const lhs = lhsList[i].trim();
                const rhs = rhsList[i].trim();

                const canon = directCanonical(rhs);
                if (canon) {
                    directMap[lhs] = canon;
                    continue;
                }

                const bare = rhs.match(/^([A-Za-z_]\w*)$/);
                if (bare) {
                    aliasLink[lhs] = bare[1];
                }
            }
        }

        function resolve(name, seen = new Set()) {
            if (directMap[name]) return directMap[name];
            if (seen.has(name)) return null;
            seen.add(name);
            if (aliasLink[name]) return resolve(aliasLink[name], seen);
            return null;
        }

        const finalMap = {};
        for (const name of new Set([...Object.keys(directMap), ...Object.keys(aliasLink)])) {
            const v = resolve(name);
            if (v) finalMap[name] = v;
        }

        const outLines = lines.map((line) => {
            const m = line.match(localLine);
            if (!m) return rewriteText(line, finalMap);

            const indent = m[1];
            const lhsList = splitTopLevel(m[2]);
            const rhsList = splitTopLevel(m[3]);

            if (lhsList.length !== rhsList.length) {
                return rewriteText(line, finalMap);
            }

            const newLhs = [];
            const newRhs = [];

            for (let i = 0; i < lhsList.length; i++) {
                const lhs = lhsList[i].trim();
                const rhs = rhsList[i].trim();

                newLhs.push(directMap[lhs] || lhs);
                newRhs.push(rewriteText(rhs, finalMap));
            }

            return `${indent}local ${newLhs.join(", ")} = ${newRhs.join(", ")}`;
        });

        const output = outLines.join("\n");

        res.json({
            success: true,
            output
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// -------------------- /obf --------------------
app.post("/obf", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No file uploaded"
            });
        }

        const tempLuaPath = path.join(
            __dirname,
            `temp_${Date.now()}.lua`
        );

        fs.copyFileSync(req.file.path, tempLuaPath);

        const fileBuffer = fs.readFileSync(tempLuaPath);

        const blob = new Blob([fileBuffer]);

        const formData = new FormData();

        formData.append(
            "file",
            blob,
            "script.lua"
        );

        const response = await fetch(
            "https://leakd-detector.up.railway.app/obfuscate?mode=Tamp2",
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();

        fs.unlinkSync(req.file.path);
        fs.unlinkSync(tempLuaPath);

        if (!data.success) {
            return res.status(400).json({
                success: false,
                error: data.error || "Failed to obfuscate"
            });
        }

        let output = data.obfuscated_code || "";

        output = output
            .split("\n")
            .slice(1)
            .join("\n");

        res.json({
            success: true,
            output
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// -------------------- /ast --------------------
app.post("/ast", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No file uploaded"
            });
        }

        const code = fs.readFileSync(req.file.path, "utf8");

        fs.unlinkSync(req.file.path);

        const output = parseLuaSource(
            code,
            req.file.originalname || "script.lua",
            true // include tokens
        );

        return res.json({
            success: true,
            output
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.post("/deobf3", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No file uploaded"
            });
        }

        const code = fs.readFileSync(req.file.path, "utf8");

        fs.unlinkSync(req.file.path);

        const output = await luaObfDeobfuscate(code);

        res.json({
            success: true,
            output
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

const PORT = process.env.PORT || 3000;  
app.listen(PORT, () => console.log("Running on", PORT));
