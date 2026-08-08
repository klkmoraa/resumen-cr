# Diseño: etiquetas con tipografía ampliada

## Objetivo

Mejorar la lectura del PDF de etiquetas de cajas sin cambiar el tamaño carta
horizontal, el orden de los datos ni el cálculo de folios y cajas.

## Diseño aprobado

- Conservar el fondo blanco, la impresión en negro y el doble marco exterior.
- Eliminar las tres líneas horizontales divisorias.
- Conservar este orden exacto:
  1. Primer renglón editable.
  2. Segundo renglón editable.
  3. Remesa editable.
  4. `CENTRO DE REPARTO` y OT en el mismo renglón.
  5. `FOLIO`.
  6. Rango de folios.
  7. Número de caja y total de cajas.
- Usar estos tamaños exactos: primer renglón 34 pt, segundo renglón
  25 pt, Remesa 28 pt, Centro de reparto y OT 18 pt, `FOLIO` 17 pt, rango
  32 pt y caja 40 pt.
- Mantener todo centrado y en negritas para aprovechar el espacio disponible.

## Alcance técnico

El cambio se limita a `dibujarEtiquetaCaja` en `docs/app.js`, a la versión de
caché de ese archivo en `docs/index.html` y a las pruebas del PDF de etiquetas.
No se modificarán `src/core.ts`, `docs/resumen.js`, `docs/worker.js` ni
`docs/excel_generator.js`.

## Datos y comportamiento

Los datos continuarán entrando al dibujo con la misma estructura. Los folios
seguirán usando cinco dígitos y las cajas tres dígitos. La paginación seguirá
siendo una caja por hoja carta horizontal y los lotes seguirán siendo de 3,000
folios.

## Verificación

- Una prueba automatizada exigirá cero líneas horizontales dentro de la
  etiqueta, conservará el orden de los siete textos y comprobará los tamaños
  mínimos aprobados.
- Se ejecutarán todas las pruebas y la compilación.
- Se generará un PDF real y se renderizará su primera página para comprobar que
  no existan recortes, solapamientos ni cambios de orden.
- La publicación se verificará directamente en GitHub Pages.
