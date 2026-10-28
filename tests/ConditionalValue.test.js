const assert = require('assert');

require('@babel/register')({
    extensions: ['.ts']
});

const { evaluateConditionalValue } = require('../src/ConditionalValue.ts');

const originalDebug = console.debug;
const originalWarn = console.warn;
console.debug = () => {};
console.warn = () => {};

const tests = [
    ['returns boolean values unchanged', () => {
        assert.strictEqual(evaluateConditionalValue(true, {}), true);
        assert.strictEqual(evaluateConditionalValue(false, {}), false);
    }],
    ['supports serialized boolean values', () => {
        assert.strictEqual(evaluateConditionalValue('true', {}), true);
        assert.strictEqual(evaluateConditionalValue('false', {}), false);
    }],
    ['keeps the current default for empty values', () => {
        assert.strictEqual(evaluateConditionalValue('', {}), true);
        assert.strictEqual(evaluateConditionalValue([], {}), true);
    }],
    ['evaluates an array domain against the object', () => {
        const condition = [['object.state', '=', 'draft']];
        assert.strictEqual(evaluateConditionalValue(condition, {state: 'draft'}), true);
        assert.strictEqual(evaluateConditionalValue(condition, {state: 'published'}), false);
    }],
    ['evaluates a serialized domain', () => {
        const condition = JSON.stringify([['object.state', '=', 'draft']]);
        assert.strictEqual(evaluateConditionalValue(condition, {state: 'draft'}), true);
        assert.strictEqual(evaluateConditionalValue(condition, {state: 'published'}), false);
    }],
    ['evaluates a readonly domain with a false fallback', () => {
        const condition = [['object.state', '!=', 'draft']];
        assert.strictEqual(evaluateConditionalValue(condition, {state: 'published'}, {}, {}, {}, false), true);
        assert.strictEqual(evaluateConditionalValue(condition, {state: 'draft'}, {}, {}, {}, false), false);
    }],
    ['passes user, parent and environment contexts to domains', () => {
        assert.strictEqual(evaluateConditionalValue([['object.owner_id', '=', 'user.id']], {owner_id: 7}, {id: 7}), true);
        assert.strictEqual(evaluateConditionalValue([['object.state', '=', 'parent.state']], {state: 'open'}, {}, {state: 'open'}), true);
        assert.strictEqual(evaluateConditionalValue([['object.mode', '=', 'env.mode']], {mode: 'test'}, {}, {}, {mode: 'test'}), true);
    }],
    ['uses the fallback for invalid conditional values', () => {
        assert.strictEqual(evaluateConditionalValue('{invalid json', {}), true);
        assert.strictEqual(evaluateConditionalValue('{invalid json', {}, {}, {}, {}, false), false);
    }]
];

let failures = 0;

for(const [name, test] of tests) {
    try {
        test();
        process.stdout.write(`\u2713 ${name}\n`);
    }
    catch(error) {
        failures++;
        process.stderr.write(`\u2717 ${name}\n${error.stack}\n`);
    }
}

console.debug = originalDebug;
console.warn = originalWarn;

if(failures > 0) {
    process.exitCode = 1;
}
