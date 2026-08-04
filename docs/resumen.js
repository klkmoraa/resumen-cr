// Logica de Resumen CR portada a JavaScript (misma regla que src/nucleo.py:
// normalizarEncabezado/claveCR/valorSalida son un espejo linea por linea de
// normalizar_encabezado/clave_cr/valor_cr_salida) para poder correr 100% en
// el navegador, sin servidor. Validada contra los mismos 19 casos de
// tests/test_nucleo.py antes de publicarse.
"use strict";

const ResumenCR = (() => {
  const MARCAS_COMBINADAS = new RegExp("[\\u0300-\\u036f]", "g");

  function normalizarEncabezado(valor) {
    if (valor === null || valor === undefined) return "";
    let t = String(valor).trim().toLowerCase();
    t = t.normalize("NFKD").replace(MARCAS_COMBINADAS, "");
    t = t.replace(/[^0-9a-z]+/g, "_");
    return t.replace(/^_+|_+$/g, "");
  }

  function estaVacio(valor) {
    return (
      valor === null ||
      valor === undefined ||
      (typeof valor === "string" && valor.trim() === "")
    );
  }

  function claveCR(valor) {
    if (typeof valor === "number") return String(valor);
    return String(valor).trim();
  }

  function valorSalida(valor) {
    if (typeof valor === "number") return valor;
    return String(valor).trim();
  }

  // Busca el encabezado en todas las hojas, en las primeras `filasBusqueda`
  // filas. Igual que nucleo.localizar_columna: retorna la coincidencia mas
  // arriba, y ante empate, la primera hoja.
  function obtenerXLSX(opciones) {
    if (opciones && opciones.XLSX) return opciones.XLSX;
    if (typeof XLSX !== "undefined") return XLSX;
    if (typeof self !== "undefined" && self.XLSX) return self.XLSX;
    if (typeof globalThis !== "undefined" && globalThis.XLSX) return globalThis.XLSX;
    try {
      return require("xlsx");
    } catch (e) {}
    return null;
  }

  function localizarColumna(wb, objetivo, filasBusqueda, XLSXLib) {
    const XLSXObj = XLSXLib || obtenerXLSX();
    if (!XLSXObj) throw new Error("La librería XLSX no está disponible.");
    const objetivoNorm = normalizarEncabezado(objetivo);
    const candidatas = [];
    wb.SheetNames.forEach((nombreHoja, ordenHoja) => {
      const hoja = wb.Sheets[nombreHoja];
      const filas = XLSXObj.utils.sheet_to_json(hoja, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: true,
      });
      const limite = Math.min(filasBusqueda, filas.length);
      for (let f = 0; f < limite; f++) {
        const fila = filas[f] || [];
        for (let c = 0; c < fila.length; c++) {
          if (normalizarEncabezado(fila[c]) === objetivoNorm) {
            candidatas.push({ filaNum: f + 1, ordenHoja, nombreHoja, idx: c });
            break;
          }
        }
        if (candidatas.length && candidatas[candidatas.length - 1].nombreHoja === nombreHoja) break;
      }
    });
    if (!candidatas.length) return null;
    candidatas.sort((a, b) => a.filaNum - b.filaNum || a.ordenHoja - b.ordenHoja);
    return candidatas[0];
  }

  function calcularResumen(wb, opciones) {
    opciones = opciones || {};
    const XLSXObj = obtenerXLSX(opciones);
    if (!XLSXObj) throw new Error("La librería XLSX no está disponible.");
    const objetivo = opciones.columnaObjetivo || "pr_centro_reparto";
    const filasBusqueda = opciones.filasBusquedaEncabezado || 10;
    const separador = opciones.separadorFolio || " - ";

    const ubicacion = localizarColumna(wb, objetivo, filasBusqueda, XLSXObj);
    if (!ubicacion) {
      const encontrados = wb.SheetNames.map((n) => {
        const filas = XLSXObj.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });
        const enc = (filas[0] || []).filter((c) => c !== null && c !== undefined).slice(0, 12);
        return "  - Hoja '" + n + "': " + (enc.length ? enc.join(", ") : "(vacia)");
      }).join("\n");
      const err = new Error(
        "El archivo no tiene la columna '" + objetivo + "'.\n\n" +
        "Se revisaron las primeras " + filasBusqueda + " filas de todas las hojas.\n\n" +
        "Encabezados encontrados:\n" + encontrados
      );
      err.tipo = "sin_columna";
      throw err;
    }

    const hoja = wb.Sheets[ubicacion.nombreHoja];
    const filas = XLSXObj.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null });

    const conteos = new Map();
    const valores = new Map();
    let total = 0;
    let vacias = 0;
    for (let f = ubicacion.filaNum; f < filas.length; f++) {
      const fila = filas[f] || [];
      const valor = ubicacion.idx < fila.length ? fila[ubicacion.idx] : null;
      if (estaVacio(valor)) {
        vacias++;
        continue;
      }
      const clave = claveCR(valor);
      if (!conteos.has(clave)) {
        conteos.set(clave, 0);
        valores.set(clave, valorSalida(valor));
      }
      conteos.set(clave, conteos.get(clave) + 1);
      total++;
    }

    if (total === 0) {
      const err = new Error(
        "Se encontro la columna '" + objetivo + "' en la hoja '" + ubicacion.nombreHoja +
        "', pero no tiene ningun dato debajo del encabezado."
      );
      err.tipo = "columna_vacia";
      throw err;
    }

    const filasResumen = [];
    let inicio = 1;
    for (const [clave, cantidad] of conteos) {
      const fin = inicio + cantidad - 1;
      filasResumen.push([inicio + separador + fin, valores.get(clave), cantidad]);
      inicio = fin + 1;
    }

    return {
      filas: filasResumen,
      hojaOrigen: ubicacion.nombreHoja,
      filaEncabezado: ubicacion.filaNum,
      indiceColumna: ubicacion.idx,
      totalRegistros: total,
      filasVacias: vacias,
    };
  }

  // Agrega la hoja "Resumen" (y opcionalmente evita chocar con una ya
  // existente) directamente sobre el workbook leido, para conservar las
  // hojas originales intactas. Devuelve los bytes finales (Uint8Array).
  function generarLibroSalida(wb, resultado, opciones) {
    opciones = opciones || {};
    const encabezados = opciones.encabezados || { folio: "FOLIO", cr: "CR", cantidad: "CONTCANTIDAD" };
    let nombreResumen = opciones.nombreHojaResumen || "Resumen";
    const avisos = [];

    if (wb.SheetNames.includes(nombreResumen)) {
      let i = 2;
      let libre = nombreResumen + "_" + i;
      while (wb.SheetNames.includes(libre)) {
        i++;
        libre = nombreResumen + "_" + i;
      }
      avisos.push(
        "El archivo ya tenia una hoja '" + nombreResumen + "'; el resumen nuevo se " +
        "llamo '" + libre + "' para no perderla."
      );
      nombreResumen = libre;
    }

    const filas = [[encabezados.folio, encabezados.cr, encabezados.cantidad]].concat(resultado.filas);
    const ws = XLSX.utils.aoa_to_sheet(filas);

    // formato de miles en CONTCANTIDAD + texto explicito para CR no numericos
    // (para que Excel no intente "adivinar" y borrar ceros a la izquierda)
    for (let f = 1; f <= resultado.filas.length; f++) {
      const celdaCant = ws[XLSX.utils.encode_cell({ r: f, c: 2 })];
      if (celdaCant) celdaCant.z = "#,##0";
      const celdaCR = ws[XLSX.utils.encode_cell({ r: f, c: 1 })];
      if (celdaCR && celdaCR.t === "s") celdaCR.z = "@";
    }
    ws["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 18 }];
    ws["!autofilter"] = { ref: "A1:C" + (resultado.filas.length + 1) };

    XLSX.utils.book_append_sheet(wb, ws, nombreResumen);
    wb.SheetNames = wb.SheetNames.filter((n) => n !== nombreResumen).concat(nombreResumen);

    const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return { bytes, nombreResumen, avisos };
  }

  return {
    normalizarEncabezado,
    estaVacio,
    claveCR,
    valorSalida,
    localizarColumna,
    calcularResumen,
    generarLibroSalida,
  };
})();

if (typeof window !== "undefined") window.ResumenCR = ResumenCR;
if (typeof self !== "undefined") self.ResumenCR = ResumenCR;
if (typeof globalThis !== "undefined") globalThis.ResumenCR = ResumenCR;
