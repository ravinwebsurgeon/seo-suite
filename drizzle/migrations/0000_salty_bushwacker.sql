CREATE TABLE "Session" (
	"id" text PRIMARY KEY NOT NULL,
	"shop" text NOT NULL,
	"state" text NOT NULL,
	"isOnline" boolean DEFAULT false NOT NULL,
	"scope" text,
	"expires" timestamp with time zone,
	"accessToken" text DEFAULT '' NOT NULL,
	"userId" bigint,
	"firstName" text,
	"lastName" text,
	"email" text,
	"accountOwner" boolean DEFAULT false NOT NULL,
	"locale" text,
	"collaborator" boolean DEFAULT false,
	"emailVerified" boolean DEFAULT false,
	"refreshToken" text,
	"refreshTokenExpires" timestamp with time zone
);
