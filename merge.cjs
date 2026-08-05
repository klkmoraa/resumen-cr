const fs = require('fs');
const temp = fs.readFileSync('temp_excel_generator.js', 'utf8');
const curr = fs.readFileSync('docs/excel_generator.js', 'utf8');

const canvasStart = temp.indexOf('function obtenerCanvas');
const canvasEnd = temp.indexOf('// 3. Chart 3: Pareto Chart');
const paretoStart = temp.indexOf('async function generarGraficaPareto', canvasEnd);
const paretoEnd = temp.indexOf('function crearKpiCard', paretoStart);

const canvasCode = temp.slice(canvasStart, paretoEnd);

let newCode = curr.replace('function crearKpiCard', canvasCode + '\n  function crearKpiCard');

// Update Información del Documento box to be larger
newCode = newCode.replace('wsDash.mergeCells("H9:M9");', 'wsDash.mergeCells("H9:N9");');
newCode = newCode.replace('wsDash.mergeCells("H10:M11");', 'wsDash.mergeCells("H10:N12");');

const injection = `
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
      wsDash.mergeCells(\`I\${rowNum}:K\${rowNum}\`);
      wsDash.mergeCells(\`L\${rowNum}:N\${rowNum}\`);
      
      const cellCR = wsDash.getCell(\`I\${rowNum}\`);
      cellCR.value = item.cr;
      cellCR.font = { name: "Segoe UI", size: 11, bold: true };
      cellCR.alignment = { horizontal: "right", vertical: "middle" };
      cellCR.border = { 
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } }
      };
      
      const cellVal = wsDash.getCell(\`L\${rowNum}\`);
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
        ref: \`L14:L\${13 + bottom10.length}\`,
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
`;

newCode = newCode.replace('const arrayBuf = await workbook.xlsx.writeBuffer();', injection + '\n    const arrayBuf = await workbook.xlsx.writeBuffer();');

fs.writeFileSync('docs/excel_generator.js', newCode);
console.log('Merge complete!');
