CREATE TABLE "dividend_choices" (
	"membership_id" text NOT NULL,
	"ticker" text NOT NULL,
	"into" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dividend_choices_membership_id_ticker_pk" PRIMARY KEY("membership_id","ticker")
);
--> statement-breakpoint
CREATE TABLE "dividend_credits" (
	"id" text PRIMARY KEY NOT NULL,
	"membership_id" text NOT NULL,
	"dividend_id" text NOT NULL,
	"ticker" text NOT NULL,
	"ex_date" date NOT NULL,
	"shares" double precision NOT NULL,
	"per_share" double precision NOT NULL,
	"amount" double precision NOT NULL,
	"tax" double precision NOT NULL,
	"into" text NOT NULL,
	"into_price" double precision NOT NULL,
	"into_shares" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dividends" (
	"id" text PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"ex_date" date NOT NULL,
	"pay_date" date,
	"cash" double precision NOT NULL,
	"kind" text,
	"per_year" integer,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "dividends_checked_on" date;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "credit_id" text;--> statement-breakpoint
ALTER TABLE "dividend_choices" ADD CONSTRAINT "dividend_choices_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividend_credits" ADD CONSTRAINT "dividend_credits_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividend_credits" ADD CONSTRAINT "dividend_credits_dividend_id_dividends_id_fk" FOREIGN KEY ("dividend_id") REFERENCES "public"."dividends"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dividend_credits_once_idx" ON "dividend_credits" USING btree ("membership_id","dividend_id");--> statement-breakpoint
CREATE INDEX "dividend_credits_membership_idx" ON "dividend_credits" USING btree ("membership_id","ex_date");--> statement-breakpoint
CREATE INDEX "dividends_ticker_ex_idx" ON "dividends" USING btree ("ticker","ex_date");--> statement-breakpoint
CREATE INDEX "dividends_ex_idx" ON "dividends" USING btree ("ex_date");--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_credit_id_dividend_credits_id_fk" FOREIGN KEY ("credit_id") REFERENCES "public"."dividend_credits"("id") ON DELETE set null ON UPDATE no action;