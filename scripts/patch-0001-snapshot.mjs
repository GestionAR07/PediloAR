/**
 * Updates drizzle/meta/0001_snapshot.json to match the post-auth-foundation schema.
 * Run: node scripts/patch-0001-snapshot.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = path.join(root, "drizzle", "meta", "0001_snapshot.json");

const snap = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

const mu = snap.tables["public.merchant_users"];
if (!mu) {
  throw new Error("merchant_users missing from snapshot");
}

if (mu.columns.external_user_id) {
  mu.columns.user_id = {
    name: "user_id",
    type: "uuid",
    primaryKey: false,
    notNull: true,
  };
  delete mu.columns.external_user_id;
}

if (mu.indexes.merchant_users_merchant_external_uidx) {
  delete mu.indexes.merchant_users_merchant_external_uidx;
}
mu.indexes.merchant_users_merchant_user_uidx = {
  name: "merchant_users_merchant_user_uidx",
  columns: [
    {
      expression: "merchant_id",
      isExpression: false,
      asc: true,
      nulls: "last",
    },
    {
      expression: "user_id",
      isExpression: false,
      asc: true,
      nulls: "last",
    },
  ],
  isUnique: true,
  concurrently: false,
  method: "btree",
  with: {},
};
mu.indexes.merchant_users_user_id_idx = {
  name: "merchant_users_user_id_idx",
  columns: [
    {
      expression: "user_id",
      isExpression: false,
      asc: true,
      nulls: "last",
    },
  ],
  isUnique: false,
  concurrently: false,
  method: "btree",
  with: {},
};

mu.foreignKeys.merchant_users_user_id_user_profiles_id_fk = {
  name: "merchant_users_user_id_user_profiles_id_fk",
  tableFrom: "merchant_users",
  tableTo: "user_profiles",
  columnsFrom: ["user_id"],
  columnsTo: ["id"],
  onDelete: "restrict",
  onUpdate: "no action",
};

snap.tables["public.user_profiles"] = {
  name: "user_profiles",
  schema: "",
  columns: {
    id: {
      name: "id",
      type: "uuid",
      primaryKey: true,
      notNull: true,
    },
    display_name: {
      name: "display_name",
      type: "text",
      primaryKey: false,
      notNull: false,
    },
    phone: {
      name: "phone",
      type: "text",
      primaryKey: false,
      notNull: false,
    },
    platform_role: {
      name: "platform_role",
      type: "text",
      primaryKey: false,
      notNull: true,
      default: "'USER'",
    },
    status: {
      name: "status",
      type: "text",
      primaryKey: false,
      notNull: true,
      default: "'ACTIVE'",
    },
    created_at: {
      name: "created_at",
      type: "timestamp with time zone",
      primaryKey: false,
      notNull: true,
      default: "now()",
    },
    updated_at: {
      name: "updated_at",
      type: "timestamp with time zone",
      primaryKey: false,
      notNull: true,
      default: "now()",
    },
  },
  indexes: {
    user_profiles_platform_role_idx: {
      name: "user_profiles_platform_role_idx",
      columns: [
        {
          expression: "platform_role",
          isExpression: false,
          asc: true,
          nulls: "last",
        },
      ],
      isUnique: false,
      concurrently: false,
      method: "btree",
      with: {},
    },
    user_profiles_status_idx: {
      name: "user_profiles_status_idx",
      columns: [
        {
          expression: "status",
          isExpression: false,
          asc: true,
          nulls: "last",
        },
      ],
      isUnique: false,
      concurrently: false,
      method: "btree",
      with: {},
    },
  },
  foreignKeys: {},
  compositePrimaryKeys: {},
  uniqueConstraints: {},
  policies: {},
  checkConstraints: {
    user_profiles_platform_role_check: {
      name: "user_profiles_platform_role_check",
      value: "platform_role IN ('USER', 'ADMIN')",
    },
    user_profiles_status_check: {
      name: "user_profiles_status_check",
      value: "status IN ('ACTIVE', 'SUSPENDED')",
    },
  },
  isRLSEnabled: false,
};

fs.writeFileSync(snapshotPath, `${JSON.stringify(snap, null, 2)}\n`, "utf8");
console.log("Patched", snapshotPath);
