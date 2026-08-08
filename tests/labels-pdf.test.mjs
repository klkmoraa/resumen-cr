import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const appOriginal = fs.readFileSync(path.join(root, "docs/app.js"), "utf8");
const appParaPrueba = appOriginal.replace(
  /\}\)\(\);\s*$/,
  "globalThis.__etiquetas = { abrirModalEtiquetas, dibujarEtiquetaCaja, fijarFilas: (filas) => { currentModalFilas = filas; }, fijarNombre: (nombre) => { currentModalNombre = nombre; } }; })();",
);

class ElementoFalso {
  constructor() {
    this.listeners = new Map();
    this.children = [];
    this.style = {};
    this.classList = { add() {}, remove() {} };
    this.atributos = new Map();
    this.value = "";
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
  }

  addEventListener(tipo, manejador) {
    this.listeners.set(tipo, [...(this.listeners.get(tipo) || []), manejador]);
  }

  appendChild(hijo) { this.children.push(hijo); return hijo; }
  prepend(hijo) { this.children.unshift(hijo); return hijo; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  setAttribute(nombre, valor) { this.atributos.set(nombre, String(valor)); }
  getAttribute(nombre) { return this.atributos.get(nombre) || null; }
  focus() {}
}

function cargarEtiquetas() {
  const ids = [
    "modal-etiquetas", "etiquetas-linea-1", "etiquetas-linea-2",
    "etiquetas-remesa", "etiquetas-ot", "etiquetas-resumen",
    "etiquetas-error", "modal-filename",
  ];
  const elementos = new Map(ids.map((id) => [id, new ElementoFalso()]));
  const cuerpo = new ElementoFalso();
  const documento = {
    body: cuerpo,
    documentElement: new ElementoFalso(),
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
  vm.runInNewContext(appParaPrueba, contexto, { filename: "docs/app.js" });
  return { etiquetas: contexto.__etiquetas, elementos };
}

class DocumentoPdfFalso {
  constructor() {
    this.internal = { pageSize: { getWidth: () => 279.4, getHeight: () => 215.9 } };
    this.textos = [];
    this.rectangulos = [];
    this.lineas = [];
    this.tamanio = 0;
    this.colorTexto = [];
    this.colorRelleno = [];
  }

  setDrawColor() {}
  setLineWidth() {}
  setFont() {}
  setFontSize(tamanio) { this.tamanio = tamanio; }
  setTextColor(...color) { this.colorTexto = color; }
  setFillColor(...color) { this.colorRelleno = color; }
  line(...args) { this.lineas.push(args); }
  rect(...args) {
    this.rectangulos.push({ args, colorRelleno: [...this.colorRelleno] });
  }
  text(contenido) { this.textos.push({ contenido, tamanio: this.tamanio, color: this.colorTexto }); }
}

test("la Remesa manual no se reemplaza al abrir etiquetas", () => {
  const { etiquetas, elementos } = cargarEtiquetas();
  const remesa = elementos.get("etiquetas-remesa");
  remesa.value = "REMESA MANUAL 77";
  etiquetas.fijarFilas([["1 - 3", "CR", 3]]);
  etiquetas.fijarNombre("prod_OT_3708_ATM2607-58.xlsx");

  etiquetas.abrirModalEtiquetas();

  assert.equal(remesa.value, "REMESA MANUAL 77");
  assert.equal(remesa.disabled, false);
});

test("la etiqueta amplía todos los textos y elimina las líneas divisorias", () => {
  const { etiquetas } = cargarEtiquetas();
  const pdf = new DocumentoPdfFalso();

  etiquetas.dibujarEtiquetaCaja(pdf, {
    linea1: "AUTOTRAFFIC",
    linea2: "PUEBLA",
    remesa: "REMESA 2607 - 58",
    ot: "OT- 3708",
  }, 1, 3000, 1, 18);

  assert.deepEqual(pdf.textos.map((texto) => texto.contenido), [
    "AUTOTRAFFIC",
    "PUEBLA",
    "REMESA 2607 - 58",
    "CENTRO DE REPARTO    OT- 3708",
    "FOLIO",
    "00001 AL 03000",
    "CAJA 001 DE 018",
  ]);
  assert.deepEqual(pdf.textos.map(({ tamanio }) => tamanio), [34, 25, 28, 18, 17, 32, 40]);
  assert.equal(pdf.lineas.length, 0);
  assert.deepEqual(pdf.textos[6].color, [0, 0, 0]);
  assert.equal(
    pdf.rectangulos.some(({ args, colorRelleno }) =>
      args.at(-1) === "F" && colorRelleno.join(",") === "0,0,0"),
    false,
  );
  assert.equal(pdf.rectangulos.length, 2);
});
