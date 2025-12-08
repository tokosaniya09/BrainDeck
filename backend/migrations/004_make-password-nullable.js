/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
    // 1. Add auth_provider column to track how the user signed up
    pgm.addColumns("users", {
        auth_provider: { type: "text", notNull: true, default: "email" },
    });

    // 2. Allow password_hash to be null (for Google users)
    pgm.alterColumn("users", "password_hash", { notNull: false });

    // 3. SAFETY NET: Add a constraint to the database.
    // Rule: "Either the provider is Google, OR the password must exist."
    // This physically prevents creating an 'email' user without a password.
    pgm.addConstraint("users", "users_password_safety_check", {
        check: "(auth_provider = 'google') OR (password_hash IS NOT NULL)",
    });
};

exports.down = (pgm) => {
    pgm.dropConstraint("users", "users_password_safety_check");
    pgm.dropColumns("users", ["auth_provider"]);
    // We can't easily revert the nullability if there are existing nulls, so we skip that strictly.
};
