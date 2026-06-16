-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "pin" TEXT,
ADD COLUMN     "primeiroAcesso" BOOLEAN NOT NULL DEFAULT true;
