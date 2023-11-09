const { getLastTopicId, addTopicsToDb } = require('./database');
const { fetchPages } = require('./fetch');
const { processTopic } = require('./process');

/**
 * Entry 
 */
async function scrapeAndProcess() {
  // Get last number on database
  const lastId = await getLastTopicId();
  console.log(`lastTopicId ${lastId}`);

  const startingTopicNumber =  lastId ;
  const topicAmount = 0;
  // Set the maximum topic number you want to scrape
  const maxTopicNumber = startingTopicNumber + topicAmount; 

  try {
    // Fetch the topics from the website
    const fetched = await fetchPages('https://qbn.com/topics/', startingTopicNumber, maxTopicNumber);

    // Process the fetched topics
    const processedDataPromises = fetched.map(data => processTopic(data));
    const processedData = await Promise.all(processedDataPromises);

    console.log(processedData)
    // Add topics to database
    const addedToDb = await addTopicsToDb(processedData);

  } catch (error) {
    // Handle any errors that may occur the scraping
    console.error('An error occurred:', error);
  }

  if((startingTopicNumber+topicAmount) < 774846){
    console.log("continue scraping")
    //scrapeAndProcess()
  }else{
    console.log("stop scraping")
  }
}

scrapeAndProcess()


