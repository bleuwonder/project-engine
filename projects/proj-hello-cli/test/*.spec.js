const test = require('node:test');
const assert = require('node:assert/strict');

let greetingFn;

// Try to load the greeting function from common likely module paths.
// This keeps the tests resilient to minor project structure differences.
for (const modPath of ['../src', '../index', '../app', '../greeting']) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(modPath);
    if (typeof mod === 'function') {
      greetingFn = mod;
      break;
    }
    if (mod && typeof mod.greet === 'function') {
      greetingFn = mod.greet;
      break;
    }
    if (mod && typeof mod.getGreeting === 'function') {
      greetingFn = mod.getGreeting;
      break;
    }
    if (mod && mod.default && typeof mod.default === 'function') {
      greetingFn = mod.default;
      break;
    }
  } catch (_) {
    // Ignore unresolved paths and continue probing.
  }
}

test('exports a greeting function', () => {
  assert.equal(typeof greetingFn, 'function');
});

test('returns "Hello, World!" when called without a name', () => {
  assert.equal(greetingFn(), 'Hello, World!');
});

test('returns a personalized greeting when a name is provided', () => {
  assert.equal(greetingFn('Alice'), 'Hello, Alice!');
});

test('trims surrounding whitespace in provided name', () => {
  assert.equal(greetingFn('  Bob  '), 'Hello, Bob!');
});