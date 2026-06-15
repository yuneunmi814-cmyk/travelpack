-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_created_by_fkey";

-- DropIndex
DROP INDEX "spots_location_gist";

-- AlterTable
ALTER TABLE "spots" ADD COLUMN     "barrier_free" JSONB,
ADD COLUMN     "has_barrier_free" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pet_friendly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pet_info" JSONB,
ADD COLUMN     "related_spots" JSONB;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
