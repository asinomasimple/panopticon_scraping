const { getLastReplyId, addRepliesToDb, getLatestNon404RepliesIds, updateRepliesInDb } = require('./database');
const { autoFetchPagesById, fetchPagesFromArray } = require('./fetch');
const { processReply, processUpdatedReply } = require('./process');

/**
 * Updates exisiting replies and then scrapes new ones
 */
async function execute() {
   await updateLatestReplies(50)
   await scrapeNewReplies(50, 5)
    process.exit(0)
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
    console.log(`Last reply id in database ${lastId}`);

    try {
        // Fetch the replies from the website
        const startId = lastId + 1;
        const fetched = await autoFetchPagesById('https:qbn.com/reply/', startId, maxTotalRequests, maxConsecutive404)

        // Process the fetched pages
        const processedDataPromises = fetched.map(data => processReply(data));
        const processedData = await Promise.all(processedDataPromises);

        // Return if there are no entries to add to database 
        if (processedData.length < 1) {
            console.log("No new entries to add");
            return;
        }

        // Add replies to database
        const addedToDb = await addRepliesToDb(processedData);
        console.log(`${addedToDb}`)

    } catch (error) {
        // Handle any errors that may occur the scraping
        console.error('An error occurred when scraping new replies:', error);
    }
}

/**
 * Updates latest replies in database
 * 
 *  @param {number} amount - The number of non-404 reply IDs to retrieve.
 */
async function updateLatestReplies(amount) {
    console.log(`updating latest ${amount} replies...`)
    // Get the latest non-404 replies
    const latestRepliesIds = await getLatestNon404RepliesIds(amount);

    // Fetch urls
    const fetched = await fetchPagesFromArray(latestRepliesIds.map(v => `https://qbn.com/reply/${v}/`))

    // Process fetched pages
    const processedDataPromises = fetched.map(data => processUpdatedReply(data));
    const processedData = await Promise.all(processedDataPromises);
    //  console.log(JSON.stringify(processedData, null, 2))

    // Update on db
    const updatedOnDb = await updateRepliesInDb(processedData)
    console.log(updatedOnDb)
}


execute()
