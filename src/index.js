const { getLastTopicId, addTopicsToDb } = require('./database');
const { fetchPages, autoFetchPagesById} = require('./fetch');
const { processTopic } = require('./process');

/**
 * Entry 199735
 */
async function scrapeAndProcess() {
  // Get last number on database
  const lastId = await getLastTopicId();
  console.log(`lastTopicId ${lastId}`);

  const startingTopicNumber = lastId + 1;
  const topicAmount = 10;
  // Set the maximum topic number you want to scrape
  const maxTopicNumber = startingTopicNumber + topicAmount - 1;
  const maxConsecutive404 = 2;

  try {
    // Fetch the topics from the website, includes all 404s
    //const fetched = await fetchPages('https://qbn.com/topics/', startingTopicNumber, maxTopicNumber);
    const fetched = await autoFetchPagesById('https:qbn.com/topics/', startingTopicNumber, topicAmount, maxConsecutive404)

    console.log(`fetched ${fetched.length}`)
    if(fetched.length == 0){
      return;
    }

    // Process the fetched topics
    const processedDataPromises = fetched.map(data => processTopic(data));
    const processedData = await Promise.all(processedDataPromises);


    // Add topics to database
    try {
      const addedToDb = await addTopicsToDb(processedData);
    } catch (error) {
      throw error
    }


  } catch (error) {
    // Handle any errors that may occur the scraping
    console.error('An error occurred:', error);
  }


}

scrapeAndProcess()


