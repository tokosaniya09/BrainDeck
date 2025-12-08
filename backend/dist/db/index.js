"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDB = exports.studySetRepository = exports.pool = void 0;
const pg_1 = require("pg");
const StudySetRepository_1 = require("../repositories/StudySetRepository");
if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL missing in environment variables.");
}
// 1. Singleton Pool
exports.pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
// 2. Singleton Repository
exports.studySetRepository = new StudySetRepository_1.PostgresStudySetRepository(exports.pool);
// 3. Simple Connection Check (Migrations should be run via 'npm run migrate')
const initDB = async () => {
    let retries = 5;
    while (retries > 0) {
        try {
            const client = await exports.pool.connect();
            console.log("✅ Database connected successfully.");
            client.release();
            return;
        }
        catch (error) {
            console.log(`⚠️ Database unreachable. Retrying in 2s... (${retries} attempts). Error: ${error.message}`);
            retries--;
            await new Promise(res => setTimeout(res, 2000));
        }
    }
    throw new Error("❌ Could not connect to database. Ensure Docker is running and 'npm run migrate' has been executed.");
};
exports.initDB = initDB;
