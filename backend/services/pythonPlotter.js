const { spawn } = require('node:child_process');
const path = require('node:path');

const SCRIPT_PATH = path.join(__dirname, '..', 'matplotlib_plotter.py');
const MAX_RENDERERS = 2;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
let active = 0;

function renderPlot(type, payload) {
  if (active >= MAX_RENDERERS) return Promise.resolve(null);

  return new Promise((resolve) => {
    const worker = spawn(process.env.PYTHON_COMMAND || 'python', [SCRIPT_PATH, '--type=' + type], {
      windowsHide: true
    });
    active++;
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => worker.kill(), 6000);

    worker.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > MAX_OUTPUT_BYTES) worker.kill();
    });
    worker.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-2000);
    });
    worker.on('error', (error) => console.warn('[PythonPlotter]', error.message));
    worker.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') console.warn('[PythonPlotter stdin]', error.message);
    });

    worker.once('close', (code) => {
      clearTimeout(timeout);
      active--;
      if (code !== 0 || stdout.length > MAX_OUTPUT_BYTES) {
        if (stderr) console.warn('[PythonPlotter]', stderr.trim());
        return resolve(null);
      }
      try {
        const { image } = JSON.parse(stdout);
        return resolve(typeof image === 'string' && image.startsWith('data:image/png;base64,') ? image : null);
      } catch {
        return resolve(null);
      }
    });

    worker.stdin.end(JSON.stringify(payload));
  });
}

module.exports = { renderPlot };
