// Corre en un Web Worker: lee el Excel/CSV, calcula el resumen y genera el
// archivo de salida SIN bloquear la pestaña del navegador (un archivo de
// 55,000 filas tarda unos 15-20 segundos; sin worker, la pagina se
// congelaria ese tiempo).
importScripts("exceljs.min.js", "xlsx.full.min.js", "resumen.js", "excel_generator.js");

function muestraTop(filas, n) {
  return filas
    .map((f) => ({ cr: String(f[1]), cantidad: f[2] }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, n);
}

function decodificarTexto(arrayBuffer) {
  for (const codificacion of ["utf-8", "windows-1252", "iso-8859-1"]) {
    try {
      return new TextDecoder(codificacion, { fatal: codificacion === "utf-8" }).decode(
        arrayBuffer
      );
    } catch (e) {
      // se intenta la siguiente codificacion
    }
  }
  return new TextDecoder("iso-8859-1").decode(arrayBuffer); // nunca falla
}

function detectarSeparador(texto) {
  const primeraLinea = texto.split(/\r?\n/, 1)[0] || "";
  const candidatos = [",", ";", "\t", "|"];
  let mejor = ",";
  let max = -1;
  for (const c of candidatos) {
    const n = primeraLinea.split(c).length - 1;
    if (n > max) {
      max = n;
      mejor = c;
    }
  }
  return mejor;
}

self.onerror = function (evt) {
  const msg = (evt && evt.message) ? evt.message : "Error imprevisto en el worker.";
  self.postMessage({ ok: false, mensaje: msg });
};

self.onmessage = async function (evento) {
  const { id, arrayBuffer, nombreArchivo, opciones } = evento.data;
  const t0 = performance.now();
  try {
    let wb;
    if (/\.csv$/i.test(nombreArchivo)) {
      const texto = decodificarTexto(arrayBuffer);
      if (!texto.trim()) throw new Error("El archivo CSV está vacío.");
      const separador = detectarSeparador(texto);
      const wbCsv = XLSX.read(texto, { type: "string", raw: true, FS: separador });
      wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wbCsv.Sheets[wbCsv.SheetNames[0]], "Datos");
    } else {
      wb = XLSX.read(arrayBuffer, { type: "array" });
    }

    const resultado = ResumenCR.calcularResumen(wb, opciones);
    const reportBytes = await GeneradorExcel.generarReporteCompleto(resultado, opciones, nombreArchivo);
    const nombreSalida = GeneradorExcel.obtenerNombreSalida(nombreArchivo);

    const outBuf = reportBytes.buffer.slice(
      reportBytes.byteOffset,
      reportBytes.byteOffset + reportBytes.byteLength
    );

    self.postMessage(
      {
        id,
        ok: true,
        bytes: outBuf,
        avisos: [],
        nombreResumen: nombreSalida,
        resumen: {
          totalRegistros: resultado.totalRegistros,
          crsDistintos: resultado.filas.length,
          filasVacias: resultado.filasVacias,
          hojaOrigen: resultado.hojaOrigen,
          segundos: Math.round((performance.now() - t0) / 100) / 10,
          muestraCR: muestraTop(resultado.filas, 15),
        },
      },
      [outBuf]
    );
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      mensaje: (err && err.message) ? err.message : String(err),
    });
  }
};
