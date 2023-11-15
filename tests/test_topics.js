
const cheerio = require('cheerio');
const axios = require('axios');
const { database } = require('../config/config');
const mysql = require('mysql2/promise');


// Topic types
const TYPE_THREAD = "thread";
const TYPE_PROFILE = "profile";
const TYPE_NT = "nt";

async function getTopic(){
    const url = 'https://qbn.com/topics/512107/';

    try {
        // Make a GET request to the url
        const response = await axios.get(url);

        const data = await processJustTopic(response);
        console.log(data)

        const db = await addTopicToDb([data])
        console.log(db)



    } catch (error) {
        // Log error and continue fetching
        console.error(`Error fetching id:${id} from url:${url}. Error:${error.message}`);
        fetchedData.push(error.response);
    }
}
/**
 * Creates the database connection
 */
async function createDbConnection() {
    const connection = await mysql.createConnection(database);
    return connection;
}

/**
 * Process fetched topic response data, doesn't get profile 
 *
 * @param {object} response - The axios get response object https://axios-http.com/docs/res_schema
 * @returns A data object
 */
async function processJustTopic(response) {
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
        post: $("#main > ul > li.news > dl > dd.main > div.body").html() ?? '',
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
    return topic

}


/**
 * Adds data objects to 'topics' table in database
 * 
 * @param {array} data Data objects with the records to insert in the db
 * @returns {Promise} A Promise that resolves when the insertion is complete or rejects on error.
 */
async function addTopicToDb(data) {
    return new Promise(async (resolve, reject) => {
        const connection = await createDbConnection();

        try {
            await connection.beginTransaction();

            for (const d of data) {

                // Base topic, if no extra table needed it's a "thread"
                const topicsInsertSql = 'INSERT INTO topics (id, status, title, date, post, user, topic_type) VALUES (?, ?, ?, ?, ?, ?, ?)';
                const topicsValues = [d.id, d.status, d.title, d.date, d.post, d.user, d.topicType];
                await connection.execute(topicsInsertSql, topicsValues);
            }

            await connection.commit();
            console.log(`${data.length} topics inserted successfully.`);
            resolve('Data inserted successfully.');
        } catch (error) {
            await connection.rollback();
            console.error('Error', error);
            reject(error);
        } finally {
            connection.close();
        }
    });
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


getTopic()