/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
    // 1. Create Users Table
    pgm.createTable("users", {
        id: { type: "serial", primaryKey: true },
        email: { type: "text", notNull: true, unique: true },
        password_hash: { type: "text", notNull: true },
        created_at: {
            type: "timestamp",
            notNull: true,
            default: pgm.func("current_timestamp"),
        },
    });

    // 2. Re-create user_activity to use INTEGER user_id instead of string
    // We drop the old one first to avoid type conflicts with the previous guest implementation
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

    pgm.createIndex("user_activity", "user_id");
    pgm.createIndex("user_activity", ["user_id", "study_set_id"], {
        unique: true,
    });
};

exports.down = (pgm) => {
    pgm.dropTable("user_activity");
    pgm.dropTable("users");
};
