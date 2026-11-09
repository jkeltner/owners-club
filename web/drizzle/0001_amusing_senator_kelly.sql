CREATE TABLE "companies" (
	"ticker" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cik" integer,
	"sector" text NOT NULL,
	"sub_industry" text NOT NULL,
	"lens" text,
	"one_liner" text,
	"status" text DEFAULT 'active' NOT NULL,
	"added_to_index" date,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earnings_dates" (
	"ticker" text NOT NULL,
	"date" date NOT NULL,
	"status" text NOT NULL,
	"fiscal_period_end" date,
	"report_time" text,
	"reported_eps" double precision,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "earnings_dates_ticker_date_pk" PRIMARY KEY("ticker","date")
);
--> statement-breakpoint
CREATE TABLE "financials" (
	"cik" integer NOT NULL,
	"period" text NOT NULL,
	"period_start" date,
	"period_end" date,
	"revenue" bigint,
	"net_income" bigint,
	"eps_diluted" double precision,
	"gross_profit" bigint,
	"operating_income" bigint,
	"operating_cash_flow" bigint,
	"capex" bigint,
	"shares_outstanding" bigint,
	"cash" bigint,
	"long_term_debt" bigint,
	"equity" bigint,
	"goodwill" bigint,
	"intangibles" bigint,
	"accession" text,
	"filed" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financials_cik_period_pk" PRIMARY KEY("cik","period")
);
--> statement-breakpoint
CREATE TABLE "headlines" (
	"id" text PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "headlines_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"summary" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"ticker" text NOT NULL,
	"date" date NOT NULL,
	"close" double precision NOT NULL,
	"volume" bigint,
	"source" text NOT NULL,
	CONSTRAINT "prices_ticker_date_pk" PRIMARY KEY("ticker","date")
);
--> statement-breakpoint
CREATE TABLE "reference" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"unit" text,
	"source" text NOT NULL,
	"source_url" text,
	"as_of" date,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "companies_cik_idx" ON "companies" USING btree ("cik");--> statement-breakpoint
CREATE INDEX "companies_sector_idx" ON "companies" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "earnings_dates_date_idx" ON "earnings_dates" USING btree ("date");--> statement-breakpoint
CREATE INDEX "financials_period_idx" ON "financials" USING btree ("period");--> statement-breakpoint
CREATE INDEX "headlines_ticker_published_idx" ON "headlines" USING btree ("ticker","published_at");--> statement-breakpoint
CREATE INDEX "job_runs_job_started_idx" ON "job_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE INDEX "prices_date_idx" ON "prices" USING btree ("date");