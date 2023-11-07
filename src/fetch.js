const axios = require('axios');

/**
 * Scrape topics within a specified range and return an array of scraped data.
 *
 * @param {number} startingTopicNumber - The topic number to start scraping from.
 * @param {number} maxTopicNumber - The maximum topic number to scrape up to.
 * @param {number} consecutive404Threshold - The threshold for consecutive 404 responses.
 * @returns {Array} An array of scraped data for each topic.
 */
async function fetchTopics(startingTopicNumber, maxTopicNumber, consecutive404Threshold) {
    const scrapedData = []; // Initialize an array to store scraped data

    for (let topicNumber = startingTopicNumber; topicNumber <= maxTopicNumber; topicNumber++) {
        const url = `https://qbn.com/topics/${topicNumber}/`;

        try {
            // Make a GET request to the topic URL
            const response = await axios.get(url);
            // Check for a 404 response
            if (response.status === 404) {
                console.log(` RESPONSE STATUS ${response.status}`)
            }

            // Add the topicData object to the scrapedData array
            scrapedData.push(response);
            
        } catch (error) {
            // Handle errors or continue scraping
            console.error(`Error fetching topic number ${topicNumber}: ${error.message}`);
            scrapedData.push(error.response);
        }
    }
    return scrapedData; // Return the array of scraped data
}



/**
 * Scrape topics within a specified range and return an array of scraped data.
 *
 * @param {number} startingTopicNumber - The topic number to start scraping from.
 * @param {number} maxTopicNumber - The maximum topic number to scrape up to.
 * @param {number} consecutive404Threshold - The threshold for consecutive 404 responses.
 * @returns {Array} An array of scraped data for each topic.
 */
async function fetchTopicsAutomated(startingTopicNumber, maxTopicNumber, consecutive404Threshold) {
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
            }
        } catch (error) {
            // Handle errors or continue scraping
            console.error(`Error fetching topic number ${topicNumber}: ${error.message}`);
        }
    }
    return scrapedData; // Return the array of scraped data
}

/**
 * Scrape topics within a specified range and return an array of scraped data.
 *
 * @param {array} urls - The list of urls to fetch
 * @returns {Array} An array of scraped data for each topic.
 */
async function fetchTopicsFromArray(urls) {
    const scrapedData = []; // Initialize an array to store scraped data

    for (const url of urls) {

        try {
            console.log(`try ${url}`)
            // Make a GET request to the topic URL
            const response = await axios.get(url);

            // Add the topicData object to the scrapedData array
            scrapedData.push(response);

            // Log the topic number for tracking
            console.log(`Fetched topic number: ${url}`);

        } catch (error) {
            // Handle errors or continue scraping
            console.error(`Error fetching ${url}: ${error.message}`);
        }
    }
    return scrapedData; // Return the array of scraped data
}

// Export the fetchTopics function so it can be imported in other files
module.exports = { fetchTopics, fetchTopicsFromArray };