# Resumen CR

Aplicación web para convertir un Excel o CSV de producción en un reporte nuevo
con el resumen por Centro de Reparto y sus gráficas. El archivo de entrada nunca
se modifica.

## Entregables

- Excel `*_REPORTE_CR.xlsx` con las hojas `Resumen` y `Dashboard`.
- PDF de etiquetas por caja desde la vista previa. Cada caja agrupa hasta 3,000
  folios, en carta horizontal: `00001 AL 03000`, caja `001`; la última usa el
  folio final real.

El usuario captura los dos renglones de nombre. ATM y OT se proponen desde el
nombre del archivo, pero siempre se pueden corregir antes de generar el PDF.

## Regla de negocio protegida

La columna buscada por defecto es `pr_centro_reparto`. Los CR se cuentan en su
orden de primera aparición; las filas vacías no consumen folio; los rangos son
continuos y un CR de texto conserva sus ceros a la izquierda. No se ordenan los
CR ni se altera esa lógica al hacer cambios visuales, de seguridad o de formato.

## Uso

### Página estática

Abra `docs/index.html` desde la publicación de GitHub Pages. El procesamiento
ocurre en el navegador; para generar PDFs se requiere conexión inicial para
cargar jsPDF desde su CDN.

### Servidor local

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

Abra `http://localhost:3000`. El servidor sirve la misma interfaz de `docs/` y
acepta hasta 10 archivos por solicitud, con máximo de 300 MB por archivo.

## Desarrollo y verificación

```powershell
npm.cmd test
npm.cmd run build
node --check docs/app.js
```

La prueba de regresión debe incluir un Excel con CR repetidos, CR de texto,
filas vacías y un caso de 51,827 folios. Para ese último, el PDF debe tener 18
etiquetas y terminar en `51001 AL 51827`, caja `018`.

## Estructura actual

| Ruta | Responsabilidad |
|---|---|
| `src/core.ts` | Normalización, conteo y folios. Lógica protegida. |
| `docs/resumen.js` | Equivalente de cálculo para el navegador. |
| `docs/worker.js` | Procesamiento en segundo plano en el navegador. |
| `docs/excel_generator.js` | Libro `Resumen` y `Dashboard` con gráficas. |
| `docs/app.js` | Interfaz, vista previa y PDF de etiquetas. |
| `server.ts` | Servidor Express opcional para uso local/controlado. |

No hay aplicación Python/Flask ni ejecutable de escritorio activos en esta
versión. Cualquier cambio al cálculo debe actualizar tanto `src/core.ts` como
`docs/resumen.js` y demostrar paridad con pruebas.
