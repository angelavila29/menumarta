# Hoja de ruta de Sobremesa

Objetivo: que un estudiante que vive solo o en piso compartido la use de verdad cada semana
para decidir qué cocina, qué compra y cuánto le cuesta. Todo con servicios gratuitos.

Se ataca por orden. Al terminar un punto se marca aquí y se anota la fecha.

## Datos de partida (19 sep 2026)
- Dos usuarios reales, los dos viven solos. Nadie ha tachado aún un producto en una tienda.
- Una semana generada para 1 persona tenía 14 platos distintos y 40 ingredientes distintos.
- 8 de 30 recetas son de 20 minutos o menos; 6 están marcadas como económicas.
- Precios solo de Mercadona (zona Madrid) y Dia. Una usuaria vive en Cáceres.

## A. Plan semanal realista (el corazón)
- [x] 1. Menú para una persona (19 sep): cocinar N veces por semana, sobras y táper repartidos en
      los días siguientes (misma comida, máximo 3 raciones y 3 días), y huecos "como fuera" que el
      generador respeta. Por defecto 6 veces si vives solo o en pareja. Se ajusta en "Ajustes del menú".
- [x] 2. Despensa y básicos (19 sep): página /despensa con lo que ya tengo (no se compra) y mis
      básicos de cada semana (entran solos al organizar la compra).
- [x] 3. Presupuesto de verdad (19 sep): coste estimado de la semana en el menú y barra frente al
      presupuesto al organizar la compra. El generador premia ingredientes compartidos y, según
      objetivos, recetas económicas, rápidas o sanas (22,2 ingredientes de media frente a 24,6).

## B. Uso real en el móvil
- [ ] 4. Acceso sin fricción: PREPARADO (19 sep), falta un paso del dueño. Supabase no deja cambiar la
      plantilla del correo sin servidor de correo propio. Ya están: pantalla de acceso con código
      (se activa con `NEXT_PUBLIC_LOGIN_CODE=1`), plantilla `supabase/email_code.html` y el script
      `scripts/setup_email.ts`. Falta: crear cuenta gratuita en Resend o Brevo y ejecutar el script.
- [x] 5. Lista dentro del supermercado (19 sep): tachar es instantáneo (38 ms), sin cobertura se guarda
      en el móvil y se envía al volver; service worker para abrir la lista sin red; lo pendiente
      arriba y ordenado por familias.

## C. Contenido y datos
- [x] 6. Recetas de estudiante (19 sep): 26 recetas nuevas (56 en total; de 8 a 25 de 20 minutos o
      menos, de 6 a 21 económicas, 31 de táper), filtros en el banco y "Pegar receta" que rellena
      el formulario a partir de texto (`lib/recipe-parse.ts`).
- [x] 7. Zona honesta (19 sep): el buscador y la ficha avisan de que los precios de Mercadona son de
      la zona de Madrid. Queda pendiente, fuera de nuestro control: más cadenas y más zonas cuando
      opencesta las publique (hoy solo vlc1, mad1, bcn1, alc1 y Dia).
- [x] 8. Emparejamiento fiable (19 sep): la ingesta carga a diario `equivalences.jsonl` (505 pares) en
      `product_equivalences`; las comparaciones lo usan primero (puntuación de 0,5 o más) y solo
      después la aproximación por nombre.
- [x] 9. Plan de compra con opciones (19 sep): todo en cada cadena o repartido, con total, recomendado
      según `compare_mode` y `main_supermarket`. Pantalla "Organizar la compra" rediseñada.
      La ingesta deduce el precio por unidad del tamaño cuando falta (de 449 productos sin él a 1).

## D. Social y hábito
- [x] 10. Piso compartido (19 sep): comparte tu lista con un amigo desde /lista; todos añaden y
      tachan, y se muestra el gasto a partes iguales. Cada miembro puede salirse.
- [x] 11. Hábito (19 sep): "Repetir semana anterior" y marcar cada plato como cocinado o comido.
      El recordatorio del domingo depende del correo propio (punto 4).
- [x] 12. Fotos en las recetas (19 sep): se reducen a 1200 px en el móvil antes de subirlas al
      almacenamiento de Supabase; cada persona solo escribe en su carpeta.
- [x] 13. Histórico (19 sep): /historico con lo que más ha bajado y subido, tus favoritos y tu lista,
      y variación media. Excluye cambios de más del 60 % (suelen ser cambio de formato).

## E. Mantenimiento
- [ ] Revocar el token de acceso de Supabase compartido en el chat y generar otro.
- [ ] Cerrar el registro abierto o limitarlo a una lista de correos.
- [ ] Ocultar productos que llevan días sin actualizarse.
- [ ] Rediseñar Favoritos, login y la revisión menú → lista (siguen con el estilo antiguo).
- [ ] Pantallas de carga y de error; tests de lo esencial.
- [ ] La semana actual se calcula mal entre las 00:00 y las 02:00 por la zona horaria del servidor.
- [ ] Preferencias que se guardan y no hacen nada: objetivos, desayunos y meriendas, notificaciones.

## Hecho
- 15 sep: esqueleto, ingesta diaria, login, buscador, lista, PWA, menú semanal, despliegue.
- 15–18 sep: rediseño completo (portada, lista, menú, buscador, producto, receta, configuración,
  onboarding de 7 pasos en móvil y escritorio), ofertas, histórico de precios en la ficha.
- 19 sep: banco de recetas, amigos, y recetas de amigos en el generador (todas o solo guardadas).
