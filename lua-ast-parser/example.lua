-- Example Lua/Luau script

-- Luau type annotations
type Vector2 = {
    x: number,
    y: number,
}

export type Color = string | { r: number, g: number, b: number }

-- Local variables with types
local PI: number = 3.14159
local greeting: string = "Hello, world!"

-- Function with parameter types and return type
local function add(a: number, b: number): number
    return a + b
end

-- Table / object
local Vec2 = {}
Vec2.__index = Vec2

function Vec2.new(x: number, y: number): Vector2
    return setmetatable({ x = x, y = y }, Vec2)
end

function Vec2:length(): number
    return math.sqrt(self.x ^ 2 + self.y ^ 2)
end

function Vec2:__tostring(): string
    return string.format("Vec2(%g, %g)", self.x, self.y)
end

-- Generic for loop
local fruits = { "apple", "banana", "cherry" }
for i, fruit in ipairs(fruits) do
    print(i, fruit)
end

-- Numeric for
local sum = 0
for i = 1, 100 do
    sum = sum + i
end

-- Nested conditions
local function classify(n: number): string
    if n < 0 then
        return "negative"
    elseif n == 0 then
        return "zero"
    else
        return "positive"
    end
end

-- Repeat/until
local count = 0
repeat
    count = count + 1
until count >= 5

-- Varargs
local function sum_all(...): number
    local total = 0
    for _, v in ipairs({...}) do
        total = total + v
    end
    return total
end

-- String operations
local parts = {}
for word in greeting:gmatch("%S+") do
    table.insert(parts, word)
end

-- Anonymous functions and closures
local function make_counter(start: number)
    local n = start
    return function()
        n = n + 1
        return n
    end
end

local counter = make_counter(0)
print(counter(), counter(), counter()) -- 1, 2, 3

-- Complex table constructor
local config = {
    host = "localhost",
    port = 8080,
    routes = {
        { path = "/", handler = "index" },
        { path = "/api", handler = "api" },
    },
    [1] = "first",
    [true] = "bool_key",
}

-- Multiple assignment
local x, y, z = 1, 2, 3
x, y = y, x -- swap

-- Method chaining simulation
local Builder = {}
Builder.__index = Builder

function Builder.new()
    return setmetatable({ _parts = {} }, Builder)
end

function Builder:add(part: string)
    table.insert(self._parts, part)
    return self
end

function Builder:build(): string
    return table.concat(self._parts, " ")
end

print(Builder.new():add("Hello"):add("from"):add("Lua!"):build())

