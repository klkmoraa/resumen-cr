import fs from 'fs';
import ExcelJS from 'exceljs';
import { createCanvas } from '@napi-rs/canvas';

function obtenerCanvas(width, height) {
  return createCanvas(width, height);
}

async function canvasToPngBuffer(canvas) {
  return canvas.toBuffer('image/png');
}

async function generarGraficaTop15(filasResumen) {
  const width = 1200;
  const height = 700;
  const canvas = obtenerCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, width - 16, height - 16);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
  ctx.fillText('TOP 15 CENTROS DE REPARTO POR CANTIDAD', 40, 50);

  ctx.fillStyle = '#64748B';
  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Volumen individual de envíos por Centro de Reparto', 40, 75);

  const data = filasResumen
    .map(f => ({ cr: String(f[1]), cantidad: Number(f[2]) }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 15);

  if (!data.length) return await canvasToPngBuffer(canvas);

  const maxVal = Math.max(...data.map(d => d.cantidad), 1);

  const startX = 180;
  const endX = width - 140;
  const chartWidth = endX - startX;
  const startY = 110;
  const rowHeight = (height - startY - 40) / data.length;
  const barHeight = Math.min(rowHeight * 0.65, 26);

  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (let i = 0; i <= 4; i++) {
    const gx = startX + (chartWidth * i) / 4;
    ctx.beginPath();
    ctx.moveTo(gx, startY);
    ctx.lineTo(gx, height - 30);
    ctx.stroke();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    const gVal = Math.round((maxVal * i) / 4);
    ctx.fillText(gVal.toLocaleString('es-MX'), gx - 15, startY - 10);
  }
  ctx.setLineDash([]);

  data.forEach((d, idx) => {
    const y = startY + idx * rowHeight + (rowHeight - barHeight) / 2;
    const barWidth = Math.max((d.cantidad / maxVal) * chartWidth, 4);

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(d.cr, startX - 15, y + barHeight / 2 + 5);

    const grad = ctx.createLinearGradient(startX, y, startX + barWidth, y);
    grad.addColorStop(0, '#0071E3');
    grad.addColorStop(1, '#38BDF8');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(startX, y, barWidth, barHeight, [0, 6, 6, 0]);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(d.cantidad.toLocaleString('es-MX'), startX + barWidth + 12, y + barHeight / 2 + 5);
  });

  return await canvasToPngBuffer(canvas);
}

async function testFullWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Resumen CR Pro";

  // 1. Sheet: Resumen
  const wsResumen = workbook.addWorksheet("Resumen", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  wsResumen.columns = [
    { header: "FOLIO", key: "folio", width: 22 },
    { header: "CR", key: "cr", width: 20 },
    { header: "CONTCANTIDAD", key: "cantidad", width: 20 }
  ];

  const headerRow = wsResumen.getRow(1);
  headerRow.height = 28;
  headerRow.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  const mockFilas = [
    ["1 - 1500", "CR 0012", 1500],
    ["1501 - 2700", "CR 0034", 1200],
    ["2701 - 3650", "CR 0056", 950]
  ];

  mockFilas.forEach((fila, idx) => {
    const r = wsResumen.addRow({ folio: fila[0], cr: String(fila[1]), cantidad: fila[2] });
    r.height = 20;
    const isEven = idx % 2 === 0;
    const bg = isEven ? "FFFFFFFF" : "FFF8FAFC";

    const c1 = r.getCell(1);
    c1.alignment = { vertical: "middle", horizontal: "center" };
    c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };

    const c2 = r.getCell(2);
    c2.alignment = { vertical: "middle", horizontal: "left" };
    c2.numFmt = "@";
    c2.font = { bold: true };
    c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };

    const c3 = r.getCell(3);
    c3.alignment = { vertical: "middle", horizontal: "right" };
    c3.numFmt = "#,##0";
    c3.font = { bold: true };
    c3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  });

  wsResumen.autoFilter = { from: "A1", to: `C${mockFilas.length + 1}` };

  // 2. Sheet: Dashboard
  const wsDash = workbook.addWorksheet("Dashboard");
  wsDash.views = [{ showGridLines: true }];

  wsDash.columns = [
    { width: 4 }, { width: 16 }, { width: 16 }, { width: 16 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 4 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 },
    { width: 16 }, { width: 16 }
  ];

  // Title
  wsDash.mergeCells("B2:N3");
  const tCell = wsDash.getCell("B2");
  tCell.value = "DASHBOARD DE CENTROS DE REPARTO (CR)";
  tCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  tCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  tCell.alignment = { vertical: "middle", horizontal: "center" };

  // Image insertion
  const imgBuffer = await generarGraficaTop15(mockFilas);
  const imgId = workbook.addImage({
    buffer: imgBuffer,
    extension: 'png'
  });

  wsDash.addImage(imgId, {
    tl: { col: 1, row: 12 },
    ext: { width: 680, height: 380 }
  });

  const finalBuf = await workbook.xlsx.writeBuffer();
  console.log('Full workbook generated successfully! Size:', finalBuf.byteLength);
}

await testFullWorkbook();
