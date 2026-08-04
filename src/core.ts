import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import '../docs/excel_generator.js';

const GeneradorExcel = (globalThis as any).GeneradorExcel;

export interface ResumenOptions {
  columnaObjetivo?: string;
  filasBusquedaEncabezado?: number;
  separadorFolio?: string;
  nombreHojaResumen?: string;
}

export interface MuestraCR {
  cr: string;
  cantidad: number;
}

export interface ResumenStats {
  total_registros: number;
  crs_distintos: number;
  filas_vacias: number;
  hoja_origen: string;
  segundos: number;
  muestra_cr: MuestraCR[];
}

export interface ProcesarResultado {
  ok: boolean;
  mensaje: string;
  avisos: string[];
  outputBuffer?: Buffer;
  nombreSalida?: string;
  resumen?: ResumenStats;
}

const MARCAS_COMBINADAS = /[\u0300-\u036f]/g;

export function normalizarEncabezado(valor: any): string {
  if (valor === null || valor === undefined) return "";
  let t = String(valor).trim().toLowerCase();
  t = t.normalize("NFKD").replace(MARCAS_COMBINADAS, "");
  t = t.replace(/[^0-9a-z]+/g, "_");
  return t.replace(/^_+|_+$/g, "");
}

export function estaVacio(valor: any): boolean {
  return (
    valor === null ||
    valor === undefined ||
    (typeof valor === "string" && valor.trim() === "")
  );
}

export function claveCR(valor: any): string {
  if (typeof valor === "number") return String(valor);
  return String(valor).trim();
}

export function valorSalida(valor: any): any {
  if (typeof valor === "number") return valor;
  return String(valor).trim();
}

export function localizarColumna(wb: XLSX.WorkBook, objetivo: string, filasBusqueda: number) {
  const objetivoNorm = normalizarEncabezado(objetivo);
  const candidatas: Array<{ filaNum: number; ordenHoja: number; nombreHoja: string; idx: number }> = [];

  wb.SheetNames.forEach((nombreHoja, ordenHoja) => {
    const hoja = wb.Sheets[nombreHoja];
    const filas: any[][] = XLSX.utils.sheet_to_json(hoja, {
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

export async function procesarBufferExcel(
  inputBuffer: Buffer,
  nombreOriginal: string,
  opciones: ResumenOptions = {}
): Promise<ProcesarResultado> {
  const inicio = Date.now();
  const objetivo = opciones.columnaObjetivo || "pr_centro_reparto";
  const filasBusqueda = opciones.filasBusquedaEncabezado || 10;
  const separador = opciones.separadorFolio || " - ";

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(inputBuffer, { type: 'buffer', raw: true });
  } catch (err: any) {
    return {
      ok: false,
      mensaje: `No se pudo abrir el archivo Excel/CSV: ${err?.message || err}`,
      avisos: [],
    };
  }

  const ubicacion = localizarColumna(wb, objetivo, filasBusqueda);
  if (!ubicacion) {
    const encontrados = wb.SheetNames.map((n) => {
      const filas: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });
      const enc = (filas[0] || []).filter((c) => c !== null && c !== undefined).slice(0, 12);
      return `  - Hoja '${n}': ${enc.length ? enc.join(", ") : "(vacia)"}`;
    }).join("\n");

    return {
      ok: false,
      mensaje: `El archivo no tiene la columna '${objetivo}'.\n\nSe revisaron las primeras ${filasBusqueda} filas de todas las hojas.\n\nEncabezados encontrados:\n${encontrados}`,
      avisos: [],
    };
  }

  const hoja = wb.Sheets[ubicacion.nombreHoja];
  const filas: any[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null });

  const conteos = new Map<string, number>();
  const valores = new Map<string, any>();
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
    conteos.set(clave, conteos.get(clave)! + 1);
    total++;
  }

  if (total === 0) {
    return {
      ok: false,
      mensaje: `Se encontro la columna '${objetivo}' en la hoja '${ubicacion.nombreHoja}', pero no tiene ningun dato debajo del encabezado.`,
      avisos: [],
    };
  }

  const filasResumen: any[][] = [];
  let inicioFolio = 1;
  const muestraCR: MuestraCR[] = [];

  for (const [clave, cantidad] of conteos) {
    const finFolio = inicioFolio + cantidad - 1;
    const val = valores.get(clave);
    filasResumen.push([`${inicioFolio}${separador}${finFolio}`, val, cantidad]);
    muestraCR.push({ cr: String(val), cantidad });
    inicioFolio = finFolio + 1;
  }

  const resultadoObj = {
    filas: filasResumen,
    hojaOrigen: ubicacion.nombreHoja,
    filaEncabezado: ubicacion.filaNum,
    indiceColumna: ubicacion.idx,
    totalRegistros: total,
    filasVacias: vacias,
  };

  const reportUint8 = await GeneradorExcel.generarReporteCompleto(
    resultadoObj,
    opciones,
    nombreOriginal,
    ExcelJS
  );

  const outBuffer = Buffer.from(reportUint8.buffer);
  const nombreSalida = GeneradorExcel.obtenerNombreSalida(nombreOriginal);

  const segundos = Math.round((Date.now() - inicio) / 100) / 10;

  return {
    ok: true,
    mensaje: "Procesado correctamente",
    avisos: [],
    outputBuffer: outBuffer,
    nombreSalida,
    resumen: {
      total_registros: total,
      crs_distintos: conteos.size,
      filas_vacias: vacias,
      hoja_origen: ubicacion.nombreHoja,
      segundos,
      muestra_cr: muestraCR,
    },
  };
}
