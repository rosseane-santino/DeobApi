const express = require("express");  
const fs = require("fs");  
const path = require("path");  
const multer = require("multer");  
const { renameCode } = require("./renamer");  
const { parseLuaSource } = require("./lua-ast-parser/cli.js");
  
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
            return res.status(400).send("No file uploaded");  
        }  
  
        const code = fs.readFileSync(req.file.path, "utf8");  
  
        fs.unlinkSync(req.file.path);  
  
        const prompt =  
            "fully rename the vars and dont add coments to the code and dont comment on it yourself (and dont just give me half of thr code i want full code) here: " +  
            encodeURIComponent(code);  
  
        const url = `https://text.pollinations.ai/${prompt}?model=openai`;  
  
        const response = await fetch(url);  
        const result = await response.text();  
  
res.json({
    success: true,
    output: result
});
  
    } catch (err) {  
        res.status(500).send(err.message);  
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
  
const PORT = process.env.PORT || 3000;  
app.listen(PORT, () => console.log("Running on", PORT));
