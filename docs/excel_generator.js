// Generator for Excel reports with Resumen & Dashboard sheets using ExcelJS
"use strict";

const GeneradorExcel = (() => {

  function obtenerCanvas(width, height) {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(width, height);
    }
    if (typeof window !== "undefined" && window.document && window.document.createElement) {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      return c;
    }
    try {
      const { createCanvas } = require("@napi-rs/canvas");
      return createCanvas(width, height);
    } catch (e) {}
    return null;
  }

  async function canvasToPngBuffer(canvas) {
    if (!canvas) return null;
    if (canvas.toBuffer) {
      return canvas.toBuffer("image/png");
    }
    if (canvas.convertToBlob) {
      const blob = await canvas.convertToBlob({ type: "image/png" });
      return new Uint8Array(await blob.arrayBuffer());
    }
    if (canvas.toDataURL) {
      const url = canvas.toDataURL("image/png");
      const base64 = url.split(",")[1];
      const binaryStr = atob(base64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return bytes;
    }
    return null;
  }

  // 1. Chart 1: Top 15 CRs (Horizontal Bar)
  async function generarGraficaTop15(filasResumen) {
    const width = 1200;
    const height = 700;
    const canvas = obtenerCanvas(width, height);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, width - 16, height - 16);

    ctx.fillStyle = "#0F172A";
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText("TOP 15 CENTROS DE REPARTO POR CANTIDAD", 40, 50);

    ctx.fillStyle = "#64748B";
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Volumen individual de env├¡os por Centro de Reparto", 40, 75);

    const data = filasResumen
      .map((f) => ({ cr: String(f[1]), cantidad: Number(f[2]) }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 15);

    if (!data.length) return await canvasToPngBuffer(canvas);

    const maxVal = Math.max(...data.map((d) => d.cantidad), 1);

    const startX = 180;
    const endX = width - 140;
    const chartWidth = endX - startX;
    const startY = 110;
    const rowHeight = (height - startY - 40) / data.length;
    const barHeight = Math.min(rowHeight * 0.65, 26);

    ctx.strokeStyle = "#F1F5F9";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 4; i++) {
      const gx = startX + (chartWidth * i) / 4;
      ctx.beginPath();
      ctx.moveTo(gx, startY);
      ctx.lineTo(gx, height - 30);
      ctx.stroke();

      ctx.fillStyle = "#94A3B8";
      ctx.font = '12px "Segoe UI", Arial, sans-serif';
      const gVal = Math.round((maxVal * i) / 4);
      ctx.fillText(gVal.toLocaleString("es-MX"), gx - 15, startY - 10);
    }
    ctx.setLineDash([]);

    data.forEach((d, idx) => {
      const y = startY + idx * rowHeight + (rowHeight - barHeight) / 2;
      const barWidth = Math.max((d.cantidad / maxVal) * chartWidth, 4);

      ctx.fillStyle = "#1E293B";
      ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = "right";
      ctx.fillText(d.cr, startX - 15, y + barHeight / 2 + 5);

      const grad = ctx.createLinearGradient(startX, y, startX + barWidth, y);
      grad.addColorStop(0, "#0071E3");
      grad.addColorStop(1, "#38BDF8");

      ctx.fillStyle = grad;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(startX, y, barWidth, barHeight, [0, 6, 6, 0]);
        ctx.fill();
      } else {
        ctx.fillRect(startX, y, barWidth, barHeight);
      }

      ctx.fillStyle = "#0F172A";
      ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = "left";
      ctx.fillText(d.cantidad.toLocaleString("es-MX"), startX + barWidth + 12, y + barHeight / 2 + 5);
    });

    return await canvasToPngBuffer(canvas);
  }

  // 2. Chart 2: Top 10 + Otros (Donut)
  async function generarGraficaDona(filasResumen, totalRegistros) {
    const width = 1200;
    const height = 700;
    const canvas = obtenerCanvas(width, height);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, width - 16, height - 16);

    ctx.fillStyle = "#0F172A";
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText("DISTRIBUCIÓN: TOP 10 VS. OTROS", 40, 50);

    ctx.fillStyle = "#64748B";
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Participaci├│n porcentual de los principales Centros de Reparto", 40, 75);

    const sorted = filasResumen
      .map((f) => ({ cr: String(f[1]), cantidad: Number(f[2]) }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const top10 = sorted.slice(0, 10);
    const otrosCant = sorted.slice(10).reduce((acc, curr) => acc + curr.cantidad, 0);

    const slices = [...top10];
    if (otrosCant > 0) {
      slices.push({ cr: "Otros CRs", cantidad: otrosCant });
    }

    const colors = [
      "#0071E3", "#5856D6", "#AF52DE", "#FF9500", "#34C759",
      "#00C7BE", "#32ADE6", "#FF3B30", "#64748B", "#8E8E93", "#CBD5E1"
    ];

    const total = slices.reduce((acc, curr) => acc + curr.cantidad, 0) || 1;

    const centerX = 340;
    const centerY = 380;
    const outerRadius = 210;
    const innerRadius = 125;

    let currentAngle = -Math.PI / 2;

    slices.forEach((s, idx) => {
      const sliceAngle = (s.cantidad / total) * (Math.PI * 2);
      const nextAngle = currentAngle + sliceAngle;

      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, currentAngle, nextAngle);
      ctx.arc(centerX, centerY, innerRadius, nextAngle, currentAngle, true);
      ctx.closePath();

      ctx.fillStyle = colors[idx % colors.length];
      ctx.fill();

      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.stroke();

      currentAngle = nextAngle;
    });

    ctx.fillStyle = "#64748B";
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("TOTAL REGISTROS", centerX, centerY - 15);

    ctx.fillStyle = "#0F172A";
    ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
    ctx.fillText(totalRegistros.toLocaleString("es-MX"), centerX, centerY + 20);

    const legendX = 660;
    let legendY = 130;
    const legendRowHeight = Math.min((height - 160) / slices.length, 45);

    ctx.textAlign = "left";
    slices.forEach((s, idx) => {
      const pct = ((s.cantidad / total) * 100).toFixed(1);

      ctx.fillStyle = colors[idx % colors.length];
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(legendX, legendY, 18, 18, 4);
        ctx.fill();
      } else {
        ctx.fillRect(legendX, legendY, 18, 18);
      }

      ctx.fillStyle = "#0F172A";
      ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
      ctx.fillText(s.cr, legendX + 30, legendY + 14);

      ctx.fillStyle = "#64748B";
      ctx.font = '14px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`${s.cantidad.toLocaleString("es-MX")} (${pct}%)`, legendX + 220, legendY + 14);

      legendY += legendRowHeight;
    });

    return await canvasToPngBuffer(canvas);
  }

  // 3. Chart 3: Pareto Chart
  async function generarGraficaPareto(filasResumen) {
    const width = 1200;
    const height = 700;
    const canvas = obtenerCanvas(width, height);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, width - 16, height - 16);

    ctx.fillStyle = "#0F172A";
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText("ANÁLISIS DE PARETO: DISTRIBUCIÓN ACUMULADA", 40, 50);

    ctx.fillStyle = "#64748B";
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Volumen individual (barras) y porcentaje acumulado (l├¡nea con umbral 80%)", 40, 75);

    const data = filasResumen
      .map((f) => ({ cr: String(f[1]), cantidad: Number(f[2]) }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 15);

    if (!data.length) return await canvasToPngBuffer(canvas);

    const grandTotal = filasResumen.reduce((acc, f) => acc + Number(f[2]), 0) || 1;
    const maxVal = Math.max(...data.map((d) => d.cantidad), 1);

    const startX = 80;
    const endX = width - 100;
    const chartWidth = endX - startX;
    const startY = 120;
    const endY = height - 80;
    const chartHeight = endY - startY;

    const colWidth = chartWidth / data.length;
    const barWidth = colWidth * 0.55;

    ctx.strokeStyle = "#F1F5F9";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const gy = endY - (chartHeight * i) / 5;
      ctx.beginPath();
      ctx.moveTo(startX, gy);
      ctx.lineTo(endX, gy);
      ctx.stroke();

      ctx.fillStyle = "#64748B";
      ctx.font = '12px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = "right";
      const lVal = Math.round((maxVal * i) / 5);
      ctx.fillText(lVal.toLocaleString("es-MX"), startX - 10, gy + 4);

      ctx.textAlign = "left";
      ctx.fillText(`${i * 20}%`, endX + 10, gy + 4);
    }

    const y80 = endY - chartHeight * 0.8;
    ctx.strokeStyle = "#FF3B30";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(startX, y80);
    ctx.lineTo(endX, y80);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#FF3B30";
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = "right";
    ctx.fillText("Umbral 80%", endX - 10, y80 - 6);

    let runningTotal = 0;
    const linePoints = [];

    data.forEach((d, idx) => {
      runningTotal += d.cantidad;
      const cumPct = Math.min((runningTotal / grandTotal) * 100, 100);

      const bx = startX + idx * colWidth + (colWidth - barWidth) / 2;
      const bHeight = (d.cantidad / maxVal) * chartHeight;
      const by = endY - bHeight;

      const grad = ctx.createLinearGradient(bx, by, bx, endY);
      grad.addColorStop(0, "#5856D6");
      grad.addColorStop(1, "#818CF8");

      ctx.fillStyle = grad;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(bx, by, barWidth, bHeight, [6, 6, 0, 0]);
        ctx.fill();
      } else {
        ctx.fillRect(bx, by, barWidth, bHeight);
      }

      ctx.fillStyle = "#1E293B";
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(d.cr, startX + idx * colWidth + colWidth / 2, endY + 22);

      const lx = startX + idx * colWidth + colWidth / 2;
      const ly = endY - (cumPct / 100) * chartHeight;
      linePoints.push({ x: lx, y: ly, pct: cumPct });
    });

    ctx.strokeStyle = "#FF9500";
    ctx.lineWidth = 4;
    ctx.beginPath();
    linePoints.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    linePoints.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#FF9500";
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    return await canvasToPngBuffer(canvas);
  }

  
  function crearKpiCard(ws, startCol, startRow, endCol, label, formulaStr, calcValue, numFmt = "#,##0", valColor = "FF0071E3") {
    const lblRange = `${startCol}${startRow}:${endCol}${startRow}`;
    const valRange = `${startCol}${startRow + 1}:${endCol}${startRow + 2}`;

    ws.mergeCells(lblRange);
    ws.mergeCells(valRange);

    const lblCell = ws.getCell(`${startCol}${startRow}`);
    lblCell.value = String(label).toUpperCase();
    lblCell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF64748B" } };
    lblCell.alignment = { vertical: "middle", horizontal: "center" };
    lblCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

    const valCell = ws.getCell(`${startCol}${startRow + 1}`);
    if (formulaStr) {
      valCell.value = { formula: formulaStr, result: calcValue };
    } else {
      valCell.value = calcValue;
    }
    valCell.font = { name: "Segoe UI", size: 18, bold: true, color: { argb: valColor } };
    valCell.alignment = { vertical: "middle", horizontal: "center" };
    valCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    if (numFmt) valCell.numFmt = numFmt;

    const cols = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
    const startIdx = cols.indexOf(startCol);
    const endIdx = cols.indexOf(endCol);

    for (let c = startIdx; c <= endIdx; c++) {
      const colLetter = cols[c];
      if (!colLetter) continue;
      for (let r = startRow; r <= startRow + 2; r++) {
        const cell = ws.getCell(`${colLetter}${r}`);
        const borderObj = cell.border || {};
        if (r === startRow) borderObj.top = { style: "thin", color: { argb: "FFCBD5E1" } };
        if (r === startRow + 2) borderObj.bottom = { style: "thin", color: { argb: "FFCBD5E1" } };
        if (colLetter === startCol) borderObj.left = { style: "thin", color: { argb: "FFCBD5E1" } };
        if (colLetter === endCol) borderObj.right = { style: "thin", color: { argb: "FFCBD5E1" } };
        cell.border = borderObj;
      }
    }
  }

  async function generarReporteCompleto(resultado, opciones, nombreOriginal, ExcelLibIn) {
    opciones = opciones || {};
    let ExcelLib = ExcelLibIn;
    if (!ExcelLib) {
      if (typeof ExcelJS !== "undefined") ExcelLib = ExcelJS;
      else if (typeof self !== "undefined" && self.ExcelJS) ExcelLib = self.ExcelJS;
      else if (typeof globalThis !== "undefined" && globalThis.ExcelJS) ExcelLib = globalThis.ExcelJS;
    }
    if (!ExcelLib) {
      try {
        ExcelLib = require("exceljs");
      } catch (e) {}
    }
    if (!ExcelLib) throw new Error("La librería ExcelJS no está disponible.");

    const workbook = new ExcelLib.Workbook();
    workbook.creator = "Resumen CR Pro";
    workbook.created = new Date();

    const filasData = resultado.filas || [];
    const numFilas = filasData.length;
    const totalRegistros = resultado.totalRegistros || 0;

    let topCRName = "N/A";
    let maxCantidad = 0;
    filasData.forEach((f) => {
      const cant = Number(f[2]) || 0;
      if (cant > maxCantidad) {
        maxCantidad = cant;
        topCRName = String(f[1]);
      }
    });

    // 1. Sheet: Resumen
    const wsResumen = workbook.addWorksheet("Resumen", {
      views: [{ state: "frozen", ySplit: 1 }]
    });

    const encabezados = opciones.encabezados || { folio: "FOLIO", cr: "CR", cantidad: "CONTCANTIDAD" };

    wsResumen.columns = [
      { key: "folio", width: 22 },
      { key: "cr", width: 20 },
      { key: "cantidad", width: 20 }
    ];

    const tableRows = filasData.map(fila => [fila[0], String(fila[1]), Number(fila[2])]);

    wsResumen.addTable({
      name: 'TablaResumen',
      ref: 'A1',
      headerRow: true,
      totalsRow: false,
      style: {
        theme: 'TableStyleMedium2',
        showRowStripes: true,
      },
      columns: [
        { name: encabezados.folio, filterButton: true },
        { name: encabezados.cr, filterButton: true },
        { name: encabezados.cantidad, filterButton: true }
      ],
      rows: tableRows,
    });

    // Format columns after adding table
    filasData.forEach((_, i) => {
      const row = wsResumen.getRow(i + 2);
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).numFmt = "@"; // Text for CR
      row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(3).numFmt = "#,##0"; 
      
      // Discreet borders
      ['A','B','C'].forEach(col => {
         const cell = row.getCell(col);
         const currentBorder = cell.border || {};
         cell.border = {
            ...currentBorder,
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
         };
      });
    });

    // Data bars for CONTCANTIDAD
    wsResumen.addConditionalFormatting({
      ref: `C2:C${numFilas + 1}`,
      rules: [
        {
          type: 'dataBar',
          cfvo: [{ type: 'min' }, { type: 'max' }],
          color: { argb: 'FF38BDF8' },
          gradient: true,
          border: false
        }
      ]
    });

    // 2. Sheet: Dashboard
    const wsDash = workbook.addWorksheet("Dashboard", {
      views: [{ showGridLines: false }]
    });

    wsDash.columns = [
      { width: 4 },  // A
      { width: 16 }, // B
      { width: 16 }, // C
      { width: 16 }, // D
      { width: 16 }, // E
      { width: 16 }, // F
      { width: 16 }, // G
      { width: 16 }, // H
      { width: 16 }, // I
      { width: 16 }, // J
      { width: 16 }, // K
      { width: 16 }, // L
      { width: 16 }, // M
      { width: 16 }, // N
      { width: 4 }   // O
    ];

    wsDash.mergeCells("B2:N3");
    const bannerCell = wsDash.getCell("B2");
    bannerCell.value = "DASHBOARD EJECUTIVO DE CENTROS DE REPARTO";
    bannerCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    bannerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    bannerCell.alignment = { vertical: "middle", horizontal: "center" };

    const endRowResumen = numFilas + 1;

    // Row 1 KPIs
    crearKpiCard(wsDash, "B", 5, "D", "Total de Registros", `SUM(Resumen!C2:C${endRowResumen})`, totalRegistros, "#,##0", "FF0071E3");
    crearKpiCard(wsDash, "E", 5, "G", "Total CR Distintos", `COUNTA(Resumen!B2:B${endRowResumen})`, numFilas, "#,##0", "FF5856D6");
    crearKpiCard(wsDash, "H", 5, "J", "Promedio Registros / CR", `AVERAGE(Resumen!C2:C${endRowResumen})`, numFilas > 0 ? totalRegistros / numFilas : 0, "#,##0.0", "FF34C759");
    crearKpiCard(wsDash, "K", 5, "M", "CR con Mayor Cantidad", `INDEX(Resumen!B2:B${endRowResumen}, MATCH(MAX(Resumen!C2:C${endRowResumen}), Resumen!C2:C${endRowResumen}, 0))`, topCRName, "@", "FF32ADE6");

    // Row 2 KPIs
    crearKpiCard(wsDash, "B", 9, "D", "Cantidad Máxima", `MAX(Resumen!C2:C${endRowResumen})`, maxCantidad, "#,##0", "FFAF52DE");
    crearKpiCard(wsDash, "E", 9, "G", "Rango Total de Folios", null, `1 - ${totalRegistros.toLocaleString("es-MX")}`, "@", "FFFF9500");

    const fechaHora = new Date().toLocaleString("es-MX");
    wsDash.mergeCells("H9:N9");
    wsDash.mergeCells("H10:N12");
    const infoLbl = wsDash.getCell("H9");
    infoLbl.value = "INFORMACIÓN DEL DOCUMENTO";
    infoLbl.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF64748B" } };
    infoLbl.alignment = { vertical: "middle", horizontal: "center" };
    infoLbl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    const infoVal = wsDash.getCell("H10");
    infoVal.value = `Archivo: '${nombreOriginal}'\nHoja Origen: '${resultado.hojaOrigen || "Datos"}'\nGenerado: ${fechaHora}`;
    infoVal.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF1E293B" } };
    infoVal.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    infoVal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    // Gráfica de Barras Nativa (Top 15 CRs con barras de datos)
    wsDash.mergeCells("B13:G13");
    const chartLbl = wsDash.getCell("B13");
    chartLbl.value = "TOP 15 CENTROS DE REPARTO (Gráfica de Datos Nativa)";
    chartLbl.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    chartLbl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    chartLbl.alignment = { vertical: "middle", horizontal: "center" };

    const top15 = [...filasData]
      .map(f => ({ cr: String(f[1]), cantidad: Number(f[2]) }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 15);

    top15.forEach((item, idx) => {
      const rowNum = 14 + idx;
      wsDash.mergeCells(`B${rowNum}:C${rowNum}`);
      wsDash.mergeCells(`D${rowNum}:G${rowNum}`);
      
      const cellCR = wsDash.getCell(`B${rowNum}`);
      cellCR.value = item.cr;
      cellCR.font = { name: "Segoe UI", size: 11, bold: true };
      cellCR.alignment = { horizontal: "right", vertical: "middle" };
      cellCR.border = { 
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } }
      };
      
      const cellVal = wsDash.getCell(`D${rowNum}`);
      cellVal.value = item.cantidad;
      cellVal.numFmt = "#,##0";
      cellVal.font = { name: "Segoe UI", size: 11 };
      cellVal.alignment = { horizontal: "left", vertical: "middle" };
      cellVal.border = { 
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } }
      };
    });

    if (top15.length > 0) {
      wsDash.addConditionalFormatting({
        ref: `D14:D${13 + top15.length}`,
        rules: [
          {
            type: 'dataBar',
            cfvo: [{ type: 'min' }, { type: 'max' }],
            color: { argb: 'FF0071E3' },
            gradient: true,
            border: false
          }
        ]
      });
      // Bottom border for the table
      for(let c = 2; c <= 7; c++) {
        wsDash.getRow(13 + top15.length).getCell(c).border = {
           bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
           ...(c === 2 ? { left: { style: "thin", color: { argb: "FFCBD5E1" } } } : {}),
           ...(c === 7 ? { right: { style: "thin", color: { argb: "FFCBD5E1" } } } : {})
        };
      }
    }

    
    // Heatmap Nativo (Bottom 10 CRs)
    wsDash.mergeCells("I13:N13");
    const heatmapLbl = wsDash.getCell("I13");
    heatmapLbl.value = "BOTTOM 10 CENTROS DE REPARTO (Mapa de Calor Nativo)";
    heatmapLbl.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    heatmapLbl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    heatmapLbl.alignment = { vertical: "middle", horizontal: "center" };

    const bottom10 = [...filasData]
      .map(f => ({ cr: String(f[1]), cantidad: Number(f[2]) }))
      .sort((a, b) => a.cantidad - b.cantidad)
      .slice(0, 10);

    bottom10.forEach((item, idx) => {
      const rowNum = 14 + idx;
      wsDash.mergeCells(`I${rowNum}:K${rowNum}`);
      wsDash.mergeCells(`L${rowNum}:N${rowNum}`);
      
      const cellCR = wsDash.getCell(`I${rowNum}`);
      cellCR.value = item.cr;
      cellCR.font = { name: "Segoe UI", size: 11, bold: true };
      cellCR.alignment = { horizontal: "right", vertical: "middle" };
      cellCR.border = { 
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } }
      };
      
      const cellVal = wsDash.getCell(`L${rowNum}`);
      cellVal.value = item.cantidad;
      cellVal.numFmt = "#,##0";
      cellVal.font = { name: "Segoe UI", size: 11 };
      cellVal.alignment = { horizontal: "center", vertical: "middle" };
      cellVal.border = { 
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } }
      };
    });

    if (bottom10.length > 0) {
      wsDash.addConditionalFormatting({
        ref: `L14:L${13 + bottom10.length}`,
        rules: [
          {
            type: 'colorScale',
            cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }],
            color: [
              { argb: 'FFF87171' },
              { argb: 'FFFBBF24' },
              { argb: 'FF34D399' } 
            ]
          }
        ]
      });
      for(let c = 9; c <= 14; c++) {
        const colLet = ["I","J","K","L","M","N"][c-9];
        wsDash.getRow(13 + bottom10.length).getCell(colLet).border = {
           bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
           ...(c === 9 ? { left: { style: "thin", color: { argb: "FFCBD5E1" } } } : {}),
           ...(c === 14 ? { right: { style: "thin", color: { argb: "FFCBD5E1" } } } : {})
        };
      }
    }

    try {
      if (typeof obtenerCanvas === 'function') {
        const buf2 = await generarGraficaDona(filasData, totalRegistros);
        if (buf2) {
          const id2 = workbook.addImage({ buffer: buf2, extension: "png" });
          wsDash.addImage(id2, {
            tl: { col: 1, row: 30 },
            ext: { width: 620, height: 360 }
          });
        }

        const buf3 = await generarGraficaPareto(filasData);
        if (buf3) {
          const id3 = workbook.addImage({ buffer: buf3, extension: "png" });
          wsDash.addImage(id3, {
            tl: { col: 8, row: 30 },
            ext: { width: 620, height: 360 }
          });
        }
      }
    } catch (e) {
      console.warn("No se pudieron generar las imagenes de las graficas:", e);
    }

    const arrayBuf = await workbook.xlsx.writeBuffer();
    return new Uint8Array(arrayBuf);
  }

  function obtenerNombreSalida(nombreOriginal) {
    if (!nombreOriginal) return "REPORTE_CR.xlsx";
    const idx = nombreOriginal.lastIndexOf(".");
    const base = idx >= 0 ? nombreOriginal.slice(0, idx) : nombreOriginal;
    return `${base}_REPORTE_CR.xlsx`;
  }

  return {
    generarReporteCompleto,
    obtenerNombreSalida
  };
})();

if (typeof window !== "undefined") window.GeneradorExcel = GeneradorExcel;
if (typeof self !== "undefined") self.GeneradorExcel = GeneradorExcel;
if (typeof globalThis !== "undefined") globalThis.GeneradorExcel = GeneradorExcel;
if (typeof module !== "undefined" && module.exports) {
  module.exports = GeneradorExcel;
}
