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
- [ ] Revocar el token de acceso de Supabase compartido en el chat y generar otro (solo tú puedes).
- [x] Registro por invitación (19 sep): `signup_allowlist` + disparador en auth.users; desde /amigos se
      invita por correo. Un correo no invitado recibe un mensaje claro.
- [x] Productos caducados ocultos (19 sep): las búsquedas y los cálculos solo usan lo visto por la
      ingesta en los últimos tres días.
- [x] Rediseño pendiente (19 sep): Favoritos (ahora también con recetas guardadas), login y la
      pantalla de menú a lista ya usan el estilo actual.
- [x] Carga, error y tests (19 sep): esqueleto de carga, pantalla de error y 404 propios; 12 tests de
      la lógica delicada (menú, lector de recetas, planes, nutrición, búsqueda) en cada push.
- [x] Zona horaria (19 sep): la semana se calcula en horario español, no en UTC.
- [x] Preferencias (19 sep): los objetivos ya influyen en el menú generado; desayunos, meriendas y
      notificaciones avisan en pantalla de que todavía no están.

## Hecho
- 15 sep: esqueleto, ingesta diaria, login, buscador, lista, PWA, menú semanal, despliegue.
- 15–18 sep: rediseño completo (portada, lista, menú, buscador, producto, receta, configuración,
  onboarding de 7 pasos en móvil y escritorio), ofertas, histórico de precios en la ficha.
- 19 sep: banco de recetas, amigos, y recetas de amigos en el generador (todas o solo guardadas).
- 19 sep: menú realista (sesiones de cocina, sobras, "como fuera"), despensa y básicos, presupuesto,
  plan de compra con opciones, lista usable en tienda (sin cobertura), 26 recetas de estudiante y
  "pegar receta", equivalencias de opencesta, aviso de zona, histórico, hábitos, fotos, piso
  compartido, registro por invitación, carga y error, tests y comprobaciones automáticas.

## F. Lo que faltaba (19 sep, tarde)
- [x] Nada escondido en el móvil: la barra inferior tiene un botón "Más" con Amigos, Despensa,
      Favoritos, Supermercados, Histórico, Configuración y Ayuda. Antes solo se llegaba a ellas
      desde la barra lateral del ordenador, y ninguna de las dos personas que la usan había
      tocado la despensa ni los básicos.
- [x] El histórico de precios deja de crecer sin freno: `prune_price_history` guarda el detalle
      diario de los últimos 120 días y una foto por semana del resto. Lo llama la ingesta cada día.
      Sin esto eran ~10.000 filas diarias contra los 500 MB del plan gratuito.
- [x] Permisos: `handle_new_user`, `check_signup_allowed` y `rls_auto_enable` ya no se pueden llamar
      desde el cliente (solo las usa un disparador), y `immutable_unaccent` tiene search_path fijo.
      Comprobado que el alta y la lista de invitados siguen funcionando.
- [x] Tus datos son tuyos: en Ajustes puedes descargar en JSON todo lo que guardamos y borrar la
      cuenta escribiendo BORRAR. Borrar se lleva perfil, recetas, menús, listas, despensa, amistades
      y las fotos subidas, y libera tu correo por si quieres volver.
- [x] Registro de errores: cuando una pantalla falla se apunta en `app_errors` (ruta y mensaje) para
      poder mirarlo. Se limpia sola a los 30 días.
- [x] "Cuscús" ya encuentra producto: los supermercados lo escriben "Cous cous". Hay una tabla de
      grafías en `lib/search.ts`. Con esto los 61 ingredientes de las recetas tienen producto.

## G. ¿Qué cocino hoy? (21 sep)
Idea de Marta: decir qué tienes en la nevera y cuánto quieres gastar, y que salga la receta que
mejor encaja.
- [x] Versión sin IA en `/cocinar`: marcas ingredientes (es la misma despensa), pones un tope de
      gasto y las recetas se ordenan: primero las que puedes hacer ya, luego las que menos piden
      comprar, con el precio real de los envases que faltan. Un botón manda lo que falta a la lista.
      Respeta dieta y alergias. La lógica está en `lib/cook.ts`, con tests.
- [x] Accesos: tarjeta en la portada, barra lateral y panel "Más" del móvil.
- [x] "Pan" ya propone una barra de pan y no pan rallado.
- [ ] Fase con IA, solo si hace falta: inventar recetas cuando nada del banco encaja. Tiene coste
      por uso, así que se activaría solo para correos concretos. Antes, mirar con datos reales
      cuántas veces la versión sin IA no propone nada útil.

## Pendiente, decidido a propósito
- Las extensiones `pg_trgm` y `unaccent` siguen en el esquema `public`. Moverlas rompería la columna
  generada `products.name_norm`, que es de lo que vive el buscador.
- La protección de contraseñas filtradas sigue desactivada: aquí no hay contraseñas, se entra por
  enlace o código.

## Lo único que queda en tus manos
1. Revocar en Supabase el token de acceso que compartiste en el chat (Account → Access Tokens).
2. Punto 4: crear una cuenta gratuita en Resend o Brevo y ejecutar `scripts/setup_email.ts`;
   después añadir `NEXT_PUBLIC_LOGIN_CODE=1` en Vercel. Eso activa el acceso con código de 6
   dígitos, quita el límite de 2 correos por hora y permite el recordatorio del domingo.
