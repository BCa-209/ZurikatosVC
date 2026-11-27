import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../backend/', import.meta.url));
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
if (!existsSync(python)) {
  console.error('Crea primero backend/.venv siguiendo app/README.md.');
  process.exit(1);
}
const child = spawn(python, ['-m', 'uvicorn', 'zurikatos.api:app', '--app-dir', 'src', '--reload', '--host', '127.0.0.1', '--port', '8000'], { cwd: root, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
process.on('SIGINT', () => child.kill('SIGINT'));
