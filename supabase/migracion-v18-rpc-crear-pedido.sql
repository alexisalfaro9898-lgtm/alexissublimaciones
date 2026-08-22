-- ============================================================
-- FASE 12: crear_pedido() — creación de pedido transaccional
-- Reemplaza los INSERT secuenciales de crearPedido() (pedidos.js).
-- UNA sola transacción: valida todo, crea pedido + detalles +
-- personalizaciones + respuestas + historial. Cualquier fallo
-- revierte TODO (sin huérfanos).
--
-- NO descuenta stock (solo valida disponibilidad e informa).
-- NO toca productos.stock / producto_variantes.stock /
-- precio_costo / precios de venta / proveedores.
--
-- Los archivos (Storage) NO van dentro de PostgreSQL: la RPC
-- devuelve {pedido, detalles, stock} y el frontend sube las
-- imágenes después usando pedido.id y detalle.id reales.
-- ============================================================

CREATE OR REPLACE FUNCTION public.crear_pedido(
  p_cliente_nombre text,
  p_cliente_telefono text DEFAULT NULL,
  p_cliente_email text DEFAULT NULL,
  p_cliente_id bigint DEFAULT NULL,
  p_origen text DEFAULT 'web',
  p_tipo text DEFAULT NULL,
  p_items jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_n_items integer;
  v_idx integer;
  v_item jsonb;
  v_items_validados jsonb := '[]'::jsonb;
  v_stock_info jsonb := '[]'::jsonb;
  v_producto productos%ROWTYPE;
  v_variante producto_variantes%ROWTYPE;
  v_cantidad integer;
  v_precio numeric;
  v_subtotal numeric := 0;
  v_recargos numeric := 0;
  v_nombre_ok boolean;
  v_nombre_texto text;
  v_detalle_texto text;
  v_bolsita boolean;
  v_pedido_id bigint;
  v_pedido_json jsonb;
  v_estado_nuevo_id bigint;
  v_detalle_id bigint;
  v_detalle_json jsonb;
  v_detalles jsonb := '[]'::jsonb;
  v_respuestas jsonb;
  v_respuesta jsonb;
  v_tipo_respuesta text;
  v_valor_bool boolean;
  v_valor_num numeric;
  v_valor_opcion bigint;
  v_valor_texto text;
  v_uid uuid;
  v_es_personal boolean;
  v_ok boolean;
  v_stock_definido boolean;
  v_stock_disponible numeric;
BEGIN

  /* ==================================================
     VALIDACIONES DE ENTRADA
     ================================================== */

  IF COALESCE(btrim(p_cliente_nombre), '') = '' THEN
    RAISE EXCEPTION 'Ingresá el nombre del cliente.';
  END IF;

  IF p_origen IS NULL OR p_origen NOT IN ('web', 'whatsapp', 'admin') THEN
    RAISE EXCEPTION 'Origen de pedido inválido: "%".', p_origen;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Agregá al menos un producto.';
  END IF;

  /* ==================================================
     CLIENTE: validar existencia y pertenencia.
     - Cliente autenticado: el cliente_id debe ser suyo.
     - Personal o anónimo: solo debe existir.
     ================================================== */

  IF p_cliente_id IS NOT NULL THEN
    SELECT auth.uid() INTO v_uid;
    SELECT es_personal() INTO v_es_personal;

    IF v_uid IS NOT NULL AND NOT v_es_personal THEN
      PERFORM 1 FROM clientes WHERE id = p_cliente_id AND auth_user_id = v_uid;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'El cliente seleccionado no corresponde a tu cuenta.';
      END IF;
    ELSE
      PERFORM 1 FROM clientes WHERE id = p_cliente_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'El cliente no existe.';
      END IF;
    END IF;
  END IF;

  /* ==================================================
     PRIMER RECORRIDO: validar items, calcular precios
     y recargos, disponibilidad informativa.
     Todo calculado en el servidor (no se confía en el
     frontend para precios, costos ni nombres).
     ================================================== */

  v_n_items := jsonb_array_length(p_items);

  FOR v_idx IN 1..v_n_items LOOP
    v_item := p_items->(v_idx - 1);

    IF v_item IS NULL OR v_item = 'null'::jsonb
      OR (v_item->>'producto_id') IS NULL OR (v_item->>'producto_id') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'El producto del renglón % no es válido.', v_idx;
    END IF;

    SELECT *
      INTO v_producto
      FROM productos
      WHERE id = (v_item->>'producto_id')::bigint;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto del renglón % no es válido.', v_idx;
    END IF;

    IF v_producto.nombre IS NULL OR v_producto.nombre = '' THEN
      RAISE EXCEPTION 'El producto del renglón % no tiene nombre válido.', v_idx;
    END IF;

    IF (v_item->>'cantidad') IS NULL OR (v_item->>'cantidad') !~ '^[0-9]+$'
      OR (v_item->>'cantidad')::integer < 1 THEN
      RAISE EXCEPTION 'La cantidad del renglón % debe ser mayor o igual a 1.', v_idx;
    END IF;
    v_cantidad := (v_item->>'cantidad')::integer;

    /* ----- Variante: debe existir, pertenecer al producto y estar activa ----- */

    IF (v_item->>'variante_id') IS NOT NULL AND (v_item->>'variante_id') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'La variante seleccionada del renglón % no es válida.', v_idx;
    END IF;

    IF (v_item->>'variante_id') IS NOT NULL THEN
      SELECT *
        INTO v_variante
        FROM producto_variantes
        WHERE id = (v_item->>'variante_id')::bigint
          AND producto_id = v_producto.id
          AND activo;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'La variante seleccionada del renglón % no es válida.', v_idx;
      END IF;
    ELSE
      v_variante := NULL;
    END IF;

    /* ----- Precio (replica exacta de precioBaseItem) ----- */

    IF v_variante IS NOT NULL AND COALESCE(v_variante.precio, 0) > 0 THEN
      v_precio := v_variante.precio;
    ELSIF p_tipo = 'mayorista' THEN
      IF COALESCE(v_producto.precio_mayorista, 0) > 0 THEN
        v_precio := v_producto.precio_mayorista;
      ELSIF COALESCE(v_producto.precio_mayorista_sugerido, 0) > 0 THEN
        v_precio := v_producto.precio_mayorista_sugerido;
      ELSE
        v_precio := COALESCE(v_producto.precio_publico, v_producto.precio, 0);
      END IF;
    ELSE
      v_precio := COALESCE(v_producto.precio_publico, v_producto.precio, 0);
    END IF;

    IF COALESCE(v_precio, 0) <= 0 THEN
      RAISE EXCEPTION 'El producto "%" no tiene precio configurado. Asignale un precio o una variante con precio.', v_producto.nombre;
    END IF;

    /* ----- Personalizaciones ----- */

    v_nombre_ok := COALESCE((v_item->>'nombre_activo')::boolean, false)
      AND COALESCE(btrim(v_item->>'nombre'), '') <> '';
    v_nombre_texto := NULLIF(btrim(v_item->>'nombre'), '');
    v_detalle_texto := NULLIF(btrim(v_item->>'detalle'), '');
    v_bolsita := COALESCE((v_item->>'bolsita_activo')::boolean, false);

    /* ----- Totales (recargo nombre 2%, bolsita $30) ----- */

    v_subtotal := v_subtotal + ROUND(v_precio * v_cantidad, 2);
    v_recargos := v_recargos + ROUND(
      ((CASE WHEN v_nombre_ok THEN v_precio * 0.02 ELSE 0 END)
        + (CASE WHEN v_bolsita THEN 30 ELSE 0 END)) * v_cantidad,
      2
    );

    /* ----- Stock informativo (variante si hay variante, si no producto).
           SOLO VALIDAR: nunca bloquea ni descuenta. ----- */

    IF v_variante IS NOT NULL AND v_variante.stock IS NOT NULL THEN
      v_stock_disponible := v_variante.stock;
    ELSE
      v_stock_disponible := v_producto.stock;
    END IF;

    v_stock_definido := v_stock_disponible IS NOT NULL;
    v_ok := NOT v_stock_definido OR v_stock_disponible >= v_cantidad;

    v_items_validados := v_items_validados || jsonb_build_array(jsonb_build_object(
      'producto_id', v_producto.id,
      'producto_nombre', v_producto.nombre,
      'codigo_interno', v_producto.codigo_interno,
      'costo_unitario', v_producto.precio_costo,
      'variante_id', CASE WHEN v_variante IS NOT NULL THEN v_variante.id END,
      'variante_nombre', CASE WHEN v_variante IS NOT NULL THEN v_variante.nombre END,
      'cantidad', v_cantidad,
      'precio', v_precio,
      'nombre_ok', v_nombre_ok,
      'nombre_texto', v_nombre_texto,
      'detalle_texto', v_detalle_texto,
      'bolsita', v_bolsita,
      'respuestas', COALESCE(v_item->'respuestas', '[]'::jsonb)
    ));

    v_stock_info := v_stock_info || jsonb_build_array(jsonb_build_object(
      'producto_id', v_producto.id,
      'nombre', COALESCE(v_producto.nombre_comercial, v_producto.nombre),
      'variante_id', CASE WHEN v_variante IS NOT NULL THEN v_variante.id END,
      'variante_nombre', CASE WHEN v_variante IS NOT NULL THEN v_variante.nombre END,
      'solicitado', v_cantidad,
      'disponible', v_stock_disponible,
      'stock_definido', v_stock_definido,
      'ok', v_ok
    ));
  END LOOP;

  /* ==================================================
     PEDIDO + NÚMERO DE PEDIDO + HISTORIAL INICIAL
     ================================================== */

  INSERT INTO pedidos (
    cliente_nombre, cliente_telefono, cliente_email, cliente_id,
    origen, estado, subtotal, recargos, total
  ) VALUES (
    btrim(p_cliente_nombre),
    NULLIF(btrim(p_cliente_telefono), ''),
    NULLIF(lower(btrim(p_cliente_email)), ''),
    p_cliente_id,
    p_origen,
    'nuevo',
    v_subtotal,
    v_recargos,
    v_subtotal + v_recargos
  )
  RETURNING id INTO v_pedido_id;

  UPDATE pedidos SET numero_pedido = v_pedido_id WHERE id = v_pedido_id;

  SELECT id INTO v_estado_nuevo_id
  FROM estados_pedido
  WHERE activo
    AND regexp_replace(lower(translate(nombre, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^a-z0-9_]+', '_', 'g') = 'nuevo'
  ORDER BY orden
  LIMIT 1;

  IF v_estado_nuevo_id IS NOT NULL THEN
    INSERT INTO historial_pedidos (pedido_id, estado_anterior_id, estado_nuevo_id, accion, comentario)
    VALUES (v_pedido_id, NULL, v_estado_nuevo_id, 'Pedido creado', 'El pedido se creó correctamente.');
  END IF;

  /* ==================================================
     SEGUNDO RECORRIDO: detalles, personalizaciones y
     respuestas (los valores ya fueron validados).
     ================================================== */

  FOR v_idx IN 1..v_n_items LOOP
    v_item := v_items_validados->(v_idx - 1);

    INSERT INTO pedido_detalles (
      pedido_id, producto_id, producto_nombre, codigo_interno, cantidad,
      precio_unitario, subtotal, costo_unitario, variante_id, detalle
    ) VALUES (
      v_pedido_id,
      (v_item->>'producto_id')::bigint,
      v_item->>'producto_nombre',
      v_item->>'codigo_interno',
      (v_item->>'cantidad')::integer,
      (v_item->>'precio')::numeric,
      ROUND((v_item->>'precio')::numeric * (v_item->>'cantidad')::integer, 2),
      (v_item->>'costo_unitario')::numeric,
      CASE WHEN (v_item->>'variante_id') IS NOT NULL THEN (v_item->>'variante_id')::bigint END,
      v_item->>'detalle_texto'
    )
    RETURNING id INTO v_detalle_id;

    /* ----- Variante ----- */

    IF (v_item->>'variante_id') IS NOT NULL THEN
      INSERT INTO pedido_personalizaciones (
        pedido_detalle_id, nombre, descripcion, valor_texto,
        recargo_porcentaje, recargo_fijo, recargo_calculado
      ) VALUES (
        v_detalle_id, 'Variante', 'Opción elegida por el cliente.',
        v_item->>'variante_nombre', 0, 0, 0
      );
    END IF;

    /* ----- Nombre o texto ----- */

    IF (v_item->>'nombre_ok')::boolean AND (v_item->>'nombre_texto') IS NOT NULL THEN
      INSERT INTO pedido_personalizaciones (
        pedido_detalle_id, nombre, descripcion, valor_texto,
        recargo_porcentaje, recargo_fijo, recargo_calculado
      ) VALUES (
        v_detalle_id, 'Nombre o texto', 'El cliente agregó un nombre, frase o texto.',
        v_item->>'nombre_texto', 2, 0,
        ROUND((v_item->>'precio')::numeric * 0.02 * (v_item->>'cantidad')::integer, 2)
      );
    END IF;

    /* ----- Detalle del diseño ----- */

    IF (v_item->>'detalle_texto') IS NOT NULL THEN
      INSERT INTO pedido_personalizaciones (
        pedido_detalle_id, nombre, descripcion, valor_texto,
        recargo_porcentaje, recargo_fijo, recargo_calculado
      ) VALUES (
        v_detalle_id, 'Detalle del diseño', 'Información proporcionada por el cliente para realizar el diseño.',
        v_item->>'detalle_texto', 0, 0, 0
      );
    END IF;

    /* ----- Bolsita ----- */

    IF (v_item->>'bolsita')::boolean THEN
      INSERT INTO pedido_personalizaciones (
        pedido_detalle_id, nombre, descripcion, valor_texto,
        recargo_porcentaje, recargo_fijo, recargo_calculado
      ) VALUES (
        v_detalle_id, 'Bolsita de regalo', 'Presentación del producto en bolsita de regalo.',
        'Sí', 0, 30, ROUND(30 * (v_item->>'cantidad')::integer, 2)
      );
    END IF;

    /* ----- Respuestas a preguntas ----- */

    v_respuestas := v_item->'respuestas';

    IF v_respuestas IS NOT NULL AND jsonb_typeof(v_respuestas) = 'array' THEN
      FOR v_respuesta IN SELECT value::jsonb FROM jsonb_array_elements(v_respuestas) LOOP
        IF (v_respuesta->>'pregunta_id') IS NULL OR (v_respuesta->>'pregunta_id') !~ '^[0-9]+$' THEN
          CONTINUE;
        END IF;

        PERFORM 1 FROM preguntas WHERE id = (v_respuesta->>'pregunta_id')::bigint;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'La pregunta del renglón % no existe.', v_idx;
        END IF;

        v_tipo_respuesta := v_respuesta->>'tipo';

        IF v_tipo_respuesta = 'booleano' THEN
          v_valor_bool := COALESCE((v_respuesta->>'valor_booleano')::boolean, false);
          v_valor_num := NULL;
          v_valor_opcion := NULL;
          v_valor_texto := NULL;
        ELSIF v_tipo_respuesta = 'numero' THEN
          v_valor_bool := NULL;
          v_valor_num := NULLIF(
            CASE WHEN (v_respuesta->>'valor_numero') ~ '^[0-9]+(\.[0-9]+)?$'
              THEN (v_respuesta->>'valor_numero')::numeric END,
            0
          );
          v_valor_opcion := NULL;
          v_valor_texto := NULL;
        ELSIF v_tipo_respuesta = 'opcion' THEN
          v_valor_bool := NULL;
          v_valor_num := NULL;
          v_valor_opcion := NULLIF(
            CASE WHEN (v_respuesta->>'opcion_id') ~ '^[0-9]+$'
              THEN (v_respuesta->>'opcion_id')::bigint END,
            0
          );
          v_valor_texto := NULL;
        ELSE
          v_valor_bool := NULL;
          v_valor_num := NULL;
          v_valor_opcion := NULL;
          v_valor_texto := NULLIF(btrim(v_respuesta->>'valor_texto'), '');
        END IF;

        INSERT INTO pedido_respuestas (
          pedido_item_id, pregunta_id, valor_texto, valor_numero, valor_booleano, opcion_id
        ) VALUES (
          v_detalle_id,
          (v_respuesta->>'pregunta_id')::bigint,
          v_valor_texto, v_valor_num, v_valor_bool, v_valor_opcion
        );
      END LOOP;
    END IF;

    /* ----- Detalle del resultado ----- */

    SELECT to_jsonb(d) INTO v_detalle_json FROM pedido_detalles d WHERE d.id = v_detalle_id;
    v_detalles := v_detalles || jsonb_build_array(v_detalle_json);
  END LOOP;

  /* ==================================================
     RESULTADO: pedido (fila completa) + detalles + stock
     ================================================== */

  SELECT to_jsonb(p) INTO v_pedido_json FROM pedidos p WHERE p.id = v_pedido_id;

  RETURN jsonb_build_object(
    'pedido', v_pedido_json,
    'detalles', v_detalles,
    'stock', v_stock_info
  );
END
$fn$;