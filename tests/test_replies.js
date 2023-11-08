const { getLastReplyId, addRepliesToDb} = require('../src/database');
const { fetchPages } = require('../src/fetch');
const { processReply } = require('../src/process');

/**
 * Entry 
 */
async function testScrapeReplies() {
    // Get last number on database
    const lastId = await getLastReplyId();
    console.log(`lastReplyId ${lastId}`);

    // Start scraping after last id on db
    const startId = lastId + 10;
    const pageAmount = 0;
    // Set the maximum topic number you want to scrape
    const maxId = startId + pageAmount;
    try {
        // Fetch the topics from the website
        const fetched = await fetchPages('https:qbn.com/reply/', startId, maxId);

         // Process the fetched topics
         const processedDataPromises = fetched.map(data => processReply(data));
         const processedData = await Promise.all(processedDataPromises);
         
         // Add topics to database
        const addedToDb = await addRepliesToDb(processedData);
        console.log(`${addedToDb}`)
    } catch (error) {
        // Handle any errors that may occur the scraping
        console.error('An error occurred:', error);
    }
}

testScrapeReplies()

