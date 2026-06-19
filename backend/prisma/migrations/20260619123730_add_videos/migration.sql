-- AlterTable
ALTER TABLE "regions" ADD COLUMN     "buzz_score" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "videos" (
    "id" BIGSERIAL NOT NULL,
    "youtube_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channel_title" TEXT,
    "thumbnail_url" TEXT,
    "view_count" BIGINT NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "region_id" BIGINT,
    "spot_id" BIGINT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "videos_youtube_id_key" ON "videos"("youtube_id");

-- CreateIndex
CREATE INDEX "videos_region_id_sort_order_idx" ON "videos"("region_id", "sort_order");

-- CreateIndex
CREATE INDEX "videos_spot_id_sort_order_idx" ON "videos"("spot_id", "sort_order");

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
