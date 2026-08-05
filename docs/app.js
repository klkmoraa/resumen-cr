// -*- coding: utf-8 -*-
// Resumen CR Pro 2.0 — Apple UI & Motion Graphics Engine
// Realiza el procesamiento seguro multihilo en Web Workers 100% en el navegador.

(function () {
  "use strict";

  const zona = document.getElementById("zona-arrastre");
  const entrada = document.getElementById("entrada-archivos");
  const btnElegir = document.getElementById("btn-elegir");
  const cola = document.getElementById("cola");
  const lista = document.getElementById("lista-trabajos");
  const campoColumna = document.getElementById("campo-columna");
  const lblColActual = document.getElementById("lbl-col-actual");
  const btnLimpiar = document.getElementById("btn-limpiar");
  const queueCounter = document.getElementById("queue-counter");

  // Modal elements
  const modalPreview = document.getElementById("modal-preview");
  const modalFilename = document.getElementById("modal-filename");
  const modalSubhead = document.getElementById("modal-subhead");
  const modalKpis = document.getElementById("modal-kpis");
  const modalTablaBody = document.getElementById("modal-tabla-body");
  const modalBuscar = document.getElementById("modal-buscar");
  const modalBtnCopiar = document.getElementById("modal-btn-copiar");
  const modalBtnCsv = document.getElementById("modal-btn-csv");
  const modalBtnDescargarExcel = document.getElementById("modal-btn-descargar-excel");
  const modalRegistroCount = document.getElementById("modal-registro-count");
  const modalCerrar = document.getElementById("modal-cerrar");

  const EXTENSIONES_VALIDAS = [".xlsx", ".xlsm", ".csv"];
  let contador = 0;
  const trabajosListos = [];
  let currentModalFilas = [];

  // --- IndexedDB History ---
  const DB_NAME = "ResumenCR_DB";
  const STORE_NAME = "historial";
  
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
          store.createIndex("fecha", "fecha", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function guardarHistorial(registro) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).add({
        ...registro,
        fecha: new Date().getTime()
      });
    } catch (e) {
      console.error("Error guardando en historial", e);
    }
  }

  async function cargarHistorial() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => {
          const items = req.result || [];
          // Sort by newest first
          items.sort((a, b) => b.fecha - a.fecha);
          resolve(items);
        };
      });
    } catch (e) {
      console.error("Error cargando historial", e);
      return [];
    }
  }

  async function restaurarHistorialUI() {
    try {
      const items = await cargarHistorial();
      if (!items || !Array.isArray(items) || items.length === 0) return;
      
      const recientes = items.slice(0, 5);
      for (const item of recientes.reverse()) {
        if (!item || !item.datos || !item.datos.resumen) continue;
        const { tarjeta } = crearTarjeta(item.nombreArchivo || "Archivo");
        const insignia = tarjeta.querySelector('.sf-badge');
        if (insignia) {
          insignia.className = "sf-badge sf-badge-success";
          insignia.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Historial`;
        }
        
        const pbarWrap = tarjeta.querySelector('.progress-bar-wrap');
        const pbarLabel = tarjeta.querySelector('.progress-bar-label');
        if (pbarWrap) pbarWrap.style.display = "none";
        if (pbarLabel) pbarLabel.style.display = "none";

        pintarResultado(tarjeta, { name: item.nombreArchivo || "Archivo" }, item.datos, item.segundos || 0, false);
      }
    } catch (e) {
      console.warn("Error seguro restaurando historial:", e);
    }
  }

  // Cargar historial de forma asíncrona sin bloquear la app
  setTimeout(restaurarHistorialUI, 100);

  // --- Worker Pool ---
  const workerPool = [];
  const MAX_WORKERS = navigator.hardwareConcurrency || 4;
  function getWorker() {
    if (workerPool.length > 0) return workerPool.pop();
    return new Worker("worker.js");
  }
  function releaseWorker(worker) {
    if (workerPool.length < MAX_WORKERS) {
      // Remove any lingering listeners
      worker.onmessage = null;
      worker.onerror = null;
      workerPool.push(worker);
    } else {
      worker.terminate();
    }
  }

  // ------------------------------------------------------------------
  // Gestión de Tema (Claro / Oscuro) con Persistencia Apple
  // ------------------------------------------------------------------
  const CLAVE_TEMA_STORAGE = "resumen_cr_theme";
  const btnTema = document.getElementById("btn-tema");
  const iconoTema = btnTema ? btnTema.querySelector(".icono-tema") : null;
  const textoTema = btnTema ? btnTema.querySelector(".texto-tema") : null;

  function obtenerTemaSistema() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute("data-theme", tema);
    const esOscuro = tema === "dark";
    if (btnTema) {
      btnTema.setAttribute("aria-pressed", esOscuro ? "true" : "false");
    }
    if (iconoTema) {
      iconoTema.textContent = esOscuro ? "☀️" : "🌙";
    }
    if (textoTema) {
      textoTema.textContent = esOscuro ? "Modo claro" : "Modo oscuro";
    }
  }

  function inicializarTema() {
    let temaGuardado = null;
    try {
      temaGuardado = localStorage.getItem(CLAVE_TEMA_STORAGE);
    } catch (e) {}

    const temaInicial = temaGuardado || obtenerTemaSistema();
    aplicarTema(temaInicial);

    if (window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const onChangeSystem = (e) => {
        let guardado = null;
        try { guardado = localStorage.getItem(CLAVE_TEMA_STORAGE); } catch (ex) {}
        if (!guardado) {
          aplicarTema(e.matches ? "dark" : "light");
        }
      };
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", onChangeSystem);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(onChangeSystem);
      }
    }

    if (btnTema) {
      btnTema.addEventListener("click", () => {
        const temaActual = document.documentElement.getAttribute("data-theme") || "light";
        const nuevoTema = temaActual === "dark" ? "light" : "dark";
        try {
          localStorage.setItem(CLAVE_TEMA_STORAGE, nuevoTema);
        } catch (e) {}
        aplicarTema(nuevoTema);
      });
    }
  }

  inicializarTema();

  // ------------------------------------------------------------------
  // Presets de Columnas
  // ------------------------------------------------------------------
  const presetChips = document.querySelectorAll(".preset-chip");
  presetChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      presetChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const val = chip.getAttribute("data-preset");
      if (campoColumna) campoColumna.value = val;
      if (lblColActual) lblColActual.textContent = val;
    });
  });

  if (campoColumna) {
    campoColumna.addEventListener("input", () => {
      const val = campoColumna.value.trim() || "pr_centro_reparto";
      if (lblColActual) lblColActual.textContent = val;
      presetChips.forEach((c) => {
        if (c.getAttribute("data-preset") === val) {
          c.classList.add("active");
        } else {
          c.classList.remove("active");
        }
      });
    });
  }

  // ------------------------------------------------------------------
  // Auxiliares de Formato
  // ------------------------------------------------------------------
  function formatearNumero(n) {
    return Number(n).toLocaleString("es-MX");
  }

  function el(etiqueta, opciones) {
    const nodo = document.createElement(etiqueta);
    opciones = opciones || {};
    if (opciones.clase) nodo.className = opciones.clase;
    if (opciones.texto !== undefined) nodo.textContent = opciones.texto;
    if (opciones.atributos) {
      for (const [k, v] of Object.entries(opciones.atributos)) nodo.setAttribute(k, v);
    }
    return nodo;
  }

  function extensionValida(nombre) {
    const n = nombre.toLowerCase();
    return EXTENSIONES_VALIDAS.some((ext) => n.endsWith(ext));
  }

  function nombreSalida(nombreOriginal) {
    if (!nombreOriginal) return "REPORTE_CR.xlsx";
    const idx = nombreOriginal.lastIndexOf(".");
    const base = idx >= 0 ? nombreOriginal.slice(0, idx) : nombreOriginal;
    return base + "_REPORTE_CR.xlsx";
  }

  function actualizarContadorCola() {
    const total = lista ? lista.children.length : 0;
    if (queueCounter) queueCounter.textContent = String(total);
    if (cola) cola.hidden = total === 0;
  }

  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      if (lista) lista.innerHTML = "";
      trabajosListos.length = 0;
      if (entrada) entrada.disabled = false;
      actualizarContadorCola();
    });
  }

  // ------------------------------------------------------------------
  // Arrastre AirDrop Style
  // ------------------------------------------------------------------
  function abrirSelector() {
    if (entrada) entrada.click();
  }
  if (btnElegir) btnElegir.addEventListener("click", (e) => {
    e.stopPropagation();
    abrirSelector();
  });
  if (zona) {
    zona.addEventListener("click", () => abrirSelector());
    zona.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        abrirSelector();
      }
    });

    ["dragenter", "dragover"].forEach((evt) =>
      document.body.addEventListener(evt, (e) => {
        e.preventDefault();
        zona.classList.add("highlight");
        // Add a global class for the fullscreen effect
        document.body.classList.add("global-drag-active");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      document.body.addEventListener(evt, (e) => {
        e.preventDefault();
        zona.classList.remove("highlight");
        document.body.classList.remove("global-drag-active");
      })
    );
    document.body.addEventListener("drop", (e) => {
      const archivos = e.dataTransfer.files;
      if (archivos && archivos.length) manejarArchivos(archivos);
    });
  }

  if (entrada) {
    entrada.addEventListener("change", () => {
      if (entrada.files.length) manejarArchivos(entrada.files);
      entrada.value = "";
    });
  }

  function obtenerOpcionesAvanzadas() {
    const col = (campoColumna ? campoColumna.value : "").trim();
    return col ? { columnaObjetivo: col } : {};
  }

  function manejarArchivos(archivos) {
    if (!archivos || archivos.length === 0) return;
    if (cola) cola.hidden = false;
    const esUnSoloArchivo = archivos.length === 1;

    for (const a of archivos) {
      if (!extensionValida(a.name)) {
        crearTarjetaError(a.name, "Tipo de archivo no admitido.");
        continue;
      }
      lanzarTrabajo(a, obtenerOpcionesAvanzadas(), esUnSoloArchivo);
    }
    actualizarContadorCola();
  }

  // ------------------------------------------------------------------
  // Tarjetas Apple UI + Worker Processing
  // ------------------------------------------------------------------
  function crearTarjeta(nombre) {
    const tarjeta = el("div", { clase: "apple-card" });

    const header = el("div", { clase: "card-header-row" });
    const nombreSpan = el("div", { clase: "card-filename" });
    nombreSpan.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--apple-blue)">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <span>${nombre}</span>
    `;
    header.appendChild(nombreSpan);

    const insignia = el("div", { clase: "sf-badge sf-badge-processing" });
    insignia.innerHTML = `<span class="apple-spinner"></span> Procesando localmente...`;
    header.appendChild(insignia);
    tarjeta.appendChild(header);

    const pbarWrap = el("div", { clase: "progress-bar-wrap", atributos: { style: "height:4px; background:var(--glass-border); border-radius:2px; margin-top:4px; overflow:hidden;" } });
    const pbarFill = el("div", { clase: "progress-bar-fill", atributos: { style: "height:100%; width:0%; background:var(--apple-blue); transition:width 0.3s ease;" } });
    const pbarLabel = el("div", { clase: "progress-bar-label", atributos: { style: "font-size:11px; color:var(--text-secondary); margin-top:6px; font-weight:600;" } });
    pbarLabel.textContent = "Iniciando...";
    pbarWrap.appendChild(pbarFill);
    tarjeta.appendChild(pbarWrap);
    tarjeta.appendChild(pbarLabel);

    lista.prepend(tarjeta);
    actualizarContadorCola();
    return { tarjeta, insignia, pbarFill, pbarLabel, pbarWrap };
  }

  function crearTarjetaError(nombre, mensaje) {
    const tarjeta = el("div", { clase: "apple-card" });
    const header = el("div", { clase: "card-header-row" });
    const nombreSpan = el("div", { clase: "card-filename" });
    nombreSpan.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--apple-red)">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <span>${nombre}</span>
    `;
    header.appendChild(nombreSpan);

    const insignia = el("div", { clase: "sf-badge sf-badge-error" });
    insignia.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Error
    `;
    header.appendChild(insignia);
    tarjeta.appendChild(header);

    tarjeta.appendChild(el("div", { clase: "card-error-banner", texto: mensaje }));
    lista.prepend(tarjeta);
    actualizarContadorCola();
  }

  function lanzarTrabajo(archivo, opciones, autoAbrir = false) {
    contador += 1;
    const id = "t" + contador;
    const { tarjeta, insignia, pbarFill, pbarLabel, pbarWrap } = crearTarjeta(archivo.name);

    const worker = getWorker();
    const inicio = performance.now();

    archivo
      .arrayBuffer()
      .then((buffer) => {
        worker.postMessage(
          { id, arrayBuffer: buffer, nombreArchivo: archivo.name, opciones },
          [buffer]
        );
      })
      .catch((err) => {
        mostrarError(tarjeta, insignia, "No se pudo leer el archivo: " + err.message);
      });

    worker.onmessage = (evento) => {
      const datos = evento.data || {};
      
      if (datos.tipo === "progreso") {
        if (pbarFill) pbarFill.style.width = datos.progreso + "%";
        if (pbarLabel) pbarLabel.textContent = datos.estado;
        return;
      }

      if (pbarWrap) pbarWrap.style.display = "none";
      if (pbarLabel) pbarLabel.style.display = "none";

      const segundosReales = Math.round((performance.now() - inicio) / 100) / 10;
      if (datos.ok) {
        insignia.className = "sf-badge sf-badge-success";
        insignia.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Completado
        `;
        const blobUrl = pintarResultado(tarjeta, archivo, datos, segundosReales, true);
        
        // Guardar en historial
        guardarHistorial({
          nombreArchivo: archivo.name,
          datos: { ...datos, bytes: datos.bytes },
          segundos: segundosReales
        });

        if (autoAbrir) {
          abrirModalPreview(archivo.name, datos.resumen, datos.resumen.filasResumen, blobUrl);
        }
      } else {
        const errTxt = datos.mensaje || datos.error || "Ocurrió un error al procesar el archivo.";
        mostrarError(tarjeta, insignia, errTxt);
      }
      releaseWorker(worker);
    };
    worker.onerror = (err) => {
      let mensajeError = "Error en el procesamiento del archivo.";
      if (err) {
        if (typeof err.message === "string" && err.message.trim()) {
          mensajeError = err.message;
        } else if (err.filename) {
          mensajeError = `Error en ${err.filename}:${err.lineno || 0}`;
        } else if (typeof err === "string") {
          mensajeError = err;
        }
      }
      mostrarError(tarjeta, insignia, mensajeError);
      worker.terminate();
    };
  }

  function mostrarError(tarjeta, insignia, mensaje) {
    insignia.className = "sf-badge sf-badge-error";
    insignia.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Error
    `;
    tarjeta.appendChild(el("div", { clase: "card-error-banner", texto: mensaje }));
  }

  function pintarResultado(tarjetaEl, archivoOriginal, datos, segundosReales, esNuevo = true) {
    if (!datos || !datos.resumen) return null;
    const r = datos.resumen;

    if (datos.avisos && datos.avisos.length) {
      tarjetaEl.appendChild(el("div", { clase: "card-error-banner", texto: datos.avisos.join(" ") }));
    }

    // Grid de KPI con estética Apple
    const kpis = el("div", { clase: "kpi-grid" });
    [
      ["Registros", formatearNumero(r.totalRegistros)],
      ["CRs Únicos", formatearNumero(r.crsDistintos)],
      ["Filas Vacías", formatearNumero(r.filasVacias)],
      ["Tiempo", segundosReales + " s"],
    ].forEach(([etiqueta, valor]) => {
      const tile = el("div", { clase: "kpi-tile" });
      tile.appendChild(el("div", { clase: "kpi-val", texto: valor }));
      tile.appendChild(el("div", { clase: "kpi-lbl", texto: etiqueta }));
      kpis.appendChild(tile);
    });
    tarjetaEl.appendChild(kpis);

    // Gráfica de distribución de Top CRs
    if (r.muestraCR && r.muestraCR.length) {
      tarjetaEl.appendChild(crearGraficaApple(r.muestraCR));
    }

    // Botones de Acción Apple
    const acciones = el("div", { clase: "card-actions" });

    // Botón Ver Previa & Dashboard
    const btnPrevia = el("button", { clase: "btn-apple btn-apple-secondary" });
    btnPrevia.setAttribute("type", "button");
    btnPrevia.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      Ver Previa & Dashboard
    `;

    const blob = datos.bytes instanceof Blob ? datos.bytes : new Blob([datos.bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);

    btnPrevia.addEventListener("click", () => {
      abrirModalPreview(archivoOriginal.name, r, r.filasResumen || [], url);
    });
    acciones.appendChild(btnPrevia);

    // Botón Descargar Reporte Excel
    const btnDescargar = el("a", { clase: "btn-apple btn-apple-primary" });
    btnDescargar.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Descargar Excel (.xlsx)
    `;
    btnDescargar.setAttribute("href", url);
    btnDescargar.setAttribute("download", nombreSalida(archivoOriginal.name));
    acciones.appendChild(btnDescargar);

    tarjetaEl.appendChild(acciones);

    // Guardar en array de trabajos listos (por si se necesita a futuro)
    if (esNuevo) {
      trabajosListos.push({ nombre: nombreSalida(archivoOriginal.name), blob });
    }
    return url;
  }

  function crearGraficaApple(muestra) {
    const wrap = el("div", { clase: "chart-container" });
    const top = muestra.slice(0, 8);
    const chartHeader = el("div", { clase: "chart-header" });
    chartHeader.innerHTML = `<span>Top ${top.length} Centros de Reparto</span><span>Distribución</span>`;
    wrap.appendChild(chartHeader);

    const maximo = Math.max(...top.map((m) => m.cantidad), 1);
    top.forEach((m) => {
      const fila = el("div", { clase: "bar-row" });

      const label = el("span", { clase: "bar-label", texto: m.cr });
      label.setAttribute("title", m.cr);
      fila.appendChild(label);

      const track = el("div", { clase: "bar-track" });
      const pct = Math.max(5, Math.round((m.cantidad / maximo) * 100));
      const fill = el("div", { clase: "bar-fill" });
      fill.style.width = "0%";
      setTimeout(() => { fill.style.width = pct + "%"; }, 50);
      track.appendChild(fill);
      fila.appendChild(track);

      fila.appendChild(el("span", { clase: "bar-value", texto: formatearNumero(m.cantidad) }));
      wrap.appendChild(fila);
    });
    return wrap;
  }

  // ------------------------------------------------------------------
  // Modal de Previa & Dashboard Interactivo
  // ------------------------------------------------------------------
  function abrirModalPreview(nombreOriginal, resumen, filas, downloadUrl) {
    try {
      if (!modalPreview) return;
      currentModalFilas = filas || [];

      if (modalFilename) modalFilename.textContent = nombreOriginal;
    if (modalSubhead) modalSubhead.textContent = `Hoja Origen: '${resumen.hojaOrigen || "Datos"}' · ${formatearNumero(resumen.totalRegistros)} registros totales`;

    if (modalBtnDescargarExcel) {
      modalBtnDescargarExcel.setAttribute("href", downloadUrl);
      modalBtnDescargarExcel.setAttribute("download", nombreSalida(nombreOriginal));
    }

    // Modal KPIs
    if (modalKpis) {
      modalKpis.innerHTML = "";
      [
        ["Registros totales", formatearNumero(resumen.totalRegistros)],
        ["CRs distintos", formatearNumero(resumen.crsDistintos)],
        ["Filas vacías", formatearNumero(resumen.filasVacias)],
        ["Tiempo de cálculo", (resumen.segundos || 0) + " s"],
      ].forEach(([lbl, val]) => {
        const tile = el("div", { clase: "kpi-tile" });
        tile.appendChild(el("div", { clase: "kpi-val", texto: val }));
        tile.appendChild(el("div", { clase: "kpi-lbl", texto: lbl }));
        modalKpis.appendChild(tile);
      });
    }

      if (modalBuscar) modalBuscar.value = "";
      renderizarTablaModal(currentModalFilas, resumen.totalRegistros);
      renderizarGraficasModal(currentModalFilas);

      modalPreview.hidden = false;
      document.body.style.overflow = "hidden";
    } catch (errorDashboard) {
      alert("Error al abrir Dashboard: " + errorDashboard.message + "\\n" + errorDashboard.stack);
      console.error(errorDashboard);
    }
  }

  function cerrarModalPreview() {
    if (!modalPreview) return;
    modalPreview.hidden = true;
    document.body.style.overflow = "";
  }

  if (modalCerrar) modalCerrar.addEventListener("click", cerrarModalPreview);
  if (modalPreview) {
    modalPreview.addEventListener("click", (e) => {
      if (e.target === modalPreview) cerrarModalPreview();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalPreview && !modalPreview.hidden) {
      cerrarModalPreview();
    }
  });

  function renderizarTablaModal(filas, totalRegs) {
    if (!modalTablaBody) return;
    modalTablaBody.innerHTML = "";

    const query = (modalBuscar ? modalBuscar.value : "").trim().toLowerCase();
    const filtradas = query
      ? filas.filter(
          (f) =>
            String(f[0]).toLowerCase().includes(query) ||
            String(f[1]).toLowerCase().includes(query)
        )
      : filas;

    const totalCalculado = totalRegs || filas.reduce((acc, f) => acc + f[2], 0) || 1;

    const fragment = document.createDocumentFragment();
    filtradas.forEach((f, idx) => {
      const tr = document.createElement("tr");
      const pct = ((f[2] / totalCalculado) * 100).toFixed(1);

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td class="td-folio">${f[0]}</td>
        <td class="td-cr">${f[1]}</td>
        <td><strong>${formatearNumero(f[2])}</strong></td>
        <td><span class="pct-chip">${pct}%</span></td>
      `;
      fragment.appendChild(tr);
    });
    modalTablaBody.appendChild(fragment);

    if (modalRegistroCount) {
      modalRegistroCount.textContent = `Mostrando ${formatearNumero(filtradas.length)} de ${formatearNumero(filas.length)} Centros de Reparto`;
    }
  }

  if (modalBuscar) {
    modalBuscar.addEventListener("input", () => {
      renderizarTablaModal(currentModalFilas);
    });
  }

  // Copiar tabla modal al portapapeles
  if (modalBtnCopiar) {
    modalBtnCopiar.addEventListener("click", () => {
      if (!currentModalFilas || !currentModalFilas.length) return;
      const tsv = ["#\tFolio\tCentro de Reparto\tCantidad\tPorcentaje"]
        .concat(
          currentModalFilas.map((f, i) => {
            const pct = ((f[2] / currentModalFilas.reduce((a, b) => a + b[2], 0)) * 100).toFixed(1);
            return `${i + 1}\t${f[0]}\t${f[1]}\t${f[2]}\t${pct}%`;
          })
        )
        .join("\n");

      navigator.clipboard.writeText(tsv).then(() => {
        const txtOrig = modalBtnCopiar.textContent;
        modalBtnCopiar.textContent = "✓ Copiado!";
        setTimeout(() => { modalBtnCopiar.textContent = txtOrig; }, 2000);
      });
    });
  }

  // Exportar CSV del modal
  if (modalBtnCsv) {
    modalBtnCsv.addEventListener("click", () => {
      if (!currentModalFilas || !currentModalFilas.length) return;
      const csvLines = ["FOLIO,CENTRO_REPARTO,CANTIDAD"]
        .concat(
          currentModalFilas.map((f) => `"${f[0]}","${f[1]}",${f[2]}`)
        )
        .join("\n");

      const blob = new Blob([csvLines], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "Resumen_CR_Previa.csv";
      link.click();
    });
  }

  // --- Chart.js Integration ---
  let chartPieInstance = null;
  let chartParetoInstance = null;

  function renderizarGraficasModal(filas) {
    if (typeof Chart === "undefined") {
      console.warn("Chart.js no está cargado.");
      return;
    }


    // 1. Prepare data for Pie (Top 10 + Otros)
    const sorted = [...filas].sort((a, b) => b[2] - a[2]);
    const top10 = sorted.slice(0, 10);
    const otros = sorted.slice(10);
    const otrosSuma = otros.reduce((acc, f) => acc + f[2], 0);
    
    const pieLabels = top10.map(f => String(f[1]));
    const pieData = top10.map(f => Number(f[2]));
    if (otrosSuma > 0) {
      pieLabels.push("Otros CRs");
      pieData.push(otrosSuma);
    }

    const colorPalette = [
      '#0a84ff', '#32ade6', '#5e5ce6', '#bf5af2', '#30d158', 
      '#ff453a', '#ff9f0a', '#64d2ff', '#af52de', '#34c759', '#6e6e73'
    ];

    const ctxPie = document.getElementById("chart-pie");
    if (chartPieInstance) chartPieInstance.destroy();
    if (ctxPie) {
      chartPieInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
          labels: pieLabels,
          datasets: [{
            data: pieData,
            backgroundColor: colorPalette,
            borderWidth: 2,
            borderColor: 'transparent'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#98989d', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } } },
            title: { display: true, text: 'Distribución: Top 10 vs Otros', color: '#f5f5f7', font: { size: 14, family: "'Plus Jakarta Sans', sans-serif" } }
          }
        }
      });
    }

    // 2. Prepare data for Pareto
    const totalSuma = sorted.reduce((acc, f) => acc + f[2], 0) || 1;
    let acum = 0;
    const paretoLabels = sorted.slice(0, 20).map(f => String(f[1]));
    const paretoDataBars = sorted.slice(0, 20).map(f => Number(f[2]));
    const paretoDataLine = sorted.slice(0, 20).map(f => {
      acum += f[2];
      return (acum / totalSuma) * 100;
    });

    const ctxPareto = document.getElementById("chart-pareto");
    if (chartParetoInstance) chartParetoInstance.destroy();
    if (ctxPareto) {
      chartParetoInstance = new Chart(ctxPareto, {
        type: 'bar',
        data: {
          labels: paretoLabels,
          datasets: [
            {
              type: 'line',
              label: 'Acumulado %',
              data: paretoDataLine,
              borderColor: '#ff9f0a',
              backgroundColor: '#ff9f0a',
              yAxisID: 'y1',
              tension: 0.3
            },
            {
              type: 'bar',
              label: 'Volumen',
              data: paretoDataBars,
              backgroundColor: '#5e5ce6',
              borderRadius: 4,
              yAxisID: 'y'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { color: '#98989d', font: { family: "'Plus Jakarta Sans', sans-serif" } } },
            title: { display: true, text: 'Análisis de Pareto', color: '#f5f5f7', font: { size: 14, family: "'Plus Jakarta Sans', sans-serif" } }
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#98989d' }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              min: 0,
              max: 100,
              grid: { drawOnChartArea: false },
              ticks: { color: '#98989d' }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#98989d' }
            }
          }
        }
      });
    }
  }

  // --- PDF Export Integration (Native jsPDF) ---
  const btnPdf = document.getElementById("modal-btn-pdf");
  if (btnPdf) {
    btnPdf.addEventListener("click", () => {
      if (typeof jspdf === "undefined" || !jspdf.jsPDF) {
        alert("Las librerías de PDF no se han cargado correctamente.");
        return;
      }
      
      const { jsPDF } = jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');
      
      const currentName = modalFilename.textContent || "Reporte";
      const pdfName = currentName.replace(/\.[^/.]+$/, "") + "_Dashboard.pdf";
      
      const originalText = btnPdf.innerHTML;
      btnPdf.innerHTML = "Construyendo PDF...";
      btnPdf.disabled = true;

      // Un pequeño setTimeout para que el navegador renderice el texto "Construyendo PDF..."
      setTimeout(() => {
        try {
          // --- 1. Cabecera Ejecutiva Corporativa ---
          doc.setFillColor(15, 23, 42); // slate-900 (Fondo azul oscuro)
          doc.rect(0, 0, 210, 40, 'F');
          
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(22);
          doc.text("Reporte Ejecutivo de Centros de Reparto", 14, 20);
          
          doc.setFontSize(11);
          doc.setTextColor(200, 200, 200);
          doc.text(`Archivo de Origen: ${currentName}`, 14, 28);
          doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 34);
          
          // --- 2. Gráficas Vectoriales Nativas (Matemáticas puras) ---
          let currentY = 50;

          // Extraer datos
          const sorted = [...currentModalFilas].sort((a, b) => b[2] - a[2]);
          const top10 = sorted.slice(0, 10);
          const barLabels = top10.map(f => String(f[1]));
          const barValues = top10.map(f => Number(f[2]));

          const totalSuma = sorted.reduce((acc, f) => acc + f[2], 0) || 1;
          let acum = 0;
          const top20 = sorted.slice(0, 20);
          const paretoLabels = top20.map(f => String(f[1]));
          const paretoDataBars = top20.map(f => Number(f[2]));
          const paretoDataLine = top20.map(f => {
            acum += f[2];
            return (acum / totalSuma) * 100;
          });

          // A) Dibujar Gráfica de Barras Horizontales (Izquierda)
          function dibujarBarrasNativas(x, y, w, h, titulo, labels, values) {
            doc.setFontSize(12);
            doc.setTextColor(30, 30, 30);
            doc.text(titulo, x, y);
            y += 8;
            const maxVal = Math.max(...values, 1);
            const barH = (h - 10) / (labels.length || 1);
            const maxBarW = w - 30; // espacio para textos

            for(let i = 0; i < labels.length; i++) {
              const curY = y + (i * barH);
              const bw = (values[i] / maxVal) * maxBarW;
              
              // Etiqueta (Centro de Reparto)
              doc.setFontSize(8);
              doc.setTextColor(100, 100, 100);
              doc.text(labels[i].substring(0, 8), x + 15, curY + (barH/2) + 2, { align: 'right' });
              
              // Barra
              doc.setFillColor(10, 132, 255); // Azul
              doc.rect(x + 18, curY + 2, bw, barH - 4, 'F');
              
              // Valor numérico
              doc.setFontSize(7);
              doc.setTextColor(50, 50, 50);
              doc.text(values[i].toLocaleString(), x + 20 + bw, curY + (barH/2) + 2);
            }
          }

          // B) Dibujar Gráfica de Pareto (Derecha)
          function dibujarParetoNativo(x, y, w, h, titulo, labels, bars, lines) {
            doc.setFontSize(12);
            doc.setTextColor(30, 30, 30);
            doc.text(titulo, x, y);
            y += 10; h -= 15;
            
            const maxB = Math.max(...bars, 1);
            const n = labels.length;
            const cx = x + 10, cy = y, cw = w - 20, ch = h;
            const bw = (cw / n) * 0.75;
            const gap = (cw / n) * 0.25;

            // Ejes
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.5);
            doc.line(cx, cy + ch, cx + cw, cy + ch); // Eje X
            doc.line(cx, cy, cx, cy + ch); // Eje Y izq
            
            // Valores máximos ejes Y
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);
            doc.text(maxB.toLocaleString(), cx - 2, cy + 3, { align: 'right' });
            doc.text("100%", cx + cw + 2, cy + 3, { align: 'left' });

            let px = null, py = null;

            for(let i=0; i<n; i++) {
              const curX = cx + (i * (cw/n)) + (gap/2);
              const curH = (bars[i] / maxB) * ch;
              
              // Barra Pareto
              doc.setFillColor(94, 92, 230); // Morado
              doc.rect(curX, cy + ch - curH, bw, curH, 'F');
              
              // Etiqueta inferior
              doc.setTextColor(80, 80, 80);
              doc.text(labels[i].substring(0, 6), curX + (bw/2), cy + ch + 4, { align: 'center' });

              // Línea Acumulada
              const lY = cy + ch - ((lines[i] / 100) * ch);
              const lX = curX + (bw/2);
              
              if (px !== null) {
                doc.setDrawColor(255, 159, 10); // Naranja
                doc.setLineWidth(1);
                doc.line(px, py, lX, lY);
              }
              doc.setFillColor(255, 159, 10);
              doc.circle(lX, lY, 1.2, 'F');
              
              px = lX; py = lY;
            }
          }

          dibujarBarrasNativas(14, currentY, 90, 80, "Distribución Top 10", barLabels, barValues);
          dibujarParetoNativo(110, currentY, 90, 80, "Análisis de Pareto", paretoLabels, paretoDataBars, paretoDataLine);

          currentY += 100;

          // --- 3. Generar la Tabla Vectorizada (jsPDF-AutoTable) ---
          const tablaDatos = currentModalFilas.map((f, i) => {
            const [rangoFolio, cr, cantidad] = f;
            return [ i + 1, rangoFolio, cr, cantidad.toLocaleString() ];
          });
          
          // Calcular el porcentaje total manualmente
          const totalSuma = currentModalFilas.reduce((acc, f) => acc + f[2], 0);
          tablaDatos.forEach(row => {
            const numStr = String(row[3]).replace(/,/g, '');
            const pct = ((parseInt(numStr) / totalSuma) * 100).toFixed(2) + "%";
            row.push(pct);
          });
          
          doc.autoTable({
            startY: currentY,
            head: [['#', 'Rango de Folios', 'Centro de Reparto', 'Cantidad', 'Porcentaje (%)']],
            body: tablaDatos,
            theme: 'striped',
            headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 10, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            margin: { top: 15, left: 14, right: 14, bottom: 15 },
            styles: { fontSize: 9, cellPadding: 4, textColor: [50, 50, 50] },
            columnStyles: {
              0: { cellWidth: 15, halign: 'center' },
              3: { halign: 'right' },
              4: { halign: 'right', fontStyle: 'bold' }
            },
            didDrawPage: function (data) {
              // Numeración de páginas en el footer
              const pageStr = 'Página ' + doc.internal.getNumberOfPages();
              doc.setFontSize(9);
              doc.setTextColor(150, 150, 150);
              doc.text(pageStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
            }
          });
          
          // 4. Descargar
          doc.save(pdfName);
          
        } catch (err) {
          console.error("Error al generar PDF nativo:", err);
          alert("Ocurrió un error al construir el PDF.");
        } finally {
          btnPdf.innerHTML = originalText;
          btnPdf.disabled = false;
        }
      }, 50);
    });
  }

  // Funciones ZIP eliminadas según petición del usuario.
})();
