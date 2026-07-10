-- Granular per-user permissions: overrides can now REVOKE (not just GRANT).
-- Additive: existing overrides were all grants → default GRANT is correct.
CREATE TYPE "PermissionOverrideEffect" AS ENUM ('GRANT', 'REVOKE');
ALTER TABLE "UserPermissionOverride" ADD COLUMN "effect" "PermissionOverrideEffect" NOT NULL DEFAULT 'GRANT';
