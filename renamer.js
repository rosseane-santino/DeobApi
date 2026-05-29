const fs = require("fs");

const serviceMap = JSON.parse(
    fs.readFileSync("./services.json", "utf8")
);

// reserved keywords + services
const reserved = new Set([
    "game","workspace","script","math","string","table","task",
    "Vector3","Vector2","UDim2","Color3","CFrame","Enum",
    "Instance","pairs","ipairs","next","wait","print",
    "warn","error","require","typeof","setmetatable",
    "getmetatable","rawget","rawset","tonumber","tostring"
]);

for (const k of Object.keys(serviceMap)) {
    reserved.add(k);
}

// mapping old -> new
const map = new Map();

// counters
let i = 0;
function gen() {
    return `v${i++}`;
}

// collect ALL local variables (most important fix)
function collectLocals(code) {
    const matches = [...code.matchAll(/local\s+([A-Za-z_][A-Za-z0-9_]*)/g)];
    for (const m of matches) {
        const name = m[1];
        if (!reserved.has(name) && !map.has(name)) {
            map.set(name, gen());
        }
    }
}

// special Instance.new tracking (optional better naming)
function collectInstances(code) {
    const matches = [...code.matchAll(
        /local\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*Instance\.new\("([^"]+)"\)/g
    )];

    for (const m of matches) {
        const name = m[1];
        const className = m[2];

        if (reserved.has(name)) continue;

        let prefix = "obj";

        if (className === "ScreenGui") prefix = "gui";
        else if (className === "Frame") prefix = "frame";
        else if (className === "TextButton") prefix = "btn";
        else if (className === "TextLabel") prefix = "lbl";

        map.set(name, `${prefix}_${gen()}`);
    }
}

// LocalPlayer handling
function collectPlayers(code) {
    const matches = [...code.matchAll(
        /local\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*game:GetService\("Players"\)\.LocalPlayer/g
    )];

    for (const m of matches) {
        map.set(m[1], `player_${gen()}`);
    }
}

// apply rename safely
function apply(code) {
    for (const [oldName, newName] of map.entries()) {
        code = code.replace(
            new RegExp(`\\b${oldName}\\b`, "g"),
            newName
        );
    }
    return code;
}

// main
function renameCode(code) {
    let out = code;

    collectInstances(out);
    collectPlayers(out);
    collectLocals(out); // IMPORTANT: must be last collection pass

    out = apply(out);

    return out;
}

module.exports = { renameCode };
