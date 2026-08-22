-- ============================================================
-- MIGRACIÓN v16: RPC transaccional registrar_compra
-- ============================================================
-- QUÉ HACE: registra una compra completa en UNA transacción:
--   compras + compra_items + stock + precio_costo (si proveedor
--   principal Y proveedores.actualizar_costo_automaticamente) +
--   recálculo de precio_mayorista (×2) / precio_publico (×2.5)
--   solo si el campo está NULL (no pisa manuales) y el flag
--   recalcular_precio_* del proveedor está activo +
--   precio_compra/precio_anterior del proveedor +
--   proveedor_historial (origen 'compra').
--   Si cualquier paso falla → ROLLBACK total (sin compra, sin
--   items, sin cambios de stock/costos, sin historial parcial).
-- SEGURIDAD: SECURITY DEFINER con guarda es_personal() → un
--   cliente (authenticated) recibe 'Acceso restringido al personal'.
-- CONCURRENCIA: el stock se actualiza de forma INCREMENTAL
--   (stock = COALESCE(stock,0) + cantidad) en una sola sentencia
--   atómica; nunca lectura+escritura con valor absoluto.
-- IDEMPOTENTE: sí (CREATE OR REPLACE FUNCTION).
-- REVERSIBLE: sí (DROP FUNCTION public.registrar_compra(...)).

