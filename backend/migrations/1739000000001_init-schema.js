/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
    // 1. Enable Vector Extension
    pgm.createExtension("vector", { ifNotExists: true });

    // 2. Create Study Sets Table
    pgm.createTable(
        "study_sets",
        {
            id: { type: "serial", primaryKey: true },
            topic: { type: "text", notNull: true },
            summary: { type: "text" },
            estimated_study_time_minutes: { type: "integer" },
            // 768 dimensions for text-embedding-004
            embedding: { type: "vector(768)" },
            created_at: {
                type: "timestamp",
                notNull: true,
                default: pgm.func("current_timestamp"),
            },
        },
        { ifNotExists: true }
    );

    // 3. Create Flashcards Table
    pgm.createTable(
        "flashcards",
        {
            id: { type: "serial", primaryKey: true },
            set_id: {
                type: "integer",
                notNull: true,
                references: '"study_sets"',
                onDelete: "CASCADE",
            },
            front: { type: "text", notNull: true },
            back: { type: "text", notNull: true },
            difficulty: { type: "text" },
            tags: { type: "text[]" },
        },
        { ifNotExists: true }
    );

    // 4. Create Quiz Questions Table (Moved here from 001)
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
            choices: { type: "text[]", notNull: true },
            answer_index: { type: "integer", notNull: true },
        },
        { ifNotExists: true }
    );

    // 5. Create Index for Vector Search (HNSW)
    pgm.sql(`
    CREATE INDEX IF NOT EXISTS study_sets_embedding_idx 
    ON study_sets USING hnsw (embedding vector_cosine_ops);
  `);
};

exports.down = (pgm) => {
    pgm.dropTable("quiz_questions");
    pgm.dropTable("flashcards");
    pgm.dropTable("study_sets");
    pgm.dropExtension("vector");
};
