-- CreateEnum
CREATE TYPE "duo_invitation_status" AS ENUM ('pending', 'accepted', 'declined');

-- AlterTable
ALTER TABLE "duo" ADD COLUMN     "dissolution_requested_by_user_id" UUID;

-- CreateTable
CREATE TABLE "duo_invitation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "duo_name" VARCHAR(100) NOT NULL,
    "region_id" UUID NOT NULL,
    "proposed_by_user_id" UUID NOT NULL,
    "invited_user_id" UUID NOT NULL,
    "invitation_pair_key" VARCHAR(150) NOT NULL,
    "status" "duo_invitation_status" NOT NULL DEFAULT 'pending',
    "resulting_duo_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "duo_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "duo_invitation_resulting_duo_id_key" ON "duo_invitation"("resulting_duo_id");

-- CreateIndex
CREATE INDEX "idx_duo_invitation_invited_status" ON "duo_invitation"("invited_user_id", "status");

-- CreateIndex
CREATE INDEX "idx_duo_invitation_proposer_status" ON "duo_invitation"("proposed_by_user_id", "status");

-- AddForeignKey
ALTER TABLE "duo" ADD CONSTRAINT "duo_dissolution_requested_by_user_id_fkey" FOREIGN KEY ("dissolution_requested_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duo_invitation" ADD CONSTRAINT "duo_invitation_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duo_invitation" ADD CONSTRAINT "duo_invitation_proposed_by_user_id_fkey" FOREIGN KEY ("proposed_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duo_invitation" ADD CONSTRAINT "duo_invitation_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duo_invitation" ADD CONSTRAINT "duo_invitation_resulting_duo_id_fkey" FOREIGN KEY ("resulting_duo_id") REFERENCES "duo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Niet uit te drukken in Prisma-schema-DSL (zelfde reden als bij
-- Duo.memberPairKey, zie migrations/20260726193638_init):

-- Kan jezelf niet uitnodigen.
ALTER TABLE "duo_invitation" ADD CONSTRAINT "chk_duo_invitation_not_self" CHECK ("proposed_by_user_id" <> "invited_user_id");

-- Voorkomt dubbele gelijktijdige pending-voorstellen tussen hetzelfde
-- koppel (in beide richtingen, dankzij de gesorteerde pair-key).
CREATE UNIQUE INDEX "idx_duo_invitation_pending_pair"
    ON "duo_invitation" ("invitation_pair_key")
    WHERE "status" = 'pending';
