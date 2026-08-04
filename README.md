# Resumen CR — Generador de listados por Centro de Reparto

Convierte los Excel (o CSV) de producción en el **listado de CR** listo para usar,
sin abrir código y sin tocar el archivo original.

Hay **tres** formas de usarlo, con la misma lógica probada por dentro:

| | Dónde corre | Formato / gráficas | Requiere instalar algo |
|---|---|---|---|
| 🌐 **[Página web](https://klkmoraa.github.io/resumen-cr/)** | 100% en tu navegador | Datos completos, sin gráficas nativas de Excel | No — solo un link |
| 🖥️ **App de escritorio** (`ResumenCR.exe`) | Tu PC (Windows) | Formato y gráficas completas | No, es un `.exe` |
| 🛰️ **App web con servidor** (`webapp/`) | Un servidor propio (Flask) | Formato y gráficas completas | Python, para levantarla |

---

## 0. La versión más rápida de usar: la página web

👉 **<https://klkmoraa.github.io/resumen-cr/>**

Abre el link, arrastra tu Excel o CSV y descarga el resultado. El archivo
**nunca sale de tu computadora** — todo el cálculo corre en JavaScript dentro
de tu navegador (usando [SheetJS](https://git.sheetjs.com/sheetjs/sheetjs)),
así que no hay nada que instalar ni ningún dato que se suba a internet.

Es la misma lógica exacta de conteo y folios que las otras dos versiones
(ver [`docs/resumen.js`](docs/resumen.js), portado línea por línea desde
[`src/nucleo.py`](src/nucleo.py) y validado contra los mismos casos de
[`tests/test_nucleo.py`](tests/test_nucleo.py)). La única diferencia real es
visual: por una limitación de la librería que lee/escribe Excel en el
navegador, la hoja `Resumen` generada ahí no lleva colores ni gráficas
*nativas* de Excel (sí hay una vista previa de las gráficas en la propia
página). Para el formato y las gráficas completas dentro del Excel, usa la
app de escritorio o `webapp/`.

---

## 1. App de escritorio — guía rápida

### Opción A — arrastrar el archivo

1. Arrastra uno o varios Excel/CSV sobre **`ResumenCR.exe`** (o `Ejecutar.bat`).
2. Espera. Un archivo de 50 000 filas tarda alrededor de **30 segundos**.
3. Al terminar aparece un aviso y se abre la carpeta con el archivo generado.

### Opción B — botón

1. Doble clic en **`ResumenCR.exe`**.
2. Botón **“Seleccionar Excel…”** y elige el archivo.

### Opción C — carpetas Entrada / Salida

1. Copia tus archivos dentro de la carpeta **`Entrada`**.
2. Abre el programa y pulsa **“Procesar carpeta Entrada”**.
3. Recoge los resultados en la carpeta **`Salida`**.

> El archivo original **nunca** se modifica, se mueve ni se borra.
> El resultado se guarda aparte, con el mismo nombre + `_RESUMEN_CR`.

> **Dónde busca sus carpetas:** el `.exe` usa las carpetas `Entrada`, `Salida`,
> `logs` y el `config.json` **que están junto a él** (dentro de `dist\ResumenCR`).
> Si en su lugar ejecutas `Ejecutar.bat`, usa las de la raíz del proyecto.

---

## 2. App web con servidor propio (`webapp/`)

Para equipos que quieren una URL interna (en su red local) donde varias
personas suban archivos, con el formato y las gráficas completas dentro del
Excel, y varios archivos procesándose en paralelo (usa varios núcleos).

```bash
python -m pip install -r requirements.txt
python webapp/app.py --puerto 8000
```

Abre `http://localhost:8000` (o doble clic en **`Ejecutar_web.bat`**). Sube uno
o varios archivos, mira el progreso en vivo, descarga el resultado (individual
o todos juntos en un `.zip`).

---

## 3. Qué genera (las tres versiones)

El archivo de salida es una copia del original **con todas sus hojas intactas**,
más la(s) hoja(s) nueva(s):

### Hoja `Resumen`

| FOLIO | CR | CONTCANTIDAD |
|---|---|---|
| 1 - 171 | 11801 | 171 |
| 172 - 713 | 50091 | 542 |
| 714 - 716 | 50301 | 3 |

- **CR**: cada centro de reparto encontrado, en el **orden en que aparece** en la base.
- **CONTCANTIDAD**: cuántas veces aparece.
- **FOLIO**: el rango de folios que le toca, encadenado sin huecos
  (`inicio = fin anterior + 1`, `fin = inicio + cantidad − 1`).

### Hoja `Graficas` (app de escritorio y `webapp/`)

- Indicadores: registros totales, CR distintos, promedio, CR mayor y menor,
  rango total de folios.
- **Gráfica de barras** con el Top 15 de CR (horizontal, para que se lean).
- **Gráfica de pastel** con el Top 10 + “Otros”.
- Barras de datos en la propia columna CONTCANTIDAD para ver a simple vista
  qué CR concentra más registros.

Se muestra sólo el Top para que las gráficas sean legibles: con 111 CR una
gráfica completa sería ilegible. Se ajusta en `config.json`
(`top_graficas`, `top_pastel`).

---

## 4. Casos que el programa maneja solo

| Situación | Qué hace |
|---|---|
| La columna está en otra posición | La busca en todas las columnas |
| La columna está en otra hoja | Recorre todas las hojas |
| El encabezado está en la fila 3, 4… | Revisa las primeras 10 filas |
| `PR CENTRO REPARTO`, `pr-centro-reparto`, con espacios de más | Los reconoce igual |
| CR numéricos, de texto, o con ceros a la izquierda (`007`) | Los respeta tal cual |
| Filas vacías intercaladas | Las ignora, no consumen folio |
| El archivo ya trae una hoja `Resumen` | La reemplaza (o la conserva, según `config.json`) y lo avisa |
| El nombre del archivo cambia cada mes | No importa, no depende del nombre |
| Archivo `.csv` en vez de `.xlsx` | Se detecta el separador (`,` `;` tab) y la codificación solas |
| Archivos grandes (50 000+ filas) | Probado y medido, sin degradar el resultado |
| El archivo de salida está abierto en Excel | Avisa que lo cierres; no genera basura |
| El archivo no tiene la columna | Muestra qué encabezados sí encontró |
| El Excel está dañado | Mensaje claro, el programa no se cierra |

Cuando algo falla **no se genera ningún archivo a medias**: primero se escribe un
temporal y sólo al final se renombra.

---

## 5. Instalación

### Si te pasaron el `.exe`

No hay que instalar nada. Copia la carpeta `ResumenCR` a donde quieras
(por ejemplo el Escritorio) y crea un acceso directo al `.exe`.

### Si vas a usar el código (escritorio o `webapp/`)

1. Instala Python 3.10 o superior desde <https://www.python.org/downloads/>
   marcando **“Add python.exe to PATH”**.
2. Doble clic en `Ejecutar.bat` (app de escritorio) o `Ejecutar_web.bat`
   (app web) — instalan las dependencias la primera vez si hace falta.

---

## 6. Generar el `.exe`

Doble clic en **`Compilar_exe.bat`**, o desde la terminal:

```bash
python -m pip install -r requirements.txt pyinstaller
python -m PyInstaller --noconfirm --clean ResumenCR.spec
```

Queda en `dist\ResumenCR\ResumenCR.exe`. Hay que copiar **toda la carpeta**
`dist\ResumenCR`, no sólo el `.exe`.

---

## 7. Uso desde la terminal

```bash
python procesar_cr.py                                  # ventana
python procesar_cr.py "archivo.xlsx"                   # ventana + procesa
python procesar_cr.py --consola "archivo.xlsx"         # sin ventana
python procesar_cr.py --consola --entrada              # toda la carpeta Entrada
python procesar_cr.py --consola --salida "D:\destino" "archivo.xlsx"

python webapp/app.py --puerto 8000                      # app web (produccion)
python webapp/app.py --puerto 8000 --debug              # app web (desarrollo)
```

---

## 8. Configuración (`config.json`)

| Clave | Para qué sirve |
|---|---|
| `columna_objetivo` | Nombre de la columna a contar (`pr_centro_reparto`) |
| `filas_busqueda_encabezado` | Cuántas filas se revisan buscando el encabezado |
| `nombre_hoja_resumen` / `nombre_hoja_graficas` | Nombres de las hojas generadas |
| `crear_hoja_graficas` | `false` para no generar gráficas |
| `si_existe_hoja_resumen` | `"reemplazar"` o `"renombrar"` |
| `encabezados` | Textos de las tres columnas |
| `separador_folio` | Separador del folio (`" - "`) |
| `sufijo_salida` | Texto que se añade al nombre del archivo |
| `carpeta_entrada` / `carpeta_salida` | Carpetas de trabajo |
| `guardar_junto_al_original` | `true` para guardar al lado del original |
| `sobrescribir_salida` | `false` (por defecto) añade `_1`, `_2`… |
| `mover_procesados` | `true` mueve el original a `Entrada/Procesados` |
| `top_graficas` / `top_pastel` | Cuántos CR se grafican |

Si `config.json` se borra o queda mal escrito, el programa sigue funcionando con los
valores por defecto y lo avisa. (La página web no lee `config.json`; usa el campo
"Columna a buscar" de sus Opciones avanzadas.)

---

## 9. Registro de errores

App de escritorio y `webapp/`: todo queda en **`logs/procesador.log`** (se rota
automáticamente, 4 archivos de 1 MB). Se abre con el botón **“Ver registro”**
de la ventana.

---

## 10. Pruebas

```bash
python -m unittest discover -s tests -t . -v
```

51 pruebas: normalización de encabezados, folios, columna en otra hoja/posición,
filas vacías, ceros a la izquierda, hoja `Resumen` preexistente, archivos dañados,
salida bloqueada, archivos grandes, entrada `.csv` (separador/codificación/ceros a
la izquierda), la app web de extremo a extremo (subir → procesar → descargar), y
una comparación **fila por fila** contra un Excel de ejemplo real.

La lógica en JavaScript de la página web (`docs/resumen.js`) se validó aparte,
en el navegador, contra los mismos 19 casos de `tests/test_nucleo.py`.

---

## 11. Estructura del proyecto

```
├── ResumenCR.exe            (en dist\ResumenCR tras compilar)
├── Ejecutar.bat             abrir la app de escritorio (o arrastrarle archivos)
├── Ejecutar_web.bat         abrir la app web con servidor propio
├── Compilar_exe.bat         generar el .exe
├── Ejecutar_pruebas.bat     correr las pruebas
├── procesar_cr.py           punto de entrada de la app de escritorio
├── config.json              ajustes (escritorio / webapp)
├── src/                     código compartido (nucleo, reporte, procesador, app…)
├── webapp/                  app web con servidor (Flask)
├── docs/                    página web sin servidor (GitHub Pages)
├── tests/                   pruebas automáticas
├── Entrada/  Salida/  logs/
└── .claude/skills/procesar-excel-cr/SKILL.md
```

---

## 12. Límites conocidos

- La página web (`docs/`) no genera gráficas nativas dentro del Excel ni colores
  en la hoja Resumen (limitación de la librería SheetJS Community, gratuita).
  Sí incluye vista previa de las gráficas en pantalla. Para el Excel con
  formato completo, usa la app de escritorio o `webapp/`.
- Sólo `.xlsx`, `.xlsm` y `.csv`. Para `.xls` (formato antiguo), ábrelo en
  Excel y guárdalo como `.xlsx`.
- Al copiar el original, se conservan hojas, datos, formatos e imágenes
  incrustadas (probado). Las tablas dinámicas y algunas macros/VBA de `.xlsm`
  no se preservan en la versión web del navegador (sí en la app de
  escritorio, que conserva el VBA de los `.xlsm`).
- Las fórmulas del original se conservan; para contar los CR se usa el
  **último valor calculado** que Excel guardó. Si un archivo se generó por
  programa y nunca se abrió en Excel, esas celdas pueden verse vacías.
- Un archivo de ~50 000 filas tarda cerca de 30-45 segundos en la app de
  escritorio o `webapp/`, y unos 15-20 segundos en la página web (corre en
  tu propia computadora, así que depende de qué tan rápida sea).
- La app web con servidor (`webapp/`) procesa cada archivo en un proceso
  aparte para aprovechar varios núcleos; el beneficio real de subir varios
  archivos a la vez depende del disco y CPU del servidor donde se levante.
- `webapp/` guarda temporalmente los archivos subidos en el propio servidor
  (carpeta `webapp/_trabajo/`, se limpia sola after 6 horas) — pensada para
  una red interna de confianza, no para exponerse directo a internet.
