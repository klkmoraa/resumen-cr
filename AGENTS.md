# Resumen CR

## Que hace

Convierte un Excel de produccion en un Excel **nuevo** que conserva todas las hojas
originales y agrega:

- Hoja `Resumen` con `FOLIO` / `CR` / `CONTCANTIDAD`, contando las apariciones de la
  columna `pr_centro_reparto` **en orden de primera aparicion** (no ordenado) y
  encadenando folios (`1 - 171`, `172 - 713`, ...).
- Hoja `Graficas` con indicadores, un Top 15 en barras y un pastel Top 10 + "Otros".

El archivo original nunca se modifica.

## Instalar dependencias

```bash
python -m pip install -r requirements.txt
```

Unica dependencia: `openpyxl`. `tkinter` viene con Python.

## Ejecutar el programa

```bash
python procesar_cr.py                                  # ventana grafica
python procesar_cr.py "archivo.xlsx"                   # ventana + procesa ese archivo
python procesar_cr.py --consola "archivo.xlsx"         # sin ventana
python procesar_cr.py --consola --entrada              # procesa la carpeta Entrada
python procesar_cr.py --consola --salida "C:\destino" "archivo.xlsx"

python webapp/app.py --puerto 8000                      # app web con servidor (Flask)
```

Para el usuario final: doble clic en `Ejecutar.bat` (escritorio) o `Ejecutar_web.bat`
(web), o arrastrar los archivos sobre el .bat/.exe. La pagina sin servidor
(`docs/`, publicada en GitHub Pages) no requiere nada instalado.

## Ejecutar las pruebas

```bash
python -m unittest discover -s tests -t . -v
```

O doble clic en `Ejecutar_pruebas.bat`. `tests/test_referencia.py` compara fila por
fila contra el archivo `LISTADOS ...xlsx` de ejemplo (se salta si no esta presente).

## Compilar el ejecutable

```bash
python -m pip install pyinstaller
python -m PyInstaller --noconfirm --clean ResumenCR.spec
```

O doble clic en `Compilar_exe.bat`. Resultado: `dist/ResumenCR/ResumenCR.exe`
(la carpeta completa es lo que se distribuye).

## Usar la skill

```
/procesar-excel-cr ruta-del-archivo.xlsx
```

Definida en `.Codex/skills/procesar-excel-cr/SKILL.md`. Procesa el archivo, valida
el resultado, informa donde quedo y sabe diagnosticar/reparar el proyecto si falla.

## Mapa del codigo

| Archivo | Responsabilidad |
|---|---|
| `src/nucleo.py` | Normalizacion de encabezados, busqueda de la columna, conteo, folios. Logica pura. |
| `src/entrada.py` | Convierte `.csv` a un `.xlsx` temporal de una hoja antes de procesarlo. |
| `src/reporte.py` | Escribe el Excel de salida (formato, graficas, barras de datos, guardado atomico). |
| `src/procesador.py` | Orquestador; convierte errores en `Resultado` legible. |
| `src/app.py` | Ventana Tkinter (app de escritorio). |
| `src/config.py` | Carga `config.json` con valores por defecto. |
| `src/registro.py` | Log rotativo en `logs/procesador.log`. |
| `procesar_cr.py` | Punto de entrada de la app de escritorio (ventana o consola). |
| `webapp/app.py` | Servidor Flask: sube archivos, los procesa en un proceso aparte (`ProcessPoolExecutor`), permite descargar. |
| `docs/resumen.js` | **Puerto a JavaScript** de `src/nucleo.py`, para la pagina sin servidor (GitHub Pages). |
| `docs/worker.js` | Web Worker que corre `docs/resumen.js` sin congelar la pestaña. |
| `config.json` | Ajustes: columna buscada, nombres de hoja, carpetas, tamano de graficas. |

## Reglas del dominio (no romper)

1. Orden de los CR = **primera aparicion**, jamas `sorted()`.
2. `fin` de la ultima fila == total de registros.
3. Filas vacias no consumen folio.
4. CR de texto se conservan tal cual (`"007"` != `7`), con formato de celda `@`.
5. Nunca escribir sobre el archivo original; guardado siempre a temporal + `os.replace`.
6. Nada de filas extra (totales) dentro de `Resumen`.

## Importante: la logica esta DUPLICADA a proposito

`docs/resumen.js` es un puerto manual de `src/nucleo.py` (no se genera ni se
comparte codigo entre Python y JavaScript). **Si corriges un bug o cambias una
regla en `src/nucleo.py`, hay que replicar el cambio en `docs/resumen.js`** y
volver a validarlo en el navegador (ver la seccion de pruebas del JS en
`.Codex/skills/procesar-excel-cr/SKILL.md`). Si no se hace, la pagina web y
las apps de escritorio/servidor van a dar resultados distintos.
