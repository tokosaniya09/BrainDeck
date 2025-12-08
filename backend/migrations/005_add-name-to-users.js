/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.addColumns("users", {
        name: { type: "text" },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns("users", ["name"]);
};
