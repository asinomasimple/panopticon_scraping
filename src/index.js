const { scrapeTopics } = require('./scrape_topics');
const { processTopic } = require('./process_topics');

async function scrapeAndProcess() {
  // 774817 "Walking tours on google maps"
  // 509741 ORAZAL
  // 774732 NT post
  // 763977 "Hidden thread"
  // 697764 "/ / / / / / / / / / / / / /"
  // Start scraping from topic number 67366
  const startingTopicNumber = 67366;
  // Set the maximum topic number you want to scrape
  const maxTopicNumber = startingTopicNumber + 10; // You can adjust this as needed


  try {
    // Call the scrapeTopics function with the dataPopulator function
    const scrapedData = await scrapeTopics(startingTopicNumber, maxTopicNumber, 10);

    // Use Promise.all to process the scraped data in parallel
    const processedDataPromises = scrapedData.map(data => processTopic(data));

    // Wait for all processing to complete
    const processedData =  await Promise.all(processedDataPromises)

    console.log(processedData)
  } catch (error) {
    // Handle any errors that may occur during scraping or processing
    console.error('An error occurred:', error);
  }
}

scrapeAndProcess()


