alter table "public"."profiles" drop constraint "profiles_username_key";

alter table "public"."profiles" drop constraint "username_length";

drop index if exists "public"."profiles_username_key";

alter table "public"."profiles" drop column "full_name";

alter table "public"."profiles" drop column "username";

alter table "public"."profiles" drop column "website";


