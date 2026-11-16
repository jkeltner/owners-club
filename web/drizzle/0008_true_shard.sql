ALTER TABLE "clubs" ADD COLUMN "opens_on" date;--> statement-breakpoint
-- Clubs made before opening days existed all open at the first production fill run's close (Jeff, 2026-11-15).
UPDATE "clubs" SET "opens_on" = '2026-11-16' WHERE "opens_on" IS NULL;--> statement-breakpoint
ALTER TABLE "clubs" ALTER COLUMN "opens_on" SET NOT NULL;
