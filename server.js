const express = require("express");
const fs = require("fs");
const path = require("path");

const { deobfuscate } = require("./index");

const app = express();
app.use(express.json());

app.post("/deobfuscate", async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: "No code provided" });
        }

        const inputPath = path.join(__dirname, "input.lua");
        const outputPath = path.join(__dirname, "output.lua");

        fs.writeFileSync(inputPath, code);

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
