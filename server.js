const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

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

        const formData = new FormData();

        formData.append(
            "file",
            fs.createReadStream(req.file.path),
            req.file.originalname
        );

        const response = await fetch(
            "https://leakd-detector.up.railway.app/moonsec",
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();

        fs.unlinkSync(req.file.path);

        if (!data.success) {
            return res.status(400).json({
                success: false,
                error: data.error || "Failed to deobfuscate"
            });
        }

        let output = data.deobfuscated_code || "";

        // Remove first 2 lines
        output = output.split("\n").slice(2).join("\n");

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
