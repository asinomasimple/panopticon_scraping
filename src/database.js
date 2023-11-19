const { database } = require('../config/config');
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
 * Updates the 'replies' table in the database based on the provided data.
 *
 * @param {Array} repliesToUpdate - An array of objects containing reply data to update.
 * @returns {Promise} A promise that resolves when the updates are completed.
 */
async function updateRepliesInDb(replies) {
    const connection = await POOL.getConnection();
    try {
        for (const reply of replies) {
            if (reply.status === 400) {

                await connection.execute('UPDATE replies SET status = ? WHERE id = ?', [reply.status, reply.id]);

            } else if (reply.status === 200) {

                // Get existing notes in database  to keep them in case they have been deleted from the website 
                const [existingNotesRow] = await connection.execute('SELECT notes FROM replies WHERE id = ?', [reply.id]);
                const existingNotes = JSON.parse(existingNotesRow[0].notes);
                const newNotes = reply.notes;

                // If new notes are less in number than existing notes in database don't update notes
                if (newNotes.length >= existingNotes.length) {
                    const commonNotes = existingNotes.filter((note) => newNotes.find((n) => (n.comment === note.comment && n.user === note.user)));

                    // In case no existing notes have been deleted go ahead and overwrite notes
                    if (commonNotes.length === existingNotes.length) {

                        await connection.execute('UPDATE replies SET notes = ?, score = ? WHERE id = ?', [JSON.stringify(newNotes), reply.score, reply.id]);

                    } else {

                        // If existing notes have been deleted combine notes before overwriting
                        const combinedNotes = [...existingNotes, ...newNotes.filter((n) => !existingNotes.find((note) => (n.comment === note.comment && n.user === note.user)))];
                        await connection.execute('UPDATE replies SET notes = ?, score = ? WHERE id = ?', [JSON.stringify(combinedNotes), reply.score, reply.id]);
                    }
                }
            } else {
                // Only update score
                await connection.execute('UPDATE replies score = ? WHERE id = ?', [reply.score, reply.id]);
            }
        }

        connection.release();
        return `${replies.length} replies updated successfully!`;
    } catch (error) {
        connection.release();
        console.error('Error updating replies:', error);
        return error;
    }
}

/**
 * Adds data objects to 'topics' table in database
 * 
 * @param {array} data Data objects with the records to insert in the db
 * @returns {Promise} A Promise that resolves when the insertion is complete or rejects on error.
 */
