import fs from 'fs';
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

const mockData = [
  ['1-10', 'CR NORTE', 1500],
  ['11-25', 'CR SUR', 1200],
  ['26-35', 'CR ESTE', 950],
  ['36-40', 'CR OESTE', 600],
  ['41-42', 'CR CENTRO', 300]
];

const buf = await generarGraficaTop15(mockData);
console.log('PNG Buffer length:', buf.length);
