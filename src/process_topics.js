const cheerio = require('cheerio');
const axios = require('axios');

const TYPE_THREAD = "thread";
const TYPE_PROFILE = "profile";
const TYPE_NT = "nt";

/**
 * Process scraped data using Cheerio.
 *
 * @param {object} response - The axios get response object https://axios-http.com/docs/res_schema
 * @returns A data object
 */
async function processTopic(response) {
    const $ = cheerio.load(response.data);

    // Retrieve response url
    const responseUrl = response.request.res.responseUrl; // https://axios-http.com/docs/res_schema

    // Check if the response url has a title (topics/id-title/) or not (topics/id/)
    const urlHasTitle = getUrlHasTitle(responseUrl);

    // Get the h1 title from the body
    var h1 = $("#main > h1 > a > em").text();

    // Check if the response has an nt type url in body
    const ntUrl = $("#main > div.url > a").attr("href");

    // Check the topic type
    const topicType = getTopicType(ntUrl, urlHasTitle, h1);

    // Get the name of the user that posted the thread or whose profile it is
    const user = $("#main > ul > li.news > dl > dd.main > div.meta > a").text().trim();


    let title;
    if (topicType == TYPE_PROFILE) {
        // Profiles don't have html titles and don't have url titles either
        title = user;
    } else {
        // Thread exceptions: 
        // The hidden thread (id: 763977) doesn't have an html title but has a url title
        // The '/////' thread (id: 697764) has an html title but doesn't have a url title
        title = h1 ? h1 : getTitleFromUrl(responseUrl);
    }


    // Create base (thread) topic object with the data
    const topic = {
        id: $("#main > h1 > a").attr("href").split("/")[2],
        user: $("#main > ul > li.news > dl > dd.main > div.meta > a").text().trim(),
        title: title,
        date: $("#meta > ul > li:nth-child(1) > span").attr("date"),
        post: $("#main > ul > li.news > dl > dd.main > div.body").html(),
        status: response.status,
        responseUrl: responseUrl,
        topicType: topicType
    }

    // If it's a NT post 
    if (topicType == TYPE_NT) {
        topic["ntUrl"] = $("#main > div.url > a").attr("href");
        const topicThumbnail = $("#main > a").attr("data-url");
        topic["ntThumbnail"] = topicThumbnail ? "https://qbn.com/" + $("#main > a").attr("data-url") : "";
    }

    // If it's a profile
    if (topicType == TYPE_PROFILE) {
        const profileUrl = `https://qbn.com/${topic.user}/`;
        try {
            // Make a GET request to the profile URL
            const response = await axios.get(profileUrl);
            topic['profile'] = processProfile(response.data)

            // Check for a 404 response
            if (response.status === 404) {
                console.log(`404 error for id: ${topic.id}, url: ${profileUrl}`);
            }

        } catch (error) {
            // Handle errors or continue scraping
            console.error(`Error scraping profile id: ${topic.id}, url: ${profileUrl}: ${error.message}`);
        }
    }

    return topic

}

/**
 * Detects the type of topic page it is
 * The three types are: thread, profile & nt
 * 
 * @param {object} response - The axios get response object https://axios-http.com/docs/res_schema
 * @returns A string with the data type
 */
function getTopicType(ntUrl, urlHasTitle, titleFromHtml) {
    // If it has an nt url it's an NT type post
    if (ntUrl != undefined) {
        return TYPE_NT;
    }

    // If it doesn't have a title in the url and doesn't have a title in the html it's a profile
    // The thread '/ / / / / / / / / / / / / /'  id:697764 has a title in the html but not in the url
    if (!urlHasTitle && titleFromHtml == "") {
        return TYPE_PROFILE;
    }
    return TYPE_THREAD;
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

/**
 * Checks if url is "/topic/number/" or "topic/number-title/" 
 * 
 * @param {string} url - The topic page url
 * @returns boolean true if it has title false if it doesn't
 */
function getUrlHasTitle(url) {
    // Regular expression to match the pattern
    const urlPattern = /^https:\/\/(www\.)?qbn\.com\/topics\/\d+\/?(\?.*)?$/;
    return !urlPattern.test(url)
}

/**
 * Retrieves title from the topic url, get the text after topic id
 * 
 * @param {string} url - The topic page url
 */
function getTitleFromUrl(url) {
    const urlPattern = /^https:\/\/(www\.)?qbn\.com\/topics\/(\d+)-([a-z0-9-]+)\/?(\?.*)?$/;
    const match = url.match(urlPattern)
    return match[3]
}


module.exports = { processTopic };