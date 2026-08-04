import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import archiver from 'archiver';
import { procesarBufferExcel, ResumenStats } from './src/core.js';

const __dirname = path.resolve();

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

const CARPETA_TRABAJO = path.join(__dirname, 'webapp', '_trabajo');
if (!fs.existsSync(CARPETA_TRABAJO)) {
  fs.mkdirSync(CARPETA_TRABAJO, { recursive: true });
}

const HORAS_RETENCION = 6;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024 * 1024 }, // 300 MB
});

interface Job {
  id: string;
  nombre_original: string;
  estado: 'procesando' | 'ok' | 'error';
  logs: string[];
  mensaje: string;
  avisos: string[];
  salida_ruta?: string;
  nombre_salida?: string;
  resumen?: ResumenStats;
  creado: number;
}

const JOBS = new Map<string, Job>();

function limpiarJobsViejos() {
  const limite = Date.now() - HORAS_RETENCION * 3600 * 1000;
  for (const [id, job] of JOBS.entries()) {
    if (job.creado < limite) {
      if (job.salida_ruta && fs.existsSync(job.salida_ruta)) {
        try {
          fs.rmSync(path.dirname(job.salida_ruta), { recursive: true, force: true });
        } catch {}
      }
      JOBS.delete(id);
    }
  }
}

const EXTENSIONES_VALIDAS = ['.xlsx', '.xlsm', '.csv'];

function extensionValida(nombre: string): boolean {
  const ext = path.extname(nombre).toLowerCase();
  return EXTENSIONES_VALIDAS.includes(ext);
}

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'docs')));
app.use('/static', express.static(path.join(__dirname, 'webapp', 'static')));
app.use('/docs', express.static(path.join(__dirname, 'docs')));

// Página Principal
app.get('/', (req, res) => {
  const docsTemplate = path.join(__dirname, 'docs', 'index.html');
  if (fs.existsSync(docsTemplate)) {
    return res.sendFile(docsTemplate);
  }
  const templatePath = path.join(__dirname, 'webapp', 'templates', 'index.html');
  if (fs.existsSync(templatePath)) {
    let html = fs.readFileSync(templatePath, 'utf-8');
    html = html.replace(/\{\{\s*url_for\('static',\s*filename='([^']+)'\)\s*\}\}/g, '/static/$1');
    html = html.replace(/\{\{\s*columna_objetivo\s*\}\}/g, 'pr_centro_reparto');
    html = html.replace(/\{\{\s*extensiones\s*\}\}/g, '.xlsx, .xlsm, .csv');
    return res.send(html);
  }
  return res.status(404).send('Página no encontrada');
});

// API Salud
app.get('/api/salud', (req, res) => {
  res.json({ ok: true });
});

// API Subir
app.post('/api/subir', upload.array('archivos'), async (req, res) => {
  limpiarJobsViejos();

  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No se recibio ningun archivo.' });
  }

  const columna = (req.body?.columna || '').toString().trim();
  const overrides = columna ? { columnaObjetivo: columna } : {};

  const resultados: Array<{ id: string | null; nombre: string; error?: string }> = [];

  for (const file of files) {
    const nombreOriginal = file.originalname || 'archivo';
    if (!extensionValida(nombreOriginal)) {
      resultados.push({
        id: null,
        nombre: nombreOriginal,
        error: `Tipo de archivo no admitido. Se aceptan: ${EXTENSIONES_VALIDAS.join(', ')}`,
      });
      continue;
    }

    const jobId = Math.random().toString(36).substring(2, 14);
    const jobFolder = path.join(CARPETA_TRABAJO, jobId);
    fs.mkdirSync(jobFolder, { recursive: true });

    const jobLogs: string[] = [`Analizando ${nombreOriginal}...`];

    const resultado = await procesarBufferExcel(file.buffer, nombreOriginal, overrides);

    if (resultado.ok && resultado.outputBuffer && resultado.nombreSalida) {
      const rutaSalida = path.join(jobFolder, resultado.nombreSalida);
      fs.writeFileSync(rutaSalida, resultado.outputBuffer);

      jobLogs.push(`Procesado correctamente en ${resultado.resumen?.segundos || 0}s.`);

      JOBS.set(jobId, {
        id: jobId,
        nombre_original: nombreOriginal,
        estado: 'ok',
        logs: jobLogs,
        mensaje: resultado.mensaje,
        avisos: resultado.avisos,
        salida_ruta: rutaSalida,
        nombre_salida: resultado.nombreSalida,
        resumen: resultado.resumen,
        creado: Date.now(),
      });
    } else {
      jobLogs.push(`Error: ${resultado.mensaje}`);
      JOBS.set(jobId, {
        id: jobId,
        nombre_original: nombreOriginal,
        estado: 'error',
        logs: jobLogs,
        mensaje: resultado.mensaje,
        avisos: resultado.avisos,
        creado: Date.now(),
      });
    }

    resultados.push({ id: jobId, nombre: nombreOriginal });
  }

  res.json({ trabajos: resultados });
});

// API Estado
app.get('/api/estado/:job_id', (req, res) => {
  const jobId = req.params.job_id;
  const job = JOBS.get(jobId);
  if (!job) {
    return res.status(404).json({
      error: 'Ese trabajo ya no existe (expiro o el servidor se reinicio).',
    });
  }

  res.json({
    id: job.id,
    nombre: job.nombre_original,
    estado: job.estado,
    logs: job.logs,
    mensaje: job.mensaje,
    avisos: job.avisos,
    nombre_salida: job.nombre_salida,
    resumen: job.resumen,
  });
});

// API Descargar
app.get('/api/descargar/:job_id', (req, res) => {
  const jobId = req.params.job_id;
  const job = JOBS.get(jobId);

  if (!job || job.estado !== 'ok' || !job.salida_ruta || !fs.existsSync(job.salida_ruta)) {
    return res.status(404).json({ error: 'El archivo no esta listo o ya no existe.' });
  }

  res.download(job.salida_ruta, job.nombre_salida);
});

// API Descargar Zip
app.get('/api/descargar-zip', (req, res) => {
  const ids = ((req.query.ids as string) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!ids.length) {
    return res.status(400).json({ error: 'No se indicaron trabajos.' });
  }

  const archive = archiver('zip', { zlib: { level: 9 } });
  let incluidos = 0;

  for (const id of ids) {
    const job = JOBS.get(id);
    if (job && job.estado === 'ok' && job.salida_ruta && fs.existsSync(job.salida_ruta)) {
      archive.file(job.salida_ruta, { name: job.nombre_salida || `resumen_${id}.xlsx` });
      incluidos++;
    }
  }

  if (incluidos === 0) {
    return res.status(404).json({ error: 'Ninguno de los archivos esta listo todavia.' });
  }

  res.attachment('resumenes_cr.zip');
  archive.pipe(res);
  archive.finalize();
});

// Start Server
app.listen(PORT, HOST, () => {
  console.log(`Servidor Resumen CR corriendo en http://${HOST}:${PORT}`);
});
