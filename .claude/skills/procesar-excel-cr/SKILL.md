---
name: procesar-excel-cr
description: Convierte un Excel de produccion en un Excel con hoja "Resumen" (FOLIO / CR / CONTCANTIDAD) contando la columna pr_centro_reparto, con formato y graficas. Usar cuando el usuario escriba /procesar-excel-cr, pida "generar el listado de CR", "hacer el resumen por centro de reparto", "contar los CR de este Excel", o entregue un Excel de produccion para resumir. Tambien sirve para diagnosticar y reparar el proyecto si la aplicacion ResumenCR falla.
---

# procesar-excel-cr

Genera el listado por **Centro de Reparto (CR)** a partir de un Excel de produccion.

## Invocacion

```
/procesar-excel-cr ruta-del-archivo.xlsx
```

Si no se recibe ruta: buscar archivos `.xlsx` / `.xlsm` en `Entrada/` y, si tampoco
hay, en la raiz del proyecto. Si hay varios candidatos, listarlos y preguntar cual.
Si el usuario adjunto o menciono un archivo en el mensaje, usar ese.

---

## 1. Que hay que producir (contrato de datos)

Un archivo **nuevo** (nunca sobrescribir el original) que contiene **todas las hojas
del original intactas** mas:

- Hoja `Resumen` con exactamente tres columnas:

  | FOLIO | CR | CONTCANTIDAD |
  |-------|----|--------------|
  | `1 - 171` | `11801` | `171` |
  | `172 - 713` | `50091` | `542` |

- Hoja `Graficas` con indicadores + grafica de barras (Top 15) + grafica de pastel
  (Top 10 + "Otros").

Reglas **no negociables** del calculo:

1. Se lee la columna cuyo encabezado, normalizado, es `pr_centro_reparto`.
   Normalizar = minusculas, sin acentos, sin espacios sobrantes, y cualquier
   separador (espacio, guion, punto) convertido a `_`.
   Por eso `" PR CENTRO REPARTO "` y `pr-centro-reparto` tambien coinciden.
2. La columna puede estar en **cualquier hoja**, en **cualquier posicion** y en
   cualquiera de las **primeras 10 filas** (hay archivos con filas de titulo).
3. Se cuenta cuantas veces aparece cada CR.
4. **El orden es el de primera aparicion en el archivo original, NO alfabetico ni
   numerico.** Esto es lo que mas facilmente se rompe: en el archivo de ejemplo el
   ultimo CR es `7501`, que es numericamente el mas chico.
5. Folios encadenados:
   ```
   inicio = 1
   fin    = inicio + cantidad - 1
   FOLIO  = "{inicio} - {fin}"     (con espacios alrededor del guion)
   inicio siguiente = fin + 1
   ```
   El `fin` de la ultima fila debe ser igual al total de registros.
6. Filas vacias o con el CR vacio se ignoran (no consumen folio).
7. Los CR de texto conservan su forma: `"007"` no es lo mismo que `7`, y se escribe
   con formato de celda `@` para que Excel no le quite los ceros.
8. Un CR numerico guardado como flotante entero (`11801.0`) cuenta igual que `11801`.

---

## 2. Como ejecutarlo (reutilizar el codigo del proyecto, no reescribirlo)

El proyecto ya tiene toda la logica probada. **No dupliques la logica en un script
nuevo.** Ejecuta:

```bash
python procesar_cr.py --consola "ruta/del/archivo.xlsx"
```

Opciones utiles:

```bash
python procesar_cr.py --consola --salida "C:\ruta\destino" "archivo.xlsx"
python procesar_cr.py --consola --entrada          # procesa toda la carpeta Entrada
python procesar_cr.py                              # abre la ventana grafica
```

Desde Python, si necesitas los datos en memoria:

```python
from src.config import cargar_config
from src.nucleo import analizar_excel          # solo calcula, no escribe
from src.procesador import procesar_archivo    # calcula y genera el Excel

cfg = cargar_config()
resultado = procesar_archivo("archivo.xlsx", cfg)   # nunca lanza excepciones
resultado.ok, resultado.salida, resultado.mensaje
```

Mapa del codigo:

| Archivo | Responsabilidad |
|---|---|
| `src/nucleo.py` | Normalizacion, busqueda de la columna, conteo y folios. Sin efectos secundarios. |
| `src/entrada.py` | Convierte `.csv` a un `.xlsx` temporal de una hoja antes de procesarlo. |
| `src/reporte.py` | Escribe el Excel de salida: hoja Resumen con formato, hoja Graficas, guardado atomico. |
| `src/procesador.py` | Orquesta todo y convierte cualquier error en un `Resultado` con mensaje legible. |
| `src/app.py` | Ventana Tkinter (app de escritorio). |
| `src/config.py` | Lee `config.json` (con valores por defecto si falta o esta roto). |
| `src/registro.py` | Log rotativo en `logs/procesador.log`. |
| `procesar_cr.py` | Punto de entrada de la app de escritorio (ventana o consola). |
| `webapp/app.py` + `webapp/static/*` + `webapp/templates/*` | App web con servidor Flask; procesa cada archivo en un proceso aparte. |
| `docs/resumen.js` + `docs/worker.js` + `docs/index.html` | Pagina 100% navegador (GitHub Pages), sin servidor. **Puerto manual** de `src/nucleo.py` a JavaScript — ver aviso abajo. |

