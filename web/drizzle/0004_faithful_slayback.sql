CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"membership_id" text NOT NULL,
	"mode" text NOT NULL,
	"ticker" text,
	"topic" text,
	"thesis_id" text,
	"turn" integer DEFAULT 0 NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"state" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"seq" integer NOT NULL,
	"from" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"membership_id" text NOT NULL,
	"ticker" text NOT NULL,
	"side" text NOT NULL,
	"amount" double precision NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fill_date" date,
	"fill_price" double precision,
	"fee" double precision
);
--> statement-breakpoint
CREATE TABLE "theses" (
	"id" text PRIMARY KEY NOT NULL,
	"membership_id" text NOT NULL,
	"ticker" text NOT NULL,
	"kind" text DEFAULT 'pick' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"does_well" text NOT NULL,
	"happens_next" text NOT NULL,
	"number_watched" text NOT NULL,
	"prediction_metric" text NOT NULL,
	"prediction_value" double precision NOT NULL,
	"prediction_unit" text NOT NULL,
	"order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_thesis_id_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."theses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theses" ADD CONSTRAINT "theses_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theses" ADD CONSTRAINT "theses_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_membership_idx" ON "conversations" USING btree ("membership_id","mode","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_conversation_seq_idx" ON "messages" USING btree ("conversation_id","seq");--> statement-breakpoint
CREATE INDEX "orders_membership_idx" ON "orders" USING btree ("membership_id","placed_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "theses_membership_idx" ON "theses" USING btree ("membership_id","ticker");--> statement-breakpoint
CREATE INDEX "theses_order_idx" ON "theses" USING btree ("order_id");