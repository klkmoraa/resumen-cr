import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const app = fs.readFileSync(path.join(root, "docs/app.js"), "utf8");

class ElementoFalso {
  constructor() {
    this.children = [];
    this.listeners = new Map();
    this.classList = { add() {}, remove() {} };
    this.style = {};
    this.atributos = new Map();
    this.value = "";
    this.files = [];
  }

  addEventListener(tipo, manejador) {
    const manejadores = this.listeners.get(tipo) || [];
    manejadores.push(manejador);
    this.listeners.set(tipo, manejadores);
  }

  disparar(tipo, evento = {}) {
    evento.target ??= this;
    for (const manejador of this.listeners.get(tipo) || []) manejador(evento);
  }

  appendChild(hijo) {
    this.children.push(hijo);
    return hijo;
  }

  prepend(hijo) {
    this.children.unshift(hijo);
    return hijo;
  }

  querySelector() { return null; }
  querySelectorAll() { return []; }
  setAttribute(nombre, valor) { this.atributos.set(nombre, String(valor)); }
  getAttribute(nombre) { return this.atributos.get(nombre) || null; }
  click() {}
}

function cargarInterfaz() {
  const zona = new ElementoFalso();
  const entrada = new ElementoFalso();
  const lista = new ElementoFalso();
  const cuerpo = new ElementoFalso();
  const raiz = new ElementoFalso();
  const elementos = new Map([
    ["zona-arrastre", zona],
    ["entrada-archivos", entrada],
    ["lista-archivos", lista],
  ]);
  const documento = {
    body: cuerpo,
    documentElement: raiz,
    getElementById: (id) => elementos.get(id) || null,
    querySelectorAll: () => [],
    createElement: () => new ElementoFalso(),
    addEventListener() {},
  };
  const contexto = {
    document: documento,
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
    navigator: { hardwareConcurrency: 2 },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    Worker: class { postMessage() {} terminate() {} },
    URL: { revokeObjectURL() {} },
    performance: { now: () => 0 },
    setTimeout() {},
    console,
  };
  vm.runInNewContext(app, contexto, { filename: "docs/app.js" });
  return { cuerpo, entrada, lista };
}

function archivoValido() {
  return { name: "prueba.xlsx", arrayBuffer: () => new Promise(() => {}) };
}

test("el selector agrega el archivo a la cola visible", () => {
  const { entrada, lista } = cargarInterfaz();
  entrada.files = [archivoValido()];

  entrada.disparar("change");

  assert.equal(lista.children.length, 1);
});

test("soltar un archivo agrega el archivo a la cola visible", () => {
  const { cuerpo, lista } = cargarInterfaz();

  cuerpo.disparar("drop", {
    preventDefault() {},
    dataTransfer: { files: [archivoValido()] },
  });

  assert.equal(lista.children.length, 1);
});
