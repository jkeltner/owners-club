CREATE TABLE "portfolio_days" (
	"id" text PRIMARY KEY NOT NULL,
	"membership_id" text NOT NULL,
	"date" date NOT NULL,
	"value" double precision NOT NULL,
	"tax_owed" double precision NOT NULL,
	"after_tax" double precision NOT NULL,
	"index_after_tax" double precision NOT NULL,
	"holdings" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "asked_shares" double precision;--> statement-breakpoint
ALTER TABLE "portfolio_days" ADD CONSTRAINT "portfolio_days_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_days_membership_date_idx" ON "portfolio_days" USING btree ("membership_id","date");