async function addTopicsToDb(data) {
    return new Promise(async (resolve, reject) => {
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
                    console.log(`insert profile '${d.user}' status ${d.profile.status}`)
                    const profile = d.profile;
                    // If profile is deleted only insert rip dates
                    if (profile.rip !== undefined && profile.rip !== "") {
                        const profileInsertSql = 'INSERT INTO profiles (topic_id, rip) VALUES (?, ?)';
                        const profileValues = [d.id, profile.rip];
                        await connection.execute(profileInsertSql, profileValues);
                    }
                    // Insert 404 and 403 status
                    else if (profile.status === 404 || profile.status === 403) {
                        const profileInsertSql = 'INSERT INTO profiles (topic_id, status) VALUES (?, ?)';
                        const profileValues = [d.id, profile.status];
                        await connection.execute(profileInsertSql, profileValues);
                    } else {
                        const profileInsertSql = 'INSERT INTO profiles (topic_id, name, location, url, avatar, uncertified, endorsement_status, endorsed_by, bio, rip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                        const uncertified = d.uncertified == "uncertified" ? 1 : 0;
                        const profileValues = [d.id, profile.name, profile.location, profile.url, profile.avatar, profile.uncertified, profile.endorsementStatus, profile.endorsedBy, profile.bio, ''];
                        await connection.execute(profileInsertSql, profileValues);
                    }
                }
            }
            await connection.commit();
            console.log(`${data.length} topics inserted successfully.`);
            resolve('Data inserted successfully.');
        } catch (error) {
            await connection.rollback();
            console.error('Error', error);
            reject(error);
        } finally {
            connection.close();
        }
    });
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
            else if (profile.status === 404 || profile.status === 403) {
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
 * Checks 'replies' database table for last id
 */
async function getLastReplyId() {
    const connection = await createDbConnection();

    try {
        // Query to retrieve the maximum ID from the 'replies' table
        const query = 'SELECT MAX(id) AS lastId FROM replies';
        const [rows] = await connection.execute(query);

        if (rows.length > 0) {
            const lastId = rows[0].lastId;
            return lastId;

        } else {
            console.log('No data in the replies table.');
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
 * Retrieves the latest non-404 reply IDs from the 'replies' table.
 *
 * @param {number} numberToRetrieve - The number of non-404 reply IDs to retrieve.
 * @returns {Promise<Array<number>>} - A promise that resolves with an array of non-404 reply IDs.
 */
async function getLatestNon404RepliesIds(numberToRetrieve) {
    try {
        const connection = await POOL.getConnection();

        const [rows] = await connection.execute(
            'SELECT id FROM replies WHERE status != 404 ORDER BY id DESC LIMIT ?',
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
 * Retrieves non-404 status replies from the 'replies' table in reverse order, starting from a given ID and moving backwards.
 *
 * @param {number} startingId - The ID to start the retrieval from.
 * @param {number} numberToRetrieve - The number of replies to fetch.
 * @returns {Promise<Array>} An array containing the IDs of the retrieved replies.
 */
async function getRepliesFromIdBackwards(startingId, numberToRetrieve) {
    try {
        const connection = await POOL.getConnection();
        const [rows] = await connection.execute(
            'SELECT id FROM replies WHERE id < ? AND status != 404 ORDER BY id DESC LIMIT ?',
            [startingId, numberToRetrieve]
        );

        connection.release();
        const ids = rows.map((row) => row.id);
        return ids;
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}


/**
 * Recursively checks an object for `undefined` values and returns the name of the first key
 * with an `undefined` value.
 *
 * @param {object} obj - The object to check.
 * @param {string} [parentKey] - Internal use for recursion; you don't need to provide this.
 * @returns {string|null} - The name of the first key with an `undefined` value, or `null` if none found.
 */
function findUndefinedKey(obj, parentKey) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];

            if (value === undefined) {
                return parentKey ? `${parentKey}.${key}` : key;
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                const nestedKey = findUndefinedKey(value, parentKey ? `${parentKey}.${key}` : key);
                if (nestedKey !== null) {
                    return nestedKey;
                }
            }
        }
    }
    return null;
}


/**
 * NOT IMPLEMENTED YET
 * Updates the 'notes' table in the database based on the provided data for a specific reply.
 *
 * @param {number} replyId - The ID of the reply associated with the notes.
 * @param {Array} newNotes - An array of objects containing note data to update.
 * @returns {Promise} A promise that resolves when the updates are completed.
 */
async function updateNotesInDb(replyId, newNotes) {
    const connection = await POOL.getConnection();

    try {
        // Retrieve existing notes for the reply
        const [existingNotesRow] = await connection.execute('SELECT * FROM notes WHERE reply_id = ?', [replyId]);
        const existingNotes = existingNotesRow.map((row) => ({
            id: row.id,
            comment: row.comment,
            user: row.user,
            position: row.position,
            status: row.status,
        }));

        if (newNotes.length >= existingNotes.length) {
            const commonNotes = existingNotes.filter((note) => newNotes.find((n) => n.comment === note.comment)); // comment & user

            if (commonNotes.length === existingNotes.length) {
                // If all old notes are included in the new notes, update with the new notes
                for (const note of newNotes) {
                    await connection.execute('UPDATE notes SET comment = ?, user = ?, position = ?, status = ? WHERE id = ?',
                        [note.comment, note.user, note.position, note.status, note.id]);
                }
            } else {
                // Combine old and new notes, keeping unique new notes
                const combinedNotes = [
                    ...existingNotes,
                    ...newNotes.filter((n) => !existingNotes.find((note) => note.comment === n.comment)),
                ];

                // Update the notes in the database with the combined list
                for (const note of combinedNotes) {
                    await connection.execute('UPDATE notes SET comment = ?, user = ?, position = ?, status = ? WHERE id = ?',
                        [note.comment, note.user, note.position, note.status, note.id]);
                }
            }
        } else {
            // If the new notes are fewer, combine both and update
            const combinedNotes = [
                ...existingNotes,
                ...newNotes.filter((n) => !existingNotes.find((note) => note.comment === n.comment)),
            ];

            // Update the notes in the database with the combined list
            for (const note of combinedNotes) {
                await connection.execute('UPDATE notes SET comment = ?, user = ?, position = ?, status = ? WHERE id = ?',
                    [note.comment, note.user, note.position, note.status, note.id]);
            }
        }

        connection.release();
        console.log('Notes updated successfully!');
    } catch (error) {
        connection.release();
        console.error('Error updating notes:', error);
    }
}


/**
 * Insert an array of notes into the 'notes' table and close the connection.
 *
 * @param {Array} notes - An array of note objects.
 * @returns {Promise} A promise that resolves when all notes are inserted and the connection is closed.
 */
async function insertNotes(notes) {
    const connection = await POOL.getConnection();
    try {
        // Using a transaction for atomicity
        await connection.beginTransaction();

        // Iterate through each note and insert into the 'notes' table
        const insertPromises = notes.map(async (note) => {
            const { user, comment, reply_id, position } = note;

            // SQL query to insert a note
            const query = 'INSERT INTO notes (user, comment, reply_id, position) VALUES (?, ?, ?, ?)';

            // Execute the query
            await connection.execute(query, [user, comment, reply_id, position]);
        });

        // Wait for all insert operations to complete
        await Promise.all(insertPromises);

        // Commit the transaction
        await connection.commit();

        console.log('Notes inserted successfully!');
    } catch (error) {
        // Rollback the transaction if an error occurs
        await connection.rollback();
        console.error('Error inserting notes:', error.message);
    } finally {
        // Close the connection regardless of success or failure
        await connection.release();
        console.log('Connection closed.');
    }
}

/**
 * Get the highest reply_id from the 'notes' table.
 *
 * @returns {Promise<number>} A promise that resolves to the highest reply_id.
 */
async function getLastReplyIdFromNotes() {
    const connection = await POOL.getConnection();
    try {
        // SQL query to get the highest reply_id
        const query = 'SELECT MAX(reply_id) AS highestReplyId FROM notes';

        // Execute the query
        const [rows] = await connection.execute(query);

        // Extract the highest reply_id from the result
        const highestReplyId = rows[0].highestReplyId || 0;

        console.log('Highest Reply ID:', highestReplyId);

        return highestReplyId;
    } catch (error) {
        console.error('Error getting highest reply ID:', error.message);
        throw error;
    }
}

module.exports = {
    getLastTopicId,
    addTopicsToDb,
    addProfilesToDb,
};