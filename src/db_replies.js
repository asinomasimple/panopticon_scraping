const { database } = require('../config/config');
const mysql = require('mysql2/promise');

// Create a pool
// https://www.npmjs.com/package/mysql2#using-connection-pools
const POOL = mysql.createPool({ connectionLimit: 10, ...database });


/**
 * Adds data objects to 'replies' table in database
 * 
 * @param {array} data Data objects with the records to insert in the db
 * @returns {Promise} A Promise that resolves when the insertion is complete or rejects on error.
 */

/**
 * Adds data objects to 'replies' table in database
 * 
 * @param {array} replies Data objects with the records to insert in the db
 * @returns {string} A message with the number of inserted replies.
 */
async function addRepliesToDb(replies) {
    const connection = await POOL.getConnection();

    try {
        await connection.beginTransaction();

        for (const reply of replies) {
            // Destructure item
            const { id, status, date, user, topicId, topicTitle, post, notes, score, replyNumber } = reply;

            if (replies.status == 404) {
                await connection.execute(
                    'INSERT INTO replies (id, status) VALUES (?, ?)',
                    [id, status]
                );

            } else {
                await connection.execute(
                    'INSERT INTO replies (id, status, created, user, topic_id, topic_title, post, notes, score, reply_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [id, status, date, user, topicId, topicTitle, post, notes, score, replyNumber]
                );
            }
        }

        await connection.commit()
        return `${replies.length} replies inserted successfully.`;

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
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

        await connection.commit();
        return `${replies.length} replies updated successfully!`;
    } catch (error) {
        connection.rollback();
        return error;
    } finally {
        connection.release();
    }
}

/**
 * Checks 'replies' database table for last id
 */
async function getLastReplyId() {
    const connection = await POOL.getConnection();

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
        connection.rollback();
        return error;
    } finally {
        connection.release();
    }
}

/**
 * Retrieves the latest non-404 reply IDs from the 'replies' table.
 *
 * @param {number} numberToRetrieve - The number of non-404 reply IDs to retrieve.
 * @returns {Promise<Array<number>>} - A promise that resolves with an array of non-404 reply IDs.
 */
async function getLatestNon404RepliesIds(numberToRetrieve) {
    const connection = await POOL.getConnection();

    try {
        const [rows] = await connection.execute(
            'SELECT id FROM replies WHERE status != 404 ORDER BY id DESC LIMIT ?',
            [numberToRetrieve]
        );

        const ids = rows.map(row => row.id);
        return ids;

    } catch (error) {
        connection.rollback();
        return error;

    } finally {
        connection.release();
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
    const connection = await POOL.getConnection();

    try {
        const [rows] = await connection.execute(
            'SELECT id FROM replies WHERE id < ? AND status != 404 ORDER BY id DESC LIMIT ?',
            [startingId, numberToRetrieve]
        );

        const ids = rows.map((row) => row.id);
        return ids;

    } catch (error) {
        connection.rollback();
        return error;

    } finally {
        connection.release();
    }
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

        console.log('Notes updated successfully!');

    } catch (error) {
        connection.rollback();
        return error;

    } finally {
        connection.release();
    }
}


/**
 * Insert an array of notes into the 'notes' table and close the connection.
 *
 * @param {Array} notes - An array of note objects.
 * @returns {Promise} A promise that resolves when all notes are inserted and the connection is closed.
 */
async function addNotesToDb(notes) {
    const connection = await POOL.getConnection();

    try {
        // Using a transaction for atomicity
        await connection.beginTransaction();

        // Iterate through each note and insert into the 'notes' table
        const insertPromises = notes.map(async (note) => {
            const { user, comment, replyId, position } = note;

            // SQL query to insert a note
            const query = 'INSERT INTO notes (user, comment, reply_id, position) VALUES (?, ?, ?, ?)';

            // Execute the query
            await connection.execute(query, [user, comment, replyId, position]);
        });

        // Wait for all insert operations to complete
        await Promise.all(insertPromises);

        // Commit the transaction
        await connection.commit();

        console.log(`${notes.length} notes inserted successfully.`);
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

/**
 * Does what it says it does
 */
function closePool() {
    POOL.end()
}
module.exports = {
    getLastReplyId,
    addRepliesToDb,
    updateRepliesInDb,
    getLatestNon404RepliesIds,
    addNotesToDb,
    getLastReplyIdFromNotes,
    closePool
};