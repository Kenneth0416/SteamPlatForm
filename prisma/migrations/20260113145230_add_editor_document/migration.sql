-- CreateTable
CREATE TABLE "EditorDocument" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditorDocument_lessonId_order_idx" ON "EditorDocument"("lessonId", "order");

-- AddForeignKey
ALTER TABLE "EditorDocument" ADD CONSTRAINT "EditorDocument_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
