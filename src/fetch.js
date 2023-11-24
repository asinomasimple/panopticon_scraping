const axios = require('axios');

/**
 * Fetches pages within a specified range and returns an array of fetched responses.
 * @param {string} url - The url to fetch
 * @returns {object} The fetched response
 */
async function fetchPage(url) {
    try {

        const response = await axios.get(url);
        return response;

    } catch (error) {

        console.error(`Error fetching page ${url}, error: ${error.message}`);

        // Return 404 errors, we also want to store deleted pages
        // 403 erros for profile pages like '/services/'
        const status = error.response.status
        if (status === 404 || status == 403 || status == 500) {
            return error.response;
        }

        throw new Error(error);
    }
}

/**
 * Fetches pages within a specified range and returns an array of fetched responses.
 * 
 * @param {string} baseUrl - The base url to use
 * @param {number} startId - The page id  to start scraping from.
 * @param {number} maxId - The maximum page id number to scrape up to.
 * @returns {Array} An array of fetched responses for each page.
 */
async function fetchPages(baseUrl, startId, maxId) {
    const fetchedData = []; // Initialize an array to store fetched data

    for (let id = startId; id <= maxId; id++) {
        const url = `${baseUrl}${id}/`; //  https://qbn.com/replies/1/ or https://qbn.com/topics/1/ 

        try {
            // Make a GET request to the url
            const response = await axios.get(url);

            // Add the page response object to the scrapedData array
            fetchedData.push(response);

        } catch (error) {
            // Log error and continue fetching
            console.error(`Error fetching id:${id} from url:${url}. Error:${error.message}`);
            fetchedData.push(error.response);
        }
    }
    return fetchedData; // Return the array of scraped data
}

/**
 * Fetches pages by providing an ID, continuing until encountering a specified number of consecutive 404 responses or a maximum number of total requests.
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

    // Fetch pages 404 responses included if under maxConsecutive404
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
                idToStart++;

            } else {
                console.error('Error:', error);
                throw new Error(error)
                break; // Exit loop on error
            }
        }
    }

    // Clean array by removing consecutive 404 markers from the end
    for (let i = resultArray.length - 1; i >= 0; i--) {

        // Stop removing 404 markers at the first non 404 response
        if (resultArray[i] !== null && (resultArray[i].status !== 404)) {
            break;
        }

        // Remove 404 markers from the bottom
        if (resultArray[i] === null || (resultArray[i].status === 404)) {
            resultArray.pop();
        }

    }

    return resultArray;
}

/**
 * Fetch pages from a list of urls and return an array of fetched responses.
 *
 * @param {array} urls - The list of urls to fetch
 * @returns {Array} An array of fetched responses for each url.
 */
async function fetchPagesFromArray(urls) {
    const fetchedData = []; // Initialize an array to store fetched data

    for (const url of urls) {
        try {
            const response = await axios.get(url);

            // Add the topicData object to the scrapedData array
            fetchedData.push(response);

        } catch (error) {
            // Add errors to fetchedData 
            console.error(`Error fetching ${url}: ${error.message}`);
            fetchedData.push(error.response);
        }
    }

    return fetchedData; // Return the array of scraped data
}

// Export the fetchTopics function so it can be imported in other files
module.exports = { fetchPage, fetchPages, autoFetchPagesById, fetchPagesFromArray };