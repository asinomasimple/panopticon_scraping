const cheerio = require('cheerio');
const axios = require('axios');

/**
 * Process scraped data using Cheerio.
 *
 * @param {object} response - The axios get response object https://axios-http.com/docs/res_schema
 * @returns A data object
 */
async function processTopic(response) {
    const $ = cheerio.load(response.data)
    const topic = {
        id: $("#main > h1 > a").attr("href").split("/")[2],
        user: $("#main > ul > li.news > dl > dd.main > div.meta > a").text().trim(),
        title: $("#main > h1 > a > em").text(),
        date: $("#meta > ul > li:nth-child(1) > span").attr("date"),
        post: $("#main > ul > li.news > dl > dd.main > div.body").html(),
        status: response.status
    }

    const responseUrl = response.request.res.responseUrl // https://axios-http.com/docs/res_schema
    const topicIdUrl = `https://qbn.com/topics/${topic.id}/`;

    // If responseUrl is not a redirect it *should* be a user page
    // Exceptions: 
    if (topic.title == "" && responseUrl == topicIdUrl) {
        const profileUrl = `https://qbn.com/${topic.user}/`;
        try {
            // Make a GET request to the profile URL
            const response = await axios.get(profileUrl);
            topic['profile'] = processProfile(response.data)

            // Check for a 404 response
            if (response.status === 404) {
                console.log(`404 error for id: ${topic.id}, url: ${profileUrl}`);

            } else {

            }
        } catch (error) {
            // Handle errors or continue scraping
            console.error(`Error scraping profile id: ${topic.id}, url: ${profileUrl}: ${error.message}`);
        }
    }

    return topic

}
/**
 * Process scraped data using Cheerio.
 * 
 * @param {string} data - The html data to load to cheerio
 * @returns A data object
 */
function processProfile(data) {
    const $ = cheerio.load(data)
    // Check if user is deleted
    const rip = $("#main > p:nth-child(2)").text()
    if (rip != "") {
        const ripDate = $("#main > p:nth-child(3)").text()
        return { rip: ripDate }
    }
    // Returns "invited by" or "certified by". 
    // Doesn't return the user that certified, user in inside an <a> tag
    const invited = $("#main > h1 > small.invited-by").first().contents()
        .filter(function () {
            return this.type === 'text';
        }).text().trim()
    const profile = {
        name: $("#main > ul.details > li.name").text().trim(),
        since: $("#main > h1 > small:nth-child(2)").text().split(' ')[1],
        location: $("#main > ul.details > li.location").text(),
        url: $("#main > ul.details > li.url").text(),
        avatar: $("#main > div").attr("data-url") ?? '',
        invited: invited,
        by: $("#main > h1 > small.invited-by > a").first().text(), // Returns the USER  in"invited by USER" or "certified by USER"
        uncertified: $("#main > h1 > small.uncertified > a").text(),
        bio: $("#main > ul.thread.replies > li:nth-child(1) > dl > dd").html()
    }
    return profile
}

module.exports = { processTopic };