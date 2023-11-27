require('dotenv').config(); // Load environment variables
const database = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
}
const mysql = require('mysql2/promise');

// Create a pool
const POOL = mysql.createPool(database);

/**
 * Creates the database connection
 */
async function createDbConnection() {
    const connection = await mysql.createConnection(database);
    return connection;
}

/**
 * Adds data objects to 'topics' table in database
 * 
 * @param {array} data Data objects with the records to insert in the db
 * @returns {Promise} A Promise that resolves when the insertion is complete or rejects on error.
 */
async function addTopicsToDb(data) {

    const connection = await POOL.getConnection()

    try {
        await connection.beginTransaction();

        for (const d of data) {

            // Base topic, if no extra table needed it's a "thread"
            const topicsInsertSql = 'INSERT INTO topics (id, status, title, date, post, user, topic_type) VALUES (?, ?, ?, ?, ?, ?, ?)';
            const topicsValues = [d.id, d.status, d.title, d.date, d.post, d.user, d.topicType];
            await connection.execute(topicsInsertSql, topicsValues);

            // NT type topic
            if (d.topicType === 'nt') {
                const ntInsertSql = 'INSERT INTO nt (topic_id, url, thumbnail) VALUES (?, ?, ?)';
                const ntValues = [d.id, d.ntUrl, d.ntThumbnail];
                await connection.execute(ntInsertSql, ntValues);
            }

            // User profile topic
            if (d.topicType === 'profile') {
                const profile = d.profile;

                // If profile is deleted only insert rip dates
                if (profile.rip !== undefined && profile.rip !== "") {
                    const profileInsertSql = 'INSERT INTO profiles (topic_id, rip) VALUES (?, ?)';
                    const profileValues = [d.id, profile.rip];
                    await connection.execute(profileInsertSql, profileValues);
                }

                // Insert 404, 403 & 500 status with empty fields
                else if (profile.status === 404 || profile.status === 403 || profile.status == 500) {
                    const profileInsertSql = 'INSERT INTO profiles (topic_id, status) VALUES (?, ?)';
                    const profileValues = [d.id, profile.status];
                    await connection.execute(profileInsertSql, profileValues);

                } else {
                    // Insert regular profile
                    const profileInsertSql = 'INSERT INTO profiles (topic_id, name, location, url, avatar, uncertified, endorsement_status, endorsed_by, bio, rip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                    const uncertified = d.profile.uncertified == "uncertified" ? 1 : 0;
                    const profileValues = [d.id, profile.name, profile.location, profile.url, profile.avatar, uncertified, profile.endorsementStatus, profile.endorsedBy, profile.bio, ''];
                    await connection.execute(profileInsertSql, profileValues);
                }
            }
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        console.error('Error', error);
    } finally {
        connection.close();
    }

}

/**
 * Inserts profile into database
 * 
 * @param {number} topicId - The topic id in the 'topics' table to link to
 * @param {object}  profile - The profile data
 */
async function addProfilesToDb(data) {
    const connection = await POOL.getConnection()

    try {

        await connection.beginTransaction();
        for (const d of data) {

            const { topicId, profile } = d;

            // If profile is deleted only insert rip dates
            if (profile.rip !== undefined && profile.rip !== "") {
                const profileInsertSql = 'INSERT INTO profiles (topic_id, rip) VALUES (?, ?)';
                const profileValues = [topicId, profile.rip];
                await connection.execute(profileInsertSql, profileValues);
            }
            // Insert 404 and 403 status
            else if (profile.status === 404 || profile.status === 403 || profile.status == 500) {
                const profileInsertSql = 'INSERT INTO profiles (topic_id, status) VALUES (?, ?)';
                const profileValues = [topicId, profile.status];
                await connection.execute(profileInsertSql, profileValues);
            } else {
                const profileInsertSql = 'INSERT INTO profiles (topic_id, name, location, url, avatar, uncertified, endorsement_status, endorsed_by, bio, rip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                const uncertified = d.uncertified == "uncertified" ? 1 : 0;
                const profileValues = [topicId, profile.name, profile.location, profile.url, profile.avatar, profile.uncertified, profile.endorsementStatus, profile.endorsedBy, profile.bio, ''];
                await connection.execute(profileInsertSql, profileValues);
            }
        }
        await connection.commit();
        console.log(`${data.length} topics inserted successfully.`);
    } catch (error) {
        await connection.rollback();
        console.error('Error', error);
    } finally {
        connection.end();
    }

}

/**
 * Checks 'topics' database table for last id
 * @returns {number}    The last topic id number
 */
async function getLastTopicId() {
    const connection = await createDbConnection();

    try {
        // Query to retrieve the maximum ID from the 'topics' table
        const query = 'SELECT MAX(id) AS lastId FROM topics';
        const [rows] = await connection.execute(query);

        if (rows.length > 0) {
            const lastId = rows[0].lastId;
            return lastId;

        } else {
            console.log('No data in the topics table.');
            return null;
        }
    } catch (error) {
        console.error('Error:', error);
        throw new Error(error);
    } finally {
        connection.close();
    }
}


/**
 * Retrieves the latest non-404 topics IDs from the 'replies' table.
 *
 * @param {number} numberToRetrieve - The number of non-404 reply IDs to retrieve.
 * @returns {Promise<Array<number>>} - A promise that resolves with an array of non-404 reply IDs.
 */
async function getLatestNon404TopicsIds(numberToRetrieve) {
    try {
        const connection = await POOL.getConnection();

        const [rows] = await connection.execute(
            'SELECT id FROM topics WHERE status != 404 ORDER BY id DESC LIMIT ?',
            [numberToRetrieve]
        );

        connection.release();
        const ids = rows.map(row => row.id);
        return ids;

    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

/**
 * Does what it says it does
 */
function closePool() {
    POOL.end()
}

module.exports = {
    getLastTopicId,
    addTopicsToDb,
    addProfilesToDb,
    closePool
};