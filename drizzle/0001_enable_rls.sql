-- Block Supabase's auto-generated REST/GraphQL API from these tables. The app connects as the
-- database owner, which bypasses RLS. No policies = no access for anon/authenticated roles.
ALTER TABLE "grains" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "grain_price_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "presets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "societies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "slots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "device_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "order_events" ENABLE ROW LEVEL SECURITY;
