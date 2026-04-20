BEGIN;

ALTER TABLE IF EXISTS subscriptions DROP CONSTRAINT IF EXISTS subscriptions_payment_method_check;
ALTER TABLE IF EXISTS subscriptions
  ADD CONSTRAINT subscriptions_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('stripe', 'paypal', 'wechat', 'alipay'));

ALTER TABLE IF EXISTS payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE IF EXISTS payments
  ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('stripe', 'paypal', 'wechat', 'alipay'));

ALTER TABLE IF EXISTS webhook_events DROP CONSTRAINT IF EXISTS webhook_events_provider_check;
ALTER TABLE IF EXISTS webhook_events
  ADD CONSTRAINT webhook_events_provider_check
  CHECK (provider IN ('stripe', 'paypal', 'alipay', 'wechat'));

COMMIT;
