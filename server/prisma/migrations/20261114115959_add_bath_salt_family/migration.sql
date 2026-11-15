-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block in
-- Postgres. Prisma Migrate runs each migration file in its own transaction
-- but accepts single-statement enum-expansion migrations outside one, so
-- this must be the only statement in the file.
ALTER TYPE "ProductFamily" ADD VALUE IF NOT EXISTS 'BATH_SALT';
