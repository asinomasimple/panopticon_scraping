const { getLastTopicId, addTopicsToDb } = require('./db_topics');
const { autoFetchPagesById } = require('./fetch');
const { processTopic } = require('./process_topics');


/**
 * Gets last reply from id
 * Fetches a specific amount of replies
 * Processes fetched replies
 * Add replies, nt, and profiles to database
 */
exports.scrapeTopics = async () =>{
    console.log(`Scraping new topics...`)

    // Get last id on database
    const lastId = await getLastTopicId();
    console.log(`lastTopicId ${lastId}`);

    // Set first reply to start scraping
    const startingTopicNumber = lastId + 1;

    // Set the amount of replies to scrape
    const topicAmount = 10;

    // Set the maximum number of 404 replies before stopping fetching
    const maxConsecutive404 = 2;

    try {
        // Fetch the topics from the website
        const fetched = await autoFetchPagesById('https:qbn.com/topics/', startingTopicNumber, topicAmount, maxConsecutive404)
        console.log(`fetched ${fetched.length} new topic.`)

        if (fetched.length == 0) {
            return;
        }

        // Process the fetched topics
        const processedDataPromises = fetched.map(data => processTopic(data));
        const processedData = await Promise.all(processedDataPromises);
        console.log(`Topic ids: ${processedData[0].id} to ${processedData.slice(-1)[0].id}`)

        // Add topics to database
        const addedToDb = await addTopicsToDb(processedData);
        console.log(`${fetched.length} new topics added to database.`)


    } catch (error) {
        throw error;

    }finally{
       // closePool();
    }

}

