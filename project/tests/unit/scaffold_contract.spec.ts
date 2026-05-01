import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repo = path.resolve(__dirname, '..', '..', '..');

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(repo, relativePath), 'utf8')) as Record<string, unknown>;
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(repo, relativePath));
}

describe('scaffold contract — package.json scripts', () => {
  const pkg = readJson('package.json');
  const scripts = pkg['scripts'] as Record<string, string>;

  it('test script runs legacy test runner', () => {
    expect(scripts['test']).toBe('vitest run');
  });

  it('dev script uses vite', () => {
    expect(scripts['dev']).toContain('vite');
  });

  it('tauri:dev script uses tauri', () => {
    expect(scripts['tauri:dev']).toContain('tauri');
  });
});

describe('scaffold contract — required files exist', () => {
  it('index.html exists', () => expect(exists('index.html')).toBe(true));
  it('vite.config.ts exists', () => expect(exists('vite.config.ts')).toBe(true));
  it('tsconfig.json exists', () => expect(exists('tsconfig.json')).toBe(true));
  it('project/src/app/App.tsx exists', () => expect(exists('project/src/app/App.tsx')).toBe(true));
  it('project/src/bridge/schemas.ts exists', () => expect(exists('project/src/bridge/schemas.ts')).toBe(true));
  it('project/src-tauri/tauri.conf.json exists', () => expect(exists('project/src-tauri/tauri.conf.json')).toBe(true));
  it('project/src-tauri/Cargo.toml exists', () => expect(exists('project/src-tauri/Cargo.toml')).toBe(true));
  it('project/crates/rti_core/Cargo.toml exists', () => expect(exists('project/crates/rti_core/Cargo.toml')).toBe(true));
  it('project/crates/rti_core/src/lib.rs exists', () => expect(exists('project/crates/rti_core/src/lib.rs')).toBe(true));
});
