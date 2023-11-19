const { database } = require('../config/config');
const mysql = require('mysql2/promise');

// Create a pool
// https://www.npmjs.com/package/mysql2#using-connection-pools
const POOL = mysql.createPool({ connectionLimit: 10, ...database });

//-----------------------------------------------------------------------
//
// ADDING TO DATABASE
//
//-----------------------------------------------------------------------

/**
 * Adds data objects to 'replies' table in database
 * 
 * @param {array} replies An array of data objects.
 * @returns {Promise} 
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

        await connection.commit();
        console.log(`${replies.length} replies added successfully.`);

    } catch (error) {
        console.log(`Error adding replies to database.`)
        await connection.rollback();
        throw error;

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
            const { user, comment, replyId, position, htmlComment} = note;

            // SQL query to insert a note
            const query = 'INSERT INTO notes (user, comment, reply_id, position, html_comment) VALUES (?, ?, ?, ?, ?)';

            // Execute the query
            await connection.execute(query, [user, comment, replyId, position, htmlComment]);
        });

        // Wait for all insert operations to complete
        await Promise.all(insertPromises);

        // Commit the transaction
        await connection.commit();
        console.log(`${notes.length} notes added successfully.`);

    } catch (error) {
        console.error(`Error adding notes to database.`);
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}

//-----------------------------------------------------------------------
//
// UPDATING ON DATABASE
//
//-----------------------------------------------------------------------

/**
 * Updates the 'replies' table in the database based on the provided data.
 *
 * @param {Array} replies - An array of objects containing reply data to update.
 * @returns {Promise} A promise that resolves when the updates are completed.
 */
async function updateRepliesInDb(replies) {
    const connection = await POOL.getConnection();

    try {
        await connection.beginTransaction();

        for (const reply of replies) {

            if (reply.status === 400) {
                // Only update status to keep already scraped content
                await connection.execute('UPDATE replies SET status = ? WHERE id = ?', [reply.status, reply.id]);

            } else {
                // Only update score
                await connection.execute('UPDATE replies SET score = ? WHERE id = ?', [reply.score, reply.id]);
            }
        }
        await connection.commit();
        console.log(`${replies.length} replies updated successfully.`);

    } catch (error) {
        console.error(`Error updating replies on database.`)
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}


/**
 * Updates the 'notes' table in the database based on the provided data for a specific reply.
 *
 * @param {Array} scrapedNotes - An array of objects containing note data to update.
 * @returns {Promise} A promise that resolves when the updates are completed.
 */
async function updateNotesInDb(scrapedNotes) {
    const connection = await POOL.getConnection();

    // Get the reply_id from the first note
    const replyId = scrapedNotes[0]["replyId"];

    try {
        await connection.beginTransaction();

        // Retrieve existing notes for the reply.  Rows are in result[0]
        const [existingNotesRow] = await connection.execute('SELECT * FROM notes WHERE reply_id = ? ORDER BY position', [replyId]);

        // Convert to Note object (process_replies.js) to make sure we're comparing the same thing
        /**
         * @typedef {Object} Note
         * @property {string} comment - The content of the note.
         * @property {string} user - The username associated with the note.
         * @property {number} replyId - The ID of the reply to which the note belongs.
         * @property {number} position - The position of the note starting from 0.
         * @property {string} htmlComment - The html content of the comment.
         */
        // @type {Note}
        const existingNotes = existingNotesRow.map((row) => ({
            comment: row.comment,
            user: row.user,
            replyId: +row.reply_id,
            position: row.position
        }));

        // Check the notes that are in common
        const commonNotes = existingNotes.filter(oldNote => scrapedNotes.find(scrapedNote => areNotesEqual(oldNote, scrapedNote)));
        // Check what notes are new
        const newNotes = scrapedNotes.filter(scrapedNote => !existingNotes.some(oldNote => areNotesEqual(oldNote, scrapedNote)));

        // If there are no new notes there's nothing to insert
        if (newNotes.length == 0) {
            return;
        }
        // Check if no existing notes have been deleted
        if (commonNotes.length == existingNotes.length) {
            // Insert new notes, positions should be OK
            const pause = true;
            await addNotesToDb(newNotes)

        } else if (existingNotes.length > commonNotes.length) {
            // Notes have been deleted update positions
            console.log(`notes have been deleted on the website`);
            const lastPosition = existingNotes.slice(-1).position;
            console.log(`last position ${lastPosition}`);
            console.log(`double check common notes last position ${commonNotes.slice(-1).position}`);
            const updatedNotes = newNotes.map((n, i) => ({ ...n, position: lastPosition + i + 1 }))
            throw new Error("Double check before updatding modified notes");
            await addNotesToDb(updatedNotes)
        }

        // No need to commit because where only selecting notes.

    } catch (error) {
        console.error(`Error checking notes on database.`);
        throw error;

    } finally {
        connection.release();
    }
}



/**
 * Compare two Note objects.
 * @param {Note} note1 - The first object.
 * @param {Note} note2 - The second object.
 * @returns {boolean} - True if the Notes have the same values
 */
function areNotesEqual(note1, note2) {
    /**
     * @typedef {Object} Note
     * @property {string} comment - The content of the note.
     * @property {string} user - The username associated with the note.
     * @property {number} replyId - The ID of the reply to which the note belongs.
     * @property {number} position - The position of the note starting from 0.
     * @property {string} htmlComment - The html content of the comment.
     */
    
    // Check everything but htmlComment since not all db rows have that value yet
    const keys = ["comment", "user", "replyId", "position"]

    // Iterate through the specified keys
    for (let key of keys) {
      // Compare values for each key
      if (note1[key] !== note2[key]) {
        return false; // Return false if any value is different
      }
    }

    // If all key values are the same, return true
    return true;
}
/**
 * Compare two objects for equality of keys and values.
 * @param {Object} obj1 - The first object.
 * @param {Object} obj2 - The second object.
 * @returns {boolean} - True if the objects have the same keys and values, false otherwise.
 */
function areObjectsEqual(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    // Check if the number of keys is the same
    if (keys1.length !== keys2.length) {
        return false;
    }

    // Check if all keys in obj1 have corresponding keys in obj2 and values are equal
    for (let key of keys1) {
        if (obj1[key] !== obj2[key]) {
            return false;
        }
    }

    // If all checks pass, the objects are equal
    return true;
}

//-----------------------------------------------------------------------
//
// RETRIEVING FROM DATABASE
//
//-----------------------------------------------------------------------

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
        throw error;

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
        throw error;
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
        throw error;

    } finally {
        connection.release();
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

    } finally {
        connection.release()
    }
}

function backupUpdateNotesAsJson() {

    /*
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
     */

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
    updateNotesInDb,
    getLastReplyIdFromNotes,
    closePool
};