CREATE OR REPLACE FUNCTION public.registrar_compra(
  p_proveedor_id bigint,
  p_fecha date,
  p_comprobante text,
  p_observaciones text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra_id bigint;
  v_item jsonb;
  v_producto_id bigint;
  v_variante_id bigint;
  v_variante_nombre text;
  v_cantidad numeric;
  v_costo_unitario numeric;
  v_relacion_id bigint;
  v_es_principal boolean;
  v_precio_anterior numeric;
  v_precio_costo_anterior numeric;
  v_stock_anterior numeric;
  v_stock_nuevo numeric;
  v_fecha_cambio timestamptz;
  v_total numeric;
  v_total_compra numeric := 0;
  v_contador_items integer := 0;
  v_actualizar_costo boolean;
  v_recalcular_mayorista boolean;
  v_recalcular_minorista boolean;
BEGIN
  IF NOT es_personal() THEN
    RAISE EXCEPTION 'Acceso restringido al personal';
  END IF;

  -- A) proveedor debe existir y estar activo; capturar sus flags
  SELECT actualizar_costo_automaticamente,
         recalcular_precio_mayorista,
         recalcular_precio_minorista
    INTO v_actualizar_costo, v_recalcular_mayorista, v_recalcular_minorista
    FROM public.proveedores
   WHERE id = p_proveedor_id AND activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proveedor no encontrado o inactivo';
  END IF;

  -- A) fecha válida y al menos un ítem
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'Fecha inválida';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La compra debe tener al menos un ítem';
  END IF;

  INSERT INTO public.compras (proveedor_id, fecha, comprobante, observaciones)
  VALUES (
    p_proveedor_id,
    p_fecha,
    NULLIF(TRIM(p_comprobante), ''),
    NULLIF(TRIM(p_observaciones), '')
  )
  RETURNING id INTO v_compra_id;

  v_fecha_cambio := now();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP

    v_producto_id := (v_item->>'producto_id')::bigint;
    v_variante_id := NULLIF(v_item->>'variante_id', '')::bigint;
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_costo_unitario := (v_item->>'costo_unitario')::numeric;

    -- A) producto existente
    IF NOT EXISTS (
      SELECT 1 FROM public.productos WHERE id = v_producto_id
    ) THEN
      RAISE EXCEPTION 'Producto inexistente: %', v_producto_id;
    END IF;

    -- A) cantidad > 0 y costo >= 0
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_producto_id;
    END IF;

    IF v_costo_unitario IS NULL OR v_costo_unitario < 0 THEN
      RAISE EXCEPTION 'Costo unitario inválido para el producto %', v_producto_id;
    END IF;

    -- F) REGLA DE STOCK DEFINITIVA:
    --    producto CON variantes activas → variante OBLIGATORIA
    --    producto SIN variantes activas → variante_id NULL permitido
    IF EXISTS (
      SELECT 1 FROM public.producto_variantes
      WHERE producto_id = v_producto_id AND activo = true
    ) THEN
      IF v_variante_id IS NULL THEN
        RAISE EXCEPTION
          'El producto % tiene variantes activas. Debes indicar una variante.',
          v_producto_id;
      END IF;
    END IF;

    -- F) la variante debe existir, pertenecer al producto y estar activa
    IF v_variante_id IS NOT NULL THEN
      SELECT nombre INTO v_variante_nombre
        FROM public.producto_variantes
       WHERE id = v_variante_id
         AND producto_id = v_producto_id
         AND activo = true;

      IF v_variante_nombre IS NULL THEN
        RAISE EXCEPTION
          'La variante % no existe, no pertenece al producto % o está inactiva',
          v_variante_id, v_producto_id;
      END IF;
    END IF;

    -- D) la relación proveedor-producto debe existir (NO se crea)
    SELECT id, es_principal, precio_compra
      INTO v_relacion_id, v_es_principal, v_precio_anterior
      FROM public.producto_proveedores
     WHERE producto_id = v_producto_id
       AND proveedor_id = p_proveedor_id;

    IF v_relacion_id IS NULL THEN
      RAISE EXCEPTION
        'El producto % no está vinculado al proveedor %',
        v_producto_id, p_proveedor_id;
    END IF;

    -- ítem de la compra
    v_total := v_cantidad * v_costo_unitario;

    INSERT INTO public.compra_items (
      compra_id, producto_id, variante_id,
      cantidad, costo_unitario, costo_total
    )
    VALUES (
      v_compra_id, v_producto_id, v_variante_id,
      v_cantidad, v_costo_unitario, v_total
    );

    v_total_compra := v_total_compra + v_total;
    v_contador_items := v_contador_items + 1;

    -- B) STOCK (incremental, atómico; nunca valor absoluto)
    IF v_variante_id IS NOT NULL THEN
      -- stock de la variante; NO tocar productos.stock
      UPDATE public.producto_variantes
         SET stock = COALESCE(stock, 0) + v_cantidad
       WHERE id = v_variante_id
      RETURNING stock INTO v_stock_nuevo;

      v_stock_anterior := v_stock_nuevo - v_cantidad;

      INSERT INTO public.proveedor_historial (
        producto_proveedor_id, tipo_cambio,
        stock_anterior, stock_nuevo,
        fecha_cambio, origen, observaciones
      )
      VALUES (
        v_relacion_id, 'stock_variante',
        v_stock_anterior, v_stock_nuevo,
        v_fecha_cambio, 'compra',
        'Compra #' || v_compra_id ||
        ' — Variante: ' || v_variante_nombre ||
        ' — variante_id: ' || v_variante_id
      );
    ELSE
      UPDATE public.productos
         SET stock = COALESCE(stock, 0) + v_cantidad,
             stock_actualizado_at = v_fecha_cambio
       WHERE id = v_producto_id
      RETURNING stock INTO v_stock_nuevo;

      v_stock_anterior := v_stock_nuevo - v_cantidad;

      INSERT INTO public.proveedor_historial (
        producto_proveedor_id, tipo_cambio,
        stock_anterior, stock_nuevo,
        fecha_cambio, origen, observaciones
      )
      VALUES (
        v_relacion_id, 'stock',
        v_stock_anterior, v_stock_nuevo,
        v_fecha_cambio, 'compra',
        'Compra #' || v_compra_id
      );
    END IF;

    -- C) COSTO: solo si proveedor principal
    --    Y proveedores.actualizar_costo_automaticamente
    IF v_es_principal AND v_actualizar_costo THEN
      SELECT precio_costo INTO v_precio_costo_anterior
        FROM public.productos WHERE id = v_producto_id;

      IF v_precio_costo_anterior IS DISTINCT FROM v_costo_unitario THEN
        UPDATE public.productos
           SET precio_costo = v_costo_unitario
         WHERE id = v_producto_id;

        -- recálculo de venta: solo si el campo está NULL (no pisa
        -- precios con valor / manuales) y costo > 0 (nunca precios 0)
        IF v_recalcular_mayorista THEN
          UPDATE public.productos
             SET precio_mayorista = ROUND(v_costo_unitario * 2, 2)
           WHERE id = v_producto_id
             AND precio_mayorista IS NULL
             AND v_costo_unitario > 0;
        END IF;

        IF v_recalcular_minorista THEN
          UPDATE public.productos
             SET precio_publico = ROUND(v_costo_unitario * 2.5, 2)
           WHERE id = v_producto_id
             AND precio_publico IS NULL
             AND v_costo_unitario > 0;
        END IF;

        INSERT INTO public.proveedor_historial (
          producto_proveedor_id, tipo_cambio,
          precio_anterior, precio_nuevo,
          fecha_cambio, origen, observaciones
        )
        VALUES (
          v_relacion_id, 'precio_costo',
          v_precio_costo_anterior, v_costo_unitario,
          v_fecha_cambio, 'compra',
          'Compra #' || v_compra_id
        );
      END IF;
    END IF;

    -- D) PRECIO DEL PROVEEDOR (solo su relación)
    IF v_precio_anterior IS DISTINCT FROM v_costo_unitario THEN
      UPDATE public.producto_proveedores
         SET precio_anterior = v_precio_anterior,
             precio_compra = v_costo_unitario,
             ultimo_cambio_precio = v_fecha_cambio
       WHERE id = v_relacion_id;

      INSERT INTO public.proveedor_historial (
        producto_proveedor_id, tipo_cambio,
        precio_anterior, precio_nuevo,
        fecha_cambio, origen, observaciones
      )
      VALUES (
        v_relacion_id, 'precio_compra',
        v_precio_anterior, v_costo_unitario,
        v_fecha_cambio, 'compra',
        'Compra #' || v_compra_id
      );
    END IF;

  END LOOP;

  RETURN jsonb_build_object(
    'compra_id', v_compra_id,
    'items', v_contador_items,
    'total', v_total_compra
  );
END $$;

-- ============================================================
-- REVERSIÓN (requiere autorización explícita, no se ejecuta):
--   DROP FUNCTION IF EXISTS public.registrar_compra(bigint, date, text, text, jsonb);
-- ============================================================