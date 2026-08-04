// -*- coding: utf-8 -*-
// Resumen CR — Apple UI & Motion Graphics Engine
// Realiza el procesamiento seguro multihilo en Web Workers 100% en el navegador.

(function () {
  "use strict";

  const zona = document.getElementById("zona-arrastre");
  const entrada = document.getElementById("entrada-archivos");
  const btnElegir = document.getElementById("btn-elegir");
  const cola = document.getElementById("cola");
  const lista = document.getElementById("lista-trabajos");
  const campoColumna = document.getElementById("campo-columna");
  const btnDescargarTodo = document.getElementById("btn-descargar-todo");

  const EXTENSIONES_VALIDAS = [".xlsx", ".xlsm", ".csv"];
  let contador = 0;
  const trabajosListos = [];

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

  // ------------------------------------------------------------------
  // Selección / Arrastre AirDrop Style
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
      zona.addEventListener(evt, (e) => {
        e.preventDefault();
        zona.classList.add("highlight");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      zona.addEventListener(evt, (e) => {
        e.preventDefault();
        zona.classList.remove("highlight");
      })
    );
    zona.addEventListener("drop", (e) => {
      const archivos = e.dataTransfer.files;
      if (archivos && archivos.length) procesarArchivos(archivos);
    });
  }

  if (entrada) {
    entrada.addEventListener("change", () => {
      if (entrada.files.length) procesarArchivos(entrada.files);
      entrada.value = "";
    });
  }

  function procesarArchivos(listaArchivos) {
    if (cola) cola.hidden = false;
    const columna = (campoColumna ? campoColumna.value : "").trim();
    const opciones = columna ? { columnaObjetivo: columna } : {};

    for (const archivo of listaArchivos) {
      if (!extensionValida(archivo.name)) {
        crearTarjetaError(archivo.name, "Tipo de archivo no admitido. Se aceptan: " + EXTENSIONES_VALIDAS.join(", "));
        continue;
      }
      lanzarTrabajo(archivo, opciones);
    }
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

    lista.prepend(tarjeta);
    return { tarjeta, insignia };
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
  }

  function lanzarTrabajo(archivo, opciones) {
    contador += 1;
    const id = "t" + contador;
    const { tarjeta, insignia } = crearTarjeta(archivo.name);

    const worker = new Worker("worker.js");
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
      const segundosReales = Math.round((performance.now() - inicio) / 100) / 10;
      if (datos.ok) {
        insignia.className = "sf-badge sf-badge-success";
        insignia.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Completado
        `;
        pintarResultado(tarjeta, archivo, datos, segundosReales);
      } else {
        const errTxt = datos.mensaje || datos.error || "Ocurrió un error al procesar el archivo.";
        mostrarError(tarjeta, insignia, errTxt);
      }
      worker.terminate();
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

  function pintarResultado(tarjetaEl, archivoOriginal, datos, segundosReales) {
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
    const btnDescargar = el("a", { clase: "btn-apple btn-apple-primary" });
    btnDescargar.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Descargar reporte Excel
    `;
    const blob = new Blob([datos.bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    btnDescargar.setAttribute("href", url);
    btnDescargar.setAttribute("download", nombreSalida(archivoOriginal.name));
    acciones.appendChild(btnDescargar);
    tarjetaEl.appendChild(acciones);

    // Guardar para descarga ZIP global si hay múltiples
    trabajosListos.push({ nombre: nombreSalida(archivoOriginal.name), blob });
    if (trabajosListos.length > 1 && btnDescargarTodo) {
      btnDescargarTodo.hidden = false;
    }
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
})();
