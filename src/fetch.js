const axios = require('axios');

/**
 * Scrape topics within a specified range and return an array of scraped data.
 *
 * @param {number} startingTopicNumber - The topic number to start scraping from.
 * @param {number} maxTopicNumber - The maximum topic number to scrape up to.
 * @returns {Array} An array of scraped data for each topic.
 */
async function fetchTopics(startingTopicNumber, maxTopicNumber) {
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
 * @param {string} baseUrl - The base url to use
 * @param {number} startId - The topic number to start scraping from.
 * @param {number} maxId - The maximum topic number to scrape up to.
 * @returns {Array} An array of scraped data for each topic.
 */
async function fetchPages(baseUrl, startId, maxId) {
    const fetchedData = []; // Initialize an array to store fetched data

    for (let id = startId; id <= maxId; id++) {
        const url = `${baseUrl}${id}/`; //  https://qbn.com/replies/1/ or https://qbn.com/topics/1/ 

        try {
            // Make a GET request to the topic URL
            const response = await axios.get(url);
            // Check for a 404 response
            if (response.status === 404) {
                console.log(` RESPONSE STATUS ${response.status}`)
            }

            // Add the page response object to the scrapedData array
            fetchedData.push(response);

        } catch (error) {
            // Handle errors or continue scraping
            console.error(`Error fetching id:${id} from url:${url}. Error:${error.message}`);
            fetchedData.push(error.response);
        }
    }
    return fetchedData; // Return the array of scraped data
}


/**
 * Fetches pages using axios by providing an ID, continuing until encountering a specified number of consecutive 404 responses or a maximum number of total requests.
 * 
 * @param {string} baseUrl - The url to append before the ID
 * @param {number} idToStart - The starting ID for page scraping.
 * @param {number} maxTotalRequests - The maximum number of total requests to make.
 * @param {number} maxConsecutive404 - The maximum number of consecutive 404 responses allowed before stopping.
 * @returns {Promise<(string | null)[]>} - An array of scraped page data with null markers for deleted pages.
 */
async function autoFetchPagesById(baseUrl, idToStart, maxTotalRequests, maxConsecutive404) {
    let resultArray = [];
    let consecutive404Count = 0;
    let totalRequests = 0;

    while (totalRequests < maxTotalRequests && consecutive404Count < maxConsecutive404) {
        const url = `${baseUrl}${idToStart}/`;

        try {
            const response = await axios.get(url);
            totalRequests++;

            if (response.status === 200) {
                resultArray.push(response);
                consecutive404Count = 0; // Reset consecutive 404 count
            } else if (response.status === 404) {
                // Normally 404 pages shouldn't get a response but an error
                resultArray.push(response); // Add a marker for deleted page
                consecutive404Count++;
            } else {
                // Handle other HTTP status codes if needed
                console.log(`Unexpected status code: ${response.status}`);
            }

            idToStart++;
        } catch (error) {
            // Handle the error and include the error response in the resultArray
            if (error.response && error.response.status === 404) {
                resultArray.push(error.response); // Add a marker for deleted page
                consecutive404Count++;
            } else {
                console.error('Error:', error);
                throw new Error(error)
                break; // Exit loop on error
            }
        }
    }

    // Remove consecutive 404 markers from the end
    while (resultArray.length > 0 && resultArray[resultArray.length - 1] === null) {
        resultArray.pop();
    }

    return resultArray;
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
module.exports = { fetchTopics, fetchTopicsFromArray, fetchPages, autoFetchPagesById };