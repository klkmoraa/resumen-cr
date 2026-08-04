import fs from 'fs';
import ExcelJS from 'exceljs';

console.log('Testing ExcelJS...');
const wb = new ExcelJS.Workbook();
const wsResumen = wb.addWorksheet('Resumen');
wsResumen.addRow(['FOLIO', 'CR', 'CONTCANTIDAD']);
wsResumen.addRow(['1 - 10', '00123', 10]);

const wsDash = wb.addWorksheet('Dashboard');
wsDash.addRow(['Dashboard Test']);

const buffer = await wb.xlsx.writeBuffer();
console.log('Generated workbook buffer size:', buffer.byteLength);
