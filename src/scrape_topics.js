const axios = require('axios');

/**
 * Scrape topics within a specified range and return an array of scraped data.
 *
 * @param {number} startingTopicNumber - The topic number to start scraping from.
 * @param {number} maxTopicNumber - The maximum topic number to scrape up to.
 * @param {number} consecutive404Threshold - The threshold for consecutive 404 responses.
 * @returns {Array} An array of scraped data for each topic.
 */
async function scrapeTopics(startingTopicNumber, maxTopicNumber, consecutive404Threshold) {
    const scrapedData = []; // Initialize an array to store scraped data
    let consecutive404Count = 0; // Track consecutive 404 responses

    for (let topicNumber = startingTopicNumber; topicNumber <= maxTopicNumber; topicNumber++) {
        const url = `https://qbn.com/topics/${topicNumber}/`;

        try {
            // Make a GET request to the topic URL
            const response = await axios.get(url);

            // Check for a 404 response
            if (response.status === 404) {
                consecutive404Count++;
                // If consecutive 404 responses reach the threshold, exit the loop
                if (consecutive404Count >= consecutive404Threshold) {
                    console.log(`Reached the last available topic. Exiting.`);
                    break;
                }
            } else {
                // If a topic page exists, reset the consecutive 404 count
                consecutive404Count = 0;

                // Add the topicData object to the scrapedData array
                scrapedData.push(response);

                // Log the topic number for tracking
                console.log(`Scraped topic number: ${topicNumber}`);
            }
        } catch (error) {
            // Handle errors or continue scraping
            console.error(`Error scraping topic number ${topicNumber}: ${error.message}`);
        }
    }
    return scrapedData; // Return the array of scraped data
}

// Export the scrapeTopics function so it can be imported in other files
module.exports = { scrapeTopics };