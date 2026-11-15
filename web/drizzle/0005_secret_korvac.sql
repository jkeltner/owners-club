CREATE TABLE "lots" (
	"id" text PRIMARY KEY NOT NULL,
	"membership_id" text NOT NULL,
	"ticker" text NOT NULL,
	"shares" double precision NOT NULL,
	"cost" double precision NOT NULL,
	"bought_on" date NOT NULL,
	"order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "filled_amount" double precision;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shares" double precision;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gain_short" double precision;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gain_long" double precision;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax" double precision;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lots_membership_idx" ON "lots" USING btree ("membership_id","ticker","bought_on");--> statement-breakpoint
-- Orders placed before fills existed were tests (Jeff, 2026-11-14): clear them, with the theses
-- and coach conversations behind them, so the first fill run starts from nothing.
DELETE FROM "messages";--> statement-breakpoint
DELETE FROM "conversations";--> statement-breakpoint
DELETE FROM "theses";--> statement-breakpoint
DELETE FROM "orders";
