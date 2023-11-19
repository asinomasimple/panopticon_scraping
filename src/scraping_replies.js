const { getLastReplyId, addRepliesToDb, addNotesToDb, getLatestNon404RepliesIds, updateRepliesInDb, updateNotesInDb, closePool } = require('./db_replies');
const { autoFetchPagesById, fetchPagesFromArray } = require('./fetch');
const { processReply } = require('./process_replies');

/**
 * Updates exisiting replies and then scrapes new ones
 */
async function execute() {
    await updateLatestReplies(50)
    // await scrapeNewReplies(20, 2)
}
/**
 * Scrapes new replies from website
 * 1. Checks the last reply id in database
 * 2. Fetches pages automatically
 * 3. Processes fetched pages 
 * 4. Inserts new pages to database
 * 
 * @param {number} maxTotalRequests - The maximum number of total requests to make.
 * @param {number} maxConsecutive404 - The maximum number of consecutive 404 responses allowed before stopping.
 */
async function scrapeNewReplies(maxTotalRequests, maxConsecutive404) {
    console.log(`Scraping new replies...`)

    // Get the last reply id in database
    const lastId = await getLastReplyId();
    console.log(`Last reply id in database ${lastId}.`);

    try {
        // Fetch the replies from the website
        const startId = lastId + 1;
        const fetched = await autoFetchPagesById('https:qbn.com/reply/', startId, maxTotalRequests, maxConsecutive404)

        // Process the fetched pages
        const dataPromises = fetched.map(data => processReply(data));
        const data = await Promise.all(dataPromises);

        // Return if there are no entries to add to database 
        if (data.length < 1) {
            console.log("No new entries to add");
            return;
        }

        // Add replies to database
        const addedToDb = await addRepliesToDb(data);

        // Extract notes from data
        const notes = data.filter(d => d.notes != null)
            .map(d => d.notes)
            .flat();

        // Add notes to database 
        if (notes.length >= 1) {
            await addNotesToDb(notes)
        }

    } catch (error) {
        // Handle any errors that may occur the scraping
        console.error('An error occurred when scraping new replies:', error);
        throw error;

    } finally {
        closePool()
    }
}

/**
 * Updates latest replies in database
 * 
 *  @param {number} amount - The number of non-404 reply IDs to retrieve.
 */
async function updateLatestReplies(amount) {
    console.log(`updating latest ${amount} replies...`)
    try {
        // Get the latest non-404 replies
        const latestRepliesIds = await getLatestNon404RepliesIds(amount);

        // Fetch urls
        const fetched = await fetchPagesFromArray(latestRepliesIds.map(v => `https://qbn.com/reply/${v}/`));
        console.log("fetched replies")

        // Process fetched pages
        const dataPromises = fetched.map(d => processReply(d));
        const data = await Promise.all(dataPromises);
        console.log("processed replies")

        // Extract notes from data
        const notes = data.filter(d => d.notes != null)
            .map(d => d.notes);

        // Update replies in db (status & score)
        const updatedOnDb = await updateRepliesInDb(data);

        // Update notes in db
        if (notes.length > 0) {
            const notesPromises = notes.map(d => updateNotesInDb(d));
            const updatedNotes = await Promise.all(notesPromises);
        }
        console.info(`... done updating replies.`)

    } catch (error) {
        throw error;

    } finally {
        closePool();
    }
}
execute()