**Si tocas `src/nucleo.py`** (la logica de normalizacion/conteo/folios), replica
el cambio en `docs/resumen.js` (mismo archivo, mismo comentario al inicio) y
vuelve a validarlo en el navegador: abre `docs/index.html` con un servidor
estatico local (`python -m http.server` dentro de `docs/`), y desde la consola
del navegador corre los mismos casos que `tests/test_nucleo.py` contra
`ResumenCR.calcularResumen(...)`. Sin esto, la pagina web y las apps de
escritorio/servidor pueden dar resultados distintos ante el mismo archivo.

---

## 3. Validar SIEMPRE antes de reportar exito

No basta con que el comando termine. Verifica el archivo generado:

```python
import openpyxl
wb = openpyxl.load_workbook(ruta_salida, data_only=True)
filas = [f for f in wb["Resumen"].iter_rows(values_only=True)][1:]

assert [c.value for c in wb["Resumen"][1]] == ["FOLIO", "CR", "CONTCANTIDAD"]
assert len({f[1] for f in filas}) == len(filas)              # no hay CR repetidos
assert sum(f[2] for f in filas) == int(filas[-1][0].split(" - ")[1])  # folios cuadran
esperado = 1
for folio, cr, cant in filas:                                 # cadena sin huecos
    ini, fin = (int(x) for x in folio.split(" - "))
    assert ini == esperado and fin == ini + cant - 1
    esperado = fin + 1
```

Ademas confirma que las hojas del original siguen presentes en la salida y que el
archivo original conserva su tamano y fecha (no se toco).

Si existe el archivo de ejemplo `LISTADOS ...xlsx`, la prueba de regresion ya
compara fila por fila:

```bash
python -m unittest tests.test_referencia -v
```

Suite completa (37 pruebas):

```bash
python -m unittest discover -s tests -t . -v
```

---

## 4. Informar al usuario

Al terminar, decir en lenguaje claro:

- Ruta completa del archivo generado.
- Cuantos registros y cuantos CR distintos se encontraron.
- En que hoja y columna se hallo `pr_centro_reparto`.
- Cualquier aviso (por ejemplo: "el archivo ya tenia una hoja Resumen y se reemplazo").

---

## 5. Diagnosticar y reparar si la aplicacion falla

Sigue este orden y **arregla la causa, no el sintoma**:

1. **Leer el registro**: `logs/procesador.log` (las ultimas lineas traen el traceback).
2. **Reproducir en consola**, que muestra el error completo:
   `python procesar_cr.py --consola "archivo.xlsx"`
3. **Aislar**: si `analizar_excel` funciona pero `procesar_archivo` no, el problema
   esta en `src/reporte.py` (escritura/graficas), no en la logica de conteo.
4. **Errores tipicos y su causa real**:

   | Sintoma | Causa / arreglo |
   |---|---|
   | `ModuleNotFoundError: openpyxl` | `python -m pip install -r requirements.txt` |
   | "no tiene la columna pr_centro_reparto" | El encabezado real es otro: revisar los encabezados que imprime el mensaje y ajustar `columna_objetivo` en `config.json`, o subir `filas_busqueda_encabezado` si el titulo esta mas abajo de la fila 10. |
   | "esta abierto en Excel" | Cerrar el archivo. Es una validacion correcta, no un bug. |
   | El resumen sale ordenado de menor a mayor | Se rompio el orden de primera aparicion: el conteo debe usar un `dict` en orden de insercion (ver `analizar_excel`), nunca `sorted()`. |
   | Excel pide "reparar" el archivo | Suele ser una referencia de grafica invalida en `src/reporte.py`. Probar con `crear_hoja_graficas: false` en `config.json` para confirmar el origen. |
   | La ventana no abre | Falta Tk: probar `python -c "import tkinter"`. Mientras tanto, usar el modo `--consola`. |
   | El .exe no arranca | Recompilar con `Compilar_exe.bat` y revisar `build/ResumenCR/warn-ResumenCR.txt`. |

5. **Despues de cualquier cambio en el codigo, correr la suite completa** y volver a
   procesar el archivo del usuario. No declarar el arreglo terminado sin la salida
   de las pruebas.
6. Si se toca `src/reporte.py`, verificar tambien que el Excel abre sin aviso de
   reparacion (volver a cargarlo con `openpyxl.load_workbook`).

---

## 6. Cosas que NO hay que hacer

- No sobrescribir ni mover el archivo original.
- No ordenar los CR.
- No convertir a numero los CR que vienen como texto (se pierden los ceros).
- No agregar filas extra (totales, subtotales) dentro de la hoja `Resumen`: los datos
  deben coincidir exactamente con el formato acordado. Los totales van en `Graficas`.
- No escribir un script paralelo que reimplemente el conteo; usar `src/`.
- No dejar archivos `*.__tmp__.*` si algo falla.
