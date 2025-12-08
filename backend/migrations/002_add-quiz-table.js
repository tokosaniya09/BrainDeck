/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createTable(
        "quiz_questions",
        {
            id: { type: "serial", primaryKey: true },
            set_id: {
                type: "integer",
                notNull: true,
                references: '"study_sets"',
                onDelete: "CASCADE",
            },
            question: { type: "text", notNull: true },
            // We store choices as a text array in Postgres
            choices: { type: "text[]", notNull: true },
            answer_index: { type: "integer", notNull: true },
        },
        { ifNotExists: true }
    );
};

exports.down = (pgm) => {
    pgm.dropTable("quiz_questions");
};
