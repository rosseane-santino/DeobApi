const fs = require("fs");

// load services.json
const serviceMap = JSON.parse(
    fs.readFileSync("./services.json", "utf8")
);

// normalize weird GetService({game,"X"})
function normalizeGetService(code) {
    return code.replace(
        /game:GetService\(\s*\{[^,]+,\s*["']([^"']+)["']\s*\}\s*\)/g,
        'game:GetService("$1")'
    );
}

// standard GetService cleanup
function standardizeGetService(code) {
    return code.replace(
        /game:GetService\(\s*["']([^"']+)["']\s*\)/g,
        (m, name) => `game:GetService("${name}")`
    );
}

// inject locals from used services
function injectServiceVars(code) {
    const found = [...code.matchAll(/game:GetService\("([^"]+)"\)/g)];

    const used = [...new Set(found.map(m => m[1]))];

    let header = "";

    for (const s of used) {
        header += `local ${s} = game:GetService("${s}")\n`;
    }

    return header + "\n" + code;
}

// fix FindFirstChild noise
function cleanFindFirstChild(code) {
    return code.replace(
        /:FindFirstChild\([^,]+,\s*([^)]+)\)/g,
        ":FindFirstChild($1)"
    );
}

// fix WaitForChild noise
function cleanWaitForChild(code) {
    return code.replace(
        /:WaitForChild\([^,]+,\s*([^)]+)\)/g,
        ":WaitForChild($1)"
    );
}

// remove duplicate Service spam lines
function removeDuplicateServiceVars(code) {
    const seen = new Set();

    return code
        .split("\n")
        .filter(line => {
            if (line.includes("game:GetService")) {
                if (seen.has(line)) return false;
                seen.add(line);
            }
            return true;
        })
        .join("\n");
}

// rename junk variables like add_123 → tab_1
function renameVariables(code) {
    let i = 1;

    return code.replace(
        /\badd_\d+\b/g,
        () => `tab_${i++}`
    );
}

// MAIN PIPELINE
function renameCode(code) {
    let out = code;

    out = normalizeGetService(out);
    out = standardizeGetService(out);

    out = cleanFindFirstChild(out);
    out = cleanWaitForChild(out);

    out = removeDuplicateServiceVars(out);

    out = injectServiceVars(out);

    out = renameVariables(out);

    return out;
}

module.exports = { renameCode };
