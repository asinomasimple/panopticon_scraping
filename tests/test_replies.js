const { getLastReplyId, addRepliesToDb, addNotesToDb, getLatestNon404RepliesIds, updateRepliesInDb, updateNotesInDb, closePool } = require('../src/db_replies');
const { autoFetchPagesById, fetchPagesFromArray } = require('../src/fetch');
const { processReply } = require('../src/process_replies');



async function updateReplies(){
    const start = 4081247;
    const end = 4081266;
    const ids =  Array.from({ length: end - start + 1 }, (_, index) => start + index);

    try {

        // Fetch urls
        const fetched = await fetchPagesFromArray(ids.map(v => `https://qbn.com/reply/${v}/`));
        console.log("fetched replies")

        // Process fetched pages
        const dataPromises = fetched.map(d => processReply(d));
        const data = await Promise.all(dataPromises);
        console.log("processed replies")

        // Extract notes from data
        const notes = data.filter(d => d.notes != null)
            .map(d => d.notes);
        
        console.log(`Extracted notes ${notes.length}`)

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
        // closePool();
    }

}


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


updateReplies()