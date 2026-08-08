# Resumen CR

## Producto actual

La aplicación activa es Node/TypeScript con una interfaz estática en `docs/`.
El servidor Express opcional sirve esa misma carpeta; `webapp/` es legado y no
es una segunda aplicación que deba editarse.

## Ejecutar

```powershell
npm.cmd install
npm.cmd test
npm.cmd run build
npm.cmd start
```

## Límites del dominio — no romper

1. Los CR van en orden de primera aparición, nunca ordenados.
2. El folio final coincide con el total de registros válidos.
3. Las filas vacías no consumen folio.
4. `"007"` y `7` son CR distintos; el primero se conserva como texto.
5. El Excel de entrada nunca se sobrescribe.
6. `Resumen` contiene sólo `FOLIO`, `CR`, `CONTCANTIDAD`; no agregar totales.
7. Las etiquetas usan lotes de 3,000 folios, cinco dígitos para folios y tres
   para caja; ATM y OT se extraen del nombre como sugerencia editable.

## Arquitectura

| Archivo | Responsabilidad |
|---|---|
| `src/core.ts` | Cálculo y orquestación en Node. |
| `docs/resumen.js` | Puerto manual del cálculo para navegador. |
| `docs/worker.js` | Worker de navegador. |
| `docs/excel_generator.js` | Reporte Excel con `Resumen` y `Dashboard`. |
| `docs/app.js` | UI, vista previa y PDF de etiquetas. |
| `server.ts` | Cargas y descargas opcionales en Express. |

`src/core.ts` y `docs/resumen.js` duplican la lógica a propósito. Si una regla
de conteo cambia, actualizar ambas y demostrar paridad. Cambios visuales,
seguridad, documentación o etiquetas no deben modificar su cálculo.

## Seguridad y calidad

- `docs/` es la única interfaz canónica.
- No interpolar valores del archivo Excel ni nombres de archivo con `innerHTML`.
- Mantener límites de carga, IDs criptográficamente seguros y limpieza de
  trabajos temporales en el servidor.
- Antes de cerrar una modificación: `npm.cmd test`, `npm.cmd run build` y una
  prueba de salida real. Nunca declarar éxito sin evidencia reciente.
