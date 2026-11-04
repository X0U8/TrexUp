/**
 * Custom engines that passed a test run this session, keyed by engine ID, with the code that was
 * tested. An engine counts as tested only while its code is unchanged, so any edit needs a new test.
 * Cleared on page reload; the workflow validator then asks for a fresh test.
 */
const tested = new Map();

export function markEngineTested(engineId, code) {
  tested.set(engineId, code);
}

export function isEngineTested(engineId, code) {
  return tested.get(engineId) === code;
}
