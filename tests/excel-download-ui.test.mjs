import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const appOriginal = fs.readFileSync(path.join(root, "docs/app.js"), "utf8");
const appParaPrueba = appOriginal.replace(
  /\}\)\(\);\s*$/,
  "globalThis.__descargaExcel = { abrirModalPreview, guardarHistorialBinario: typeof guardarHistorialBinario === 'function' ? guardarHistorialBinario : null, obtenerUrlExcelActual: typeof obtenerUrlExcelActual === 'function' ? obtenerUrlExcelActual : null, registrarTrabajo: (trabajo) => trabajosListos.push(trabajo) }; })();",
);

class ElementoFalso {
  constructor() {
    this.atributos = new Map();
    this.classList = { add() {}, remove() {} };
    this.style = {};
    this.hidden = false;
    this.textContent = "";
    this.value = "";
  }

  setAttribute(nombre, valor) { this.atributos.set(nombre, String(valor)); }
  getAttribute(nombre) { return this.atributos.get(nombre) ?? null; }
  removeAttribute(nombre) { this.atributos.delete(nombre); }
  addEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  appendChild() {}
  prepend() {}
}

function cargarInterfaz() {
  const ids = ["modal-preview", "modal-filename", "modal-subhead", "modal-btn-descargar-excel"];
  const elementos = new Map(ids.map((id) => [id, new ElementoFalso()]));
  const documento = {
    body: new ElementoFalso(),
    documentElement: new ElementoFalso(),
    getElementById: (id) => elementos.get(id) || null,
    querySelectorAll: () => [],
    createElement: () => new ElementoFalso(),
    addEventListener() {},
  };
  let registroAgregado = null;
  const baseDatos = {
    objectStoreNames: { contains: () => true },
    transaction: () => ({
      objectStore: () => ({ add: (registro) => { registroAgregado = registro; } }),
    }),
  };
  const contexto = {
    document: documento,
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
    navigator: { hardwareConcurrency: 2 },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    indexedDB: {
      open: () => {
        const solicitud = { result: baseDatos };
        queueMicrotask(() => solicitud.onsuccess?.());
        return solicitud;
      },
    },
    Worker: class { terminate() {} },
    URL: { revokeObjectURL() {} },
    performance: { now: () => 0 },
    setTimeout() {},
    console,
  };
  vm.runInNewContext(appParaPrueba, contexto, { filename: "docs/app.js" });
  return { interfaz: contexto.__descargaExcel, elementos, obtenerRegistro: () => registroAgregado };
}

const resumen = {
  totalRegistros: 3,
  crsDistintos: 1,
  filasVacias: 0,
  hojaOrigen: "Datos",
  segundos: 0.1,
};

test("el historial sin archivo no navega a una ruta 404", () => {
  const { interfaz, elementos } = cargarInterfaz();
  const descarga = elementos.get("modal-btn-descargar-excel");

  interfaz.abrirModalPreview("produccion.xlsx", resumen, [["1 - 3", "CR", 3]], null);

  assert.equal(descarga.getAttribute("href"), null);
  assert.equal(descarga.getAttribute("aria-disabled"), "true");
});

test("un Excel generado conserva su enlace de descarga", () => {
  const { interfaz, elementos } = cargarInterfaz();
  const descarga = elementos.get("modal-btn-descargar-excel");

  interfaz.abrirModalPreview("produccion.xlsx", resumen, [["1 - 3", "CR", 3]], "blob:excel-generado");

  assert.equal(descarga.getAttribute("href"), "blob:excel-generado");
  assert.equal(descarga.getAttribute("download"), "produccion_REPORTE_CR.xlsx");
  assert.equal(descarga.getAttribute("aria-disabled"), "false");
});

test("el Excel generado se conserva en el historial binario", async () => {
  const { interfaz, obtenerRegistro } = cargarInterfaz();
  const bytes = new ArrayBuffer(8);

  assert.equal(typeof interfaz.guardarHistorialBinario, "function");
  await interfaz.guardarHistorialBinario({
    nombreArchivo: "produccion.xlsx",
    datos: { bytes, resumen },
    segundos: 0.1,
  });

  const guardado = obtenerRegistro();
  assert.equal(guardado.nombreArchivo, "produccion.xlsx");
  assert.equal(guardado.datos.bytes, bytes);
});

test("Reabrir encuentra el Excel generado en la sesión actual", () => {
  const { interfaz } = cargarInterfaz();

  assert.equal(typeof interfaz.obtenerUrlExcelActual, "function");
  interfaz.registrarTrabajo({
    nombre: "produccion_REPORTE_CR.xlsx",
    url: "blob:excel-de-la-sesion",
  });

  assert.equal(interfaz.obtenerUrlExcelActual("produccion.xlsx"), "blob:excel-de-la-sesion");
});
