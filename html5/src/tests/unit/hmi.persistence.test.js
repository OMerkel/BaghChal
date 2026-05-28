import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Settings persistence tests for hmi.js
 * Verifies that localStorage persistence functions are implemented and exported.
 */

describe('Settings persistence (localStorage)', () => {
  it('hmi.js exports saveSettingsToStorage function', () => {
    const __filename = fileURLToPath(import.meta.url);
    const hmiPath = path.join(path.dirname(__filename), '../../js/hmi.js');
    const hmiContent = readFileSync(hmiPath, 'utf8');

    // Verify functions are defined
    expect(hmiContent).toContain('const saveSettingsToStorage = ()');
    expect(hmiContent).toContain('localStorage.setItem(STORAGE_KEY');
    expect(hmiContent).toContain('export { saveSettingsToStorage');
  });

  it('hmi.js exports restoreSettingsFromStorage function', () => {
    const __filename = fileURLToPath(import.meta.url);
    const hmiPath = path.join(path.dirname(__filename), '../../js/hmi.js');
    const hmiContent = readFileSync(hmiPath, 'utf8');

    // Verify functions are defined
    expect(hmiContent).toContain('const restoreSettingsFromStorage = ()');
    expect(hmiContent).toContain('localStorage.getItem(STORAGE_KEY)');
    expect(hmiContent).toContain('export { saveSettingsToStorage, restoreSettingsFromStorage }');
  });

  it('saveSettingsToStorage has error handling for storage failures', () => {
    const __filename = fileURLToPath(import.meta.url);
    const hmiPath = path.join(path.dirname(__filename), '../../js/hmi.js');
    const hmiContent = readFileSync(hmiPath, 'utf8');

    // Verify try-catch block exists
    expect(hmiContent).toContain('catch (error)');
    expect(hmiContent).toContain('console.warn');
  });

  it('restoreSettingsFromStorage has error handling for JSON corruption', () => {
    const __filename = fileURLToPath(import.meta.url);
    const hmiPath = path.join(path.dirname(__filename), '../../js/hmi.js');
    const hmiContent = readFileSync(hmiPath, 'utf8');

    // Verify try-catch block and JSON.parse
    expect(hmiContent).toContain('JSON.parse(stored)');
    expect(hmiContent).toContain('catch (error)');
  });

  it('settings are saved when form inputs change', () => {
    const __filename = fileURLToPath(import.meta.url);
    const hmiPath = path.join(path.dirname(__filename), '../../js/hmi.js');
    const hmiContent = readFileSync(hmiPath, 'utf8');

    // Verify event listeners call saveSettingsToStorage
    expect(hmiContent).toContain("input.addEventListener('change'");
    expect(hmiContent).toContain('saveSettingsToStorage()');
  });

  it('settings are restored from localStorage on page load', () => {
    const __filename = fileURLToPath(import.meta.url);
    const hmiPath = path.join(path.dirname(__filename), '../../js/hmi.js');
    const hmiContent = readFileSync(hmiPath, 'utf8');

    // Verify settings restoration is called in wireUI
    expect(hmiContent).toContain('restoreSettingsFromStorage()');
  });

  it('localStorage key is used consistently', () => {
    const __filename = fileURLToPath(import.meta.url);
    const hmiPath = path.join(path.dirname(__filename), '../../js/hmi.js');
    const hmiContent = readFileSync(hmiPath, 'utf8');

    // Verify STORAGE_KEY constant is defined
    expect(hmiContent).toContain("const STORAGE_KEY = 'baghchal_user_settings'");
    expect(hmiContent).toContain('localStorage.getItem(STORAGE_KEY)');
    expect(hmiContent).toContain('localStorage.setItem(STORAGE_KEY');
  });

  it('game variant is fixed to Bagh Chal in settings flow', () => {
    const __filename = fileURLToPath(import.meta.url);
    const hmiPath = path.join(path.dirname(__filename), '../../js/hmi.js');
    const hmiContent = readFileSync(hmiPath, 'utf8');

    expect(hmiContent).toContain("gamevariant: 'Bagh Chal'");
    expect(hmiContent).toContain("gameVariant: 'Bagh Chal'");
  });
});
