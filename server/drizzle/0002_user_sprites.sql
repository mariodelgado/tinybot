CREATE TABLE "user_sprites" (
	"user_id" text PRIMARY KEY NOT NULL,
	"sprite_name" text NOT NULL,
	"sprite_id" text,
	"sprite_url" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_sprites" ADD CONSTRAINT "user_sprites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
