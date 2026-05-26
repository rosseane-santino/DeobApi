const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { deobfuscate } = require("./index");

const app = express();
const upload = multer({ dest: "uploads/" });

// file upload endpoint
app.post("/deobfuscate", upload.single("file"), async (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on", PORT));
