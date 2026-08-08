import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const leer = (archivo) => fs.readFileSync(path.join(root, archivo), "utf8");

test("la interfaz no interpola nombres de archivo sin escapar", () => {
  const app = leer("docs/app.js");
  assert.doesNotMatch(app, /<span>\$\{nombre\}<\/span>/);
  assert.doesNotMatch(app, /title="\$\{item\.nombre\}"/);
  assert.doesNotMatch(app, /class="td-cr">\$\{f\[1\]\}<\/td>/);
});

test("el servidor limita la cantidad de archivos por carga y usa IDs seguros", () => {
  const server = leer("server.ts");
  assert.match(server, /limits:\s*\{[^}]*files:\s*MAX_ARCHIVOS_POR_CARGA/);
  assert.match(server, /randomUUID\(\)/);
  assert.doesNotMatch(server, /Math\.random\(\)\.toString\(36\)/);
});

test("el navegador no crea una cantidad ilimitada de workers", () => {
  const app = leer("docs/app.js");
  assert.match(app, /Math\.min\(navigator\.hardwareConcurrency \|\| 4, 4\)/);
});

test("el servidor sirve solamente la interfaz canónica docs", () => {
  const server = leer("server.ts");
  assert.doesNotMatch(server, /express\.static\(path\.join\(__dirname, 'webapp'/);
  assert.doesNotMatch(server, /const templatePath = path\.join\(__dirname, 'webapp'/);
});

test("el servidor local no se expone a la red sin una configuración explícita", () => {
  const server = leer("server.ts");
  assert.match(server, /const HOST = process\.env\.HOST \|\| '127\.0\.0\.1';/);
});

test("la exportación CSV neutraliza fórmulas de Excel", () => {
  const app = leer("docs/app.js");
  assert.match(app, /function protegerCeldaCsv\(valor\)/);
  assert.match(app, /protegerCeldaCsv\(f\[1\]\)/);
});

test("el selector de archivos tiene un activador nativo visible", () => {
  const html = leer("docs/index.html");
  const estilos = leer("docs/styles.css");
  assert.match(html, /<label[^>]+for="entrada-archivos"[^>]*id="btn-elegir"/);
  const reglaInput = estilos.match(/\.dropzone-file-input\s*\{([^}]*)\}/)?.[1] || "";
  assert.doesNotMatch(reglaInput, /inset:\s*0/);
});
