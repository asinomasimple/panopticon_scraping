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
    // Retrieve response url
    const responseUrl = response.request.res.responseUrl; // https://axios-http.com/docs/res_schema

    // Deal with deleted topics
    if (response.status === 404) {
        const parts = responseUrl.split("/");
        return {
            id: parts[parts.length - 2],
            user: '',
            title: '',
            date: '',
            post: '',
            status: response.status,
            responseUrl: responseUrl,
            topicType: 'deleted'
        }
    }

    const $ = cheerio.load(response.data);

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
        // https://qbn.com/topics/67880/
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
            const response = await axios.get(profileUrl);
            topic['profile'] = processProfile(response.data)
        } catch (error) {
            // Handle errors or continue scraping
            console.error(`Error processing profile id: ${topic.id}, url: ${profileUrl}, error: ${error.message}`);
            throw Error(error);
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
    // Extract 'invited by user' or 'certified by user', blank if none.
    const endorsement = extractEndorsement($);
    const { endorsementStatus, endorsedBy } = extractEndorsementInfo(endorsement);

    const profile = {
        name: $("#main > ul.details > li.name").text().trim(),
        since: $("#main > h1 > small:nth-child(2)").text().split(' ')[1],
        location: $("#main > ul.details > li.location").text(),
        url: $("#main > ul.details > li.url").text(),
        avatar: $("#main > div").attr("data-url") ?? '',
        endorsementStatus: endorsementStatus,
        endorsedBy: endorsedBy,
        uncertified: $("#main > h1 > small.uncertified > a").text(),
        bio: $("#main > ul.thread.replies > li:nth-child(1) > dl > dd").html()
    }
    return profile
}

/**
 * Extracts the text 'invited by user' or 'certified by user' from a parsed cheerio object.
 * 
 * @param {cheerio} $ - The cheerio parsed object.
 * @returns {string|null} - The extracted text or null if not found.
 */
function extractEndorsement($) {
    const invitedByElement = $('small.invited-by');
    if (invitedByElement.length > 0) {
        return invitedByElement.text();
    }
    return null; // Return null if the tag is not found.
}

/**
 * Extracts the endorsement status and username from a given text.
 * 
 * @param {string} text - The text to parse, like "invited by username" or "certified by username".
 * @returns {Object} - An object with 'certificationStatus' and 'certifiedBy' properties.
 */
function extractEndorsementInfo(text) {
    text = text ?? '';
    const match = text.match(/(invited|certified) by (\w+)/) || [];
    const [_, endorsementStatus, endorsedBy] = match;
    return { endorsementStatus: endorsementStatus || '', endorsedBy: endorsedBy || '' };
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
    // Define a regular expression to match the URL pattern.

    const urlPattern = /^https:\/\/(www\.)?qbn\.com\/topics\/(\d+)\/?(\?.*)?$/;
    // Attempt to match the URL against the pattern.
    const match = url.match(urlPattern);

    if (match) {
        // If there is a match, check if the URL ends with "/topics/123/".
        const isTopicIdURL = url.endsWith("/topics/" + match[2] + "/");

        if (isTopicIdURL) {
            // Return the topic ID as a number.
            return parseInt(match[2], 10);
        } else {
            // Return the text that follows the topic ID.
            return match[3];
        }
    }

    // Return null or an appropriate value for cases where there's no match.
    return null;
}


module.exports = { processTopic };