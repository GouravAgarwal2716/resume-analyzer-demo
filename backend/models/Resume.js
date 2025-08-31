const db = require("../config/db");

const saveResume = async (userId, text) => {
    await db.execute("INSERT INTO resumes (userId, text) VALUES (?, ?)", [userId, text]);
};

const getResumeByUser = async (userId) => {
    const [rows] = await db.execute("SELECT * FROM resumes WHERE userId = ?", [userId]);
    return rows[0];
};

module.exports = { saveResume, getResumeByUser };
