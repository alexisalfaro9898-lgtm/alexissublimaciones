-- ============================================================
-- migracion-v9-rpc-cliente-telefono.sql
-- PREPARACIÓN WHATSAPP: identificación de clientes por teléfono
-- ------------------------------------------------------------
-- Permite a un usuario ANÓNIMO (cliente del portal o futuro
-- asistente WhatsApp) buscar o crear un cliente por teléfono
-- SIN otorgar INSERT sobre clientes (RLS sigue intacta).
-- Solo se crean filas mínimas (nombre, telefono, whatsapp,
-- email) — sin auth_user_id, sin rol, sin datos sensibles.
-- NO fusiona duplicados: si no encuentra, crea; si encuentra
-- (por whatsapp primero, luego por telefono), devuelve el que
-- existe. Comparación EXACTA de dígitos (sin asumir país).
-- ============================================================

-- normalizador SQL idéntico en criterio al JS (src/lib/clientes.js)
CREATE OR REPLACE FUNCTION public.normalizar_telefono(p_telefono text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT CASE
    WHEN left(t.telefono, 2) = '00' THEN '+' || substr(t.telefono, 3)
    ELSE t.telefono
  END
  FROM (SELECT regexp_replace(p_telefono, '[^0-9+]', '', 'g') AS telefono) t
  WHERE t.telefono <> ''
$$;

CREATE OR REPLACE FUNCTION public.find_or_create_cliente_por_telefono(
  p_telefono text,
  p_whatsapp text DEFAULT NULL,
  p_nombre text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_normalizado text;
  v_normalizado_wsp text;
  v_telefono_sin_prefijo text;
  v_cliente public.clientes%ROWTYPE;
  v_creado boolean := false;
BEGIN
  IF p_telefono IS NULL AND p_whatsapp IS NULL THEN
    RAISE EXCEPTION 'Se requiere un teléfono o un WhatsApp.';
  END IF;

  v_normalizado := public.normalizar_telefono(COALESCE(p_telefono, p_whatsapp));
  v_normalizado_wsp := public.normalizar_telefono(p_whatsapp);

  IF v_normalizado IS NULL THEN
    RAISE EXCEPTION 'El teléfono ingresado no es válido.';
  END IF;

  IF length(v_normalizado) > 20 THEN
    RAISE EXCEPTION 'El teléfono ingresado es demasiado largo.';
  END IF;

  v_telefono_sin_prefijo := replace(v_normalizado, '+', '');

  -- 1. Buscar por WhatsApp exacto
  IF v_normalizado_wsp IS NOT NULL THEN
    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE whatsapp = v_normalizado_wsp
    LIMIT 1;
  END IF;

  -- 2. Buscar por teléfono exacto
  IF v_cliente.id IS NULL THEN
    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE telefono = v_telefono_sin_prefijo
    LIMIT 1;
  END IF;

  -- 3. Crear fila mínima (sin auth_user_id, sin rol)
  --    clientes.nombre es NOT NULL: si no hay nombre, se usa
  --    'Cliente' como placeholder (la fase WhatsApp siempre
  --    enviará el nombre de perfil).
  IF v_cliente.id IS NULL THEN
    INSERT INTO public.clientes (nombre, telefono, whatsapp, email)
    VALUES (
      COALESCE(NULLIF(btrim(COALESCE(p_nombre, '')), ''), 'Cliente'),
      v_telefono_sin_prefijo,
      COALESCE(v_normalizado_wsp, v_telefono_sin_prefijo),
      NULLIF(lower(btrim(COALESCE(p_email, ''))), '')
    )
    RETURNING * INTO v_cliente;

    v_creado := true;
  END IF;

  RETURN jsonb_build_object(
    'id', v_cliente.id,
    'nombre', v_cliente.nombre,
    'telefono', v_cliente.telefono,
    'whatsapp', v_cliente.whatsapp,
    'email', v_cliente.email,
    'creado', v_creado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_cliente_por_telefono(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_or_create_cliente_por_telefono(text, text, text, text) TO anon, authenticated;