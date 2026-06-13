-- Enums
CREATE TYPE "CourseAuthorType" AS ENUM ('EDITOR', 'USER');
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- Course: 크리에이터 마켓플레이스 필드 + created_by nullable
ALTER TABLE "courses" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE "courses" ADD COLUMN "author_type" "CourseAuthorType" NOT NULL DEFAULT 'EDITOR';
ALTER TABLE "courses" ADD COLUMN "author_user_id" BIGINT;
ALTER TABLE "courses" ADD COLUMN "price" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "courses" ADD COLUMN "sales_count" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "courses_author_type_status_id_idx" ON "courses"("author_type", "status", "id");
ALTER TABLE "courses" ADD CONSTRAINT "courses_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CoursePurchase: 이용권
CREATE TABLE "course_purchases" (
    "id" BIGSERIAL NOT NULL,
    "course_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "payment_id" TEXT,
    "purchased_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_purchases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "course_purchases_course_id_user_id_key" ON "course_purchases"("course_id", "user_id");
CREATE INDEX "course_purchases_user_id_status_idx" ON "course_purchases"("user_id", "status");
ALTER TABLE "course_purchases" ADD CONSTRAINT "course_purchases_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_purchases" ADD CONSTRAINT "course_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
