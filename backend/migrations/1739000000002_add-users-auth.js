/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
    // 1. Create Users Table - Clean definition with ALL columns immediately
    pgm.createTable(
        "users",
        {
            id: { type: "serial", primaryKey: true },
            email: { type: "text", notNull: true, unique: true },
            password_hash: { type: "text" }, // Nullable (for Google Auth users)
            name: { type: "text" }, // Defined directly here, not added later
            auth_provider: { type: "text", notNull: true, default: "email" },
            created_at: {
                type: "timestamp",
                notNull: true,
                default: pgm.func("current_timestamp"),
            },
        },
        {
            ifNotExists: true,
            constraints: {
                // Add the safety check constraint immediately
                check: "(auth_provider = 'google') OR (password_hash IS NOT NULL)",
            },
        }
    );

    // 2. Create User Activity Table
    // We drop it if it exists to ensure a clean definition of the foreign keys
    pgm.dropTable("user_activity", { ifExists: true });

    pgm.createTable("user_activity", {
        id: { type: "serial", primaryKey: true },
        user_id: {
            type: "integer",
            notNull: true,
            references: '"users"',
            onDelete: "CASCADE",
        },
        study_set_id: {
            type: "integer",
            notNull: true,
            references: '"study_sets"',
            onDelete: "CASCADE",
        },
        accessed_at: {
            type: "timestamp",
            notNull: true,
            default: pgm.func("current_timestamp"),
        },
    });

    // 3. Indexes
    pgm.createIndex("user_activity", "user_id");
    pgm.createIndex("user_activity", ["user_id", "study_set_id"], {
        unique: true,
    });
};

exports.down = (pgm) => {
    pgm.dropTable("user_activity");
    pgm.dropTable("users");
};
