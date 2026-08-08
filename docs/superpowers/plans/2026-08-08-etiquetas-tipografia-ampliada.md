# Etiquetas con tipografía ampliada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar las líneas divisorias y ampliar toda la tipografía del PDF de etiquetas, con énfasis en OT, folios y caja.

**Architecture:** Mantener la generación actual con jsPDF y modificar solamente la composición visual de `dibujarEtiquetaCaja`. La prueba de etiquetas seguirá ejecutando esa función en una VM con un documento PDF controlado para verificar orden, tamaños, colores, marcos y ausencia de líneas interiores.

**Tech Stack:** JavaScript de navegador, jsPDF 2.5.1, Node Test Runner, PowerShell, PyMuPDF para inspección visual.

## Global Constraints

- Conservar fondo blanco, texto negro, doble marco y hoja carta horizontal.
- Conservar exactamente el orden de los siete renglones.
- Usar 34, 25, 28, 18, 17, 32 y 40 pt, respectivamente.
- Mantener lotes de 3,000, folios de cinco dígitos y cajas de tres dígitos.
- No modificar `src/core.ts`, `docs/resumen.js`, `docs/worker.js` ni `docs/excel_generator.js`.
- No incluir en commits los archivos existentes bajo `Salida/`.

---

### Task 1: Composición visual y regresión automatizada

**Files:**
- Modify: `tests/labels-pdf.test.mjs`
- Modify: `docs/app.js:1088-1125`
- Modify: `docs/index.html:349`

**Interfaces:**
- Consumes: `dibujarEtiquetaCaja(doc, datos, inicio, fin, numeroCaja, totalCajas)` y el orden existente de los siete textos.
- Produces: la misma función y los mismos datos de salida, con tipografía ampliada y sin llamadas a `doc.line`.

- [ ] **Step 1: Escribir la prueba fallida**

Registrar las líneas en `DocumentoPdfFalso`:

```js
this.lineas = [];
line(...args) { this.lineas.push(args); }
```

Reemplazar las comprobaciones de tamaños por valores exactos y exigir cero líneas:

```js
assert.deepEqual(pdf.textos.map(({ tamanio }) => tamanio), [34, 25, 28, 18, 17, 32, 40]);
assert.equal(pdf.lineas.length, 0);
assert.equal(pdf.rectangulos.length, 2);
assert.deepEqual(pdf.textos[6].color, [0, 0, 0]);
```

- [ ] **Step 2: Ejecutar la prueba y comprobar el fallo esperado**

Run: `node --test tests/labels-pdf.test.mjs`

Expected: FAIL porque el generador actual usa tamaños menores y tres llamadas a `doc.line`.

- [ ] **Step 3: Implementar la composición aprobada**

Mantener el doble `doc.rect`, eliminar las tres llamadas a `doc.line` y dibujar:

```js
texto(datos.linea1, 38, 34, "bold");
texto(datos.linea2, 58, 25, "bold");
texto(datos.remesa, 83, 28, "bold");
texto(`CENTRO DE REPARTO    ${datos.ot}`, 107, 18, "bold");
texto("FOLIO", 127, 17, "bold");
texto(`${formatoFolio(inicio)} AL ${formatoFolio(fin)}`, 151, 32, "bold");
doc.setTextColor(0, 0, 0);
texto(`CAJA ${String(numeroCaja).padStart(3, "0")} DE ${String(totalCajas).padStart(3, "0")}`, 184, 40, "bold");
```

Cambiar en `docs/index.html` la referencia a `app.js?v=12`.

- [ ] **Step 4: Ejecutar la prueba específica y todas las pruebas**

Run: `node --test tests/labels-pdf.test.mjs`

Expected: 2 tests, 2 pass, 0 fail.

Run: `npm.cmd test`

Expected: todos los tests pasan, incluyendo orden, fondo blanco, tamaños y ausencia de líneas.

- [ ] **Step 5: Compilar y revisar sintaxis y diff**

Run: `npm.cmd run build`

Expected: exit 0; se permite la advertencia preexistente sobre `module.exports` de `docs/excel_generator.js`.

Run: `node --check docs/app.js`

Expected: exit 0 sin salida.

Run: `git diff --check`

Expected: exit 0.

- [ ] **Step 6: Confirmar que el motor protegido no cambió**

Run: `git diff --name-only d5b6b73 --`

Expected: solamente `docs/app.js`, `docs/index.html` y `tests/labels-pdf.test.mjs`.

- [ ] **Step 7: Commit de implementación**

```powershell
git add -- docs/app.js docs/index.html tests/labels-pdf.test.mjs
git commit -m "feat: ampliar tipografia de etiquetas"
```

### Task 2: Salida real y publicación

**Files:**
- Verify: `docs/app.js`
- Output temporal: `%TEMP%\resumen-cr-etiqueta-diseno-v12.pdf`
- Output temporal: `%TEMP%\resumen-cr-etiqueta-diseno-v12.png`

**Interfaces:**
- Consumes: `dibujarEtiquetaCaja` del Task 1 y jsPDF 2.5.1.
- Produces: evidencia PDF carta horizontal, render PNG y versión pública `app.js?v=12`.

- [ ] **Step 1: Generar un PDF real con jsPDF**

Ejecutar un script Node temporal desde PowerShell que lea `docs/app.js`, extraiga `dibujarEtiquetaCaja`, cargue jsPDF 2.5.1 y dibuje una etiqueta con `AUTOTRAFFIC`, `PUEBLA`, `REMESA 2607-54`, `OT-3707`, folios 51001-54000 y caja 018 de 019.

Expected: PDF de una página carta horizontal con más de 3,000 bytes.

- [ ] **Step 2: Renderizar y revisar visualmente**

Run: `python -c "import fitz; d=fitz.open(r'$env:TEMP\resumen-cr-etiqueta-diseno-v12.pdf'); p=d[0]; p.get_pixmap(matrix=fitz.Matrix(1.5,1.5), alpha=False).save(r'$env:TEMP\resumen-cr-etiqueta-diseno-v12.png')"`

Expected: una página de 792 por 612 puntos, sin líneas horizontales, texto completo, sin recortes y con doble marco.

- [ ] **Step 3: Publicar el commit**

Run: `git push origin master`

Expected: el commit local avanza `origin/master`.

- [ ] **Step 4: Verificar GitHub Pages**

Consultar `https://klkmoraa.github.io/resumen-cr/` hasta obtener HTTP 200 con `app.js?v=12`. Consultar después `https://klkmoraa.github.io/resumen-cr/app.js?v=12` y comprobar los siete tamaños y la ausencia de `doc.line` dentro de `dibujarEtiquetaCaja`.

Expected: HTTP 200, versión 12 y contenido nuevo publicado.
