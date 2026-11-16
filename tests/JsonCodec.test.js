const assert = require('assert');

require('@babel/register')({
    extensions: ['.ts']
});

const JsonCodec = require('../src/widgets/JsonCodec.ts').default;

const tests = [
    ['normalizes JSON scalars', () => {
        assert.strictEqual(JsonCodec.parse('"b"').normalized, '"b"');
        assert.strictEqual(JsonCodec.parse('1e3').normalized, '1000');
        assert.strictEqual(JsonCodec.parse('true').normalized, 'true');
        assert.strictEqual(JsonCodec.parse('null').normalized, 'null');
    }],
    ['normalizes arrays and objects with four spaces', () => {
        assert.strictEqual(
            JsonCodec.parse('{"a":"b","c":3.5,"d":true}').normalized,
            '{\n    "a": "b",\n    "c": 3.5,\n    "d": true\n}'
        );
        assert.strictEqual(
            JsonCodec.parse('["a","b","c"]').normalized,
            '[\n    "a",\n    "b",\n    "c"\n]'
        );
    }],
    ['accepts an empty optional value', () => {
        const result = JsonCodec.parse('  ');
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.empty, true);
        assert.strictEqual(result.normalized, '');
    }],
    ['rejects invalid JSON, comments and trailing commas', () => {
        assert.strictEqual(JsonCodec.parse('{invalid}').valid, false);
        assert.strictEqual(JsonCodec.parse('{"a": 1 // comment\n}').valid, false);
        assert.strictEqual(JsonCodec.parse('{"a": 1,}').valid, false);
    }],
    ['rejects duplicate properties at any object depth', () => {
        const root = JsonCodec.parse('{"a":1,"a":2}');
        const nested = JsonCodec.parse('{"a":{"b":1,"b":2}}');
        assert.strictEqual(root.valid, false);
        assert.match(root.error, /Duplicate property "a"/);
        assert.strictEqual(nested.valid, false);
        assert.match(nested.error, /Duplicate property "b"/);
    }],
    ['accepts already decoded JSON values defensively', () => {
        assert.strictEqual(JsonCodec.parse(['a', 'b']).normalized, '[\n    "a",\n    "b"\n]');
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

if(failures > 0) {
    process.exitCode = 1;
}
