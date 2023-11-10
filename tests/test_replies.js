const { getLastReplyId, addRepliesToDb } = require('../src/database');
const { autoFetchPagesById } = require('../src/fetch');
const { processReply } = require('../src/process');
const axios = require('axios');

/**
 * Entry 
 */
async function testScrapeReplies() {
    // Get last number on database
    const lastId = await getLastReplyId();
    console.log(`lastReplyId ${lastId}`);


    try {
        // Fetch the topics from the website
        const startId = lastId + 1;
        const maxTotalRequests = 20;
        const maxConsecutive404 = 5;
        const fetched = await autoFetchPagesById('https:qbn.com/reply/', startId, maxTotalRequests, maxConsecutive404)

        // Process the fetched topics
        const processedDataPromises = fetched.map(data => processReply(data));
        const processedData = await Promise.all(processedDataPromises);
        
        if(processedData.length < 1){
            console.log("No new entries to add");
            return;
        }
        console.log(processedData)
        // Add topics to database
        const addedToDb = await addRepliesToDb(processedData);
        console.log(`${addedToDb}`)
    } catch (error) {
        // Handle any errors that may occur the scraping
        console.error('An error occurred:', error);
    }
}

async function fetchSingleReply() {
    const url = "https:qbn.com/reply/4103546/"
    try {
        const response = await axios.get(url);
        console.log(` RESPONSE STATUS ${response.status}`)

    } catch (error) {
        console.error(`Error fetching  ${url}: ${error.message}`);
        // error.response
    }
}

testScrapeReplies()

