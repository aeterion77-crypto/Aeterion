# Aeterion Coaches — construcción aislada

Todo vive en la rama `coaches`. `main` (lo que está publicado) no tiene nada de esto.

## Qué hay

| Parte | Archivo | Estado |
| --- | --- | --- |
| Base de datos (tablas, reglas, funciones) | `coach/sql/001_coaches.sql` | Probada en Postgres local · NO aplicada a producción |
| Documentos privados (almacenamiento) | `coach/sql/002_coach_documentos_storage.sql` | Probada en local · NO aplicada |
| App: directorio, perfil, permisos, panel del coach, sesiones, comisiones | `coach.js` + cambios pequeños en `index.html` | Probada de punta a punta |
| Admin: Premium › Coaches | `admin/coach-admin.js` + cambios pequeños en `admin/index.html` | Probada de punta a punta |
| Pagos con Stripe (inscripción, mensualidad, sesiones, cuenta de cobro) | función `coach-pagos` + webhook | **Pendiente** (necesita activar Stripe Connect) |

## Seguridad del diseño

- Solo objetos nuevos (prefijo `coach_`). No cambia tablas ni funciones existentes.
- Única escritura fuera de lo nuevo: filas en `accesos` con `origen = 'coach'` (Premium personal del coach).
- Interruptor general `coach_config.activo = false`: nadie ve nada salvo admins y testers.
- El coach solo ve las categorías que su cliente autoriza; Mente siempre apagada por defecto.
- Los usuarios no pueden escribir directo en las tablas; todo pasa por funciones que validan.

## Pruebas

```
cd coach/pruebas && npm install
node prueba_sql.js        # 83 pruebas de base de datos
node prueba_storage.js    # 6 pruebas de documentos privados
python3 prueba_app.py     # 29 revisiones de la app con la base real local
python3 prueba_admin.py   # 12 revisiones del panel de admin
```

## Integrar (solo con permiso del dueño)

1. Aplicar `001` y `002` en Supabase (crea objetos nuevos; con el interruptor apagado nadie ve cambios).
2. Unir la rama `coaches` a `main` (sube `sw.js` a la siguiente versión de caché).
3. Agregar 2–3 testers desde Admin › Premium › Coaches y probar en teléfonos reales.
4. Con Stripe Connect listo: desplegar `coach-pagos` y el webhook, programar las tareas diarias
   `coach_procesar_comisiones()` y `coach_revisar_membresias()`.
5. Piloto con 5–10 coaches y luego encender para todos.

Para deshacer: apagar el interruptor (inmediato). Las tablas nuevas pueden quedarse sin afectar nada.

## Aeterion Gym (005)
- `coach/sql/005_gym.sql` (aplicada en producción como `gym_005`): gimnasios, sedes, equipo por rol, planes, socios, pagos registrados, asistencias.
- App: `gym.js` (pantalla `app-screen-gym`; tarjetas «Aeterion Gym» para staff y «Mi gimnasio» para socios; enlace `?socio=CODIGO`).
- Recepción en computadora: `gym/index.html` (entra con código por correo).
- Admin: Premium › Aeterion Gym (`admin/gym-admin.js`).
- Pruebas: `node pruebas/prueba_gym.js` y `python3 pruebas/prueba_gym_app.py`.

## Gym v2 (006) y Coach v3 (007) — aplicadas en producción (`gym_006_pos`, `coaches_007_v3`)
- Gym: foto del socio, pagos parciales y abonos, punto de venta (`gym-pos.js`), inventario, tickets 58/80 mm, historial y cancelación, reportes con gráficas, Excel (`vendor/xlsx.mini.min.js`, SheetJS 0.18.5, Apache-2.0) y PDF, respaldo, ajustes del ticket, solicitud de mayoreo.
- Coach: `coach-extra.js` — calendario, alimentación (solo con `coaches.puede_nutricion`, lo autoriza el admin), evaluación mutua, casos para Aeterion (`aet_casos`), bloqueos, vender productos (`?ref=CODIGO`), más material. El alumno ve la sugerencia de su coach en Entrenar y Nutrición sin perder lo de la app.
- Admin: Soporte › Reportes y casos (`admin/casos-admin.js`); Coaches › autorizar planes de alimentación.
- Pruebas: `prueba_gym_pos.js`, `prueba_coach_v3.js`, `prueba_gym_pos_app.py`, `prueba_espacio_app.py` (sección 7).

## 2026-10-28 · Coaches retirado
Se quitó todo lo de coaches de la app y del panel (coach.js, coach-espacio.js, coach-extra.js, admin/coach-admin.js y sus pruebas de pantalla).
El código queda en el historial de git (commit e581ba7). Las tablas y funciones de coaches siguen en la base, apagadas (coach_config.activo = false) y sin pantallas.
Se conservan: Aeterion Gym completo y «Reportes y casos» (lo usa la solicitud de mayoreo de los gimnasios).
