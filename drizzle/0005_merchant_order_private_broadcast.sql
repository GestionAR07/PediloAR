-- Migration 0005: Private Broadcast for new merchant orders
-- Custom SQL (not a Drizzle table change). Replaces WAL INSERT transport.
-- Payload is only orderId. Trigger does not broadcast customer/payment/address fields.

CREATE OR REPLACE FUNCTION public.broadcast_merchant_order_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object('orderId', NEW.id),
    'order_inserted',
    'merchant-orders:' || NEW.merchant_id::text,
    true
  );
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.broadcast_merchant_order_inserted() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS orders_broadcast_inserted ON public.orders;
--> statement-breakpoint
CREATE TRIGGER orders_broadcast_inserted
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_merchant_order_inserted();
--> statement-breakpoint
DROP POLICY IF EXISTS "merchant_orders_broadcast_select" ON realtime.messages;
--> statement-breakpoint
CREATE POLICY "merchant_orders_broadcast_select"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND EXISTS (
      SELECT 1
      FROM public.merchant_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.active = true
        AND realtime.topic() = ('merchant-orders:' || mu.merchant_id::text)
    )
  );
