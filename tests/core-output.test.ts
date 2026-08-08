import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { procesarBufferExcel } from "../src/core.ts";

test("el reporte conserva el orden de CR, folios y formato de texto", async () => {
  const libroEntrada = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet([
    ["PR CENTRO REPARTO"],
    ["007"],
    ["9"],
    [null],
    ["007"],
    [9],
    ["A1"],
  ]);
  XLSX.utils.book_append_sheet(libroEntrada, hoja, "Produccion");
  const entrada = XLSX.write(libroEntrada, { type: "buffer", bookType: "xlsx" });

  const resultado = await procesarBufferExcel(entrada, "prod_OT_100_ATM1234-01.xlsx");

  assert.equal(resultado.ok, true);
  assert.equal(resultado.resumen?.total_registros, 5);
  assert.equal(resultado.resumen?.crs_distintos, 3);
  assert.ok(resultado.outputBuffer);

  const libroSalida = new ExcelJS.Workbook();
  await libroSalida.xlsx.load(resultado.outputBuffer!);
  const resumen = libroSalida.getWorksheet("Resumen");
  assert.ok(resumen);
  assert.deepEqual(
    [2, 3, 4].map((fila) => [
      resumen!.getCell(fila, 1).value,
      resumen!.getCell(fila, 2).value,
      resumen!.getCell(fila, 3).value,
    ]),
    [
      ["1 - 2", "007", 2],
      ["3 - 4", "9", 2],
      ["5 - 5", "A1", 1],
    ],
  );
  assert.equal(resumen!.getCell(2, 2).numFmt, "@");
  assert.ok(libroSalida.getWorksheet("Dashboard"));
});
