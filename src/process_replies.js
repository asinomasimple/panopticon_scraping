const cheerio = require('cheerio');
const { fetchPage } = require('./fetch');

// Topic types
const TYPE_THREAD = "thread";
const TYPE_PROFILE = "profile";
const TYPE_NT = "nt";

/**
 * Process fetched reply response data
 *
 * @param {object} response - The axios get response object https://axios-http.com/docs/res_schema
 * @returns A data object
 */
async function processReply(response) {
    // Retrieve response url
    const responseUrl = response.request.res.responseUrl; // https://axios-http.com/docs/res_schema

    // Deal with deleted topics
    if (response.status === 404) {
        const parts = responseUrl.split("/");
        return {
            id: parts[parts.length - 2],
            status: response.status
        }
    }

    // Use cheerio to extract data
    const $ = cheerio.load(response.data);
    const id = + $("#main > ul.thread.replies > li > dl > dd.main > div.meta > div.flagger").attr("data-id");
    const replyNumberString = $("#main > h2:nth-child(2) > a").text();
    const replyNumber = replyNumberString.slice(replyNumberString.indexOf("#") + 1);
    const user = $("#main > ul.thread.replies > li > dl > dd.main > div.meta > a.user").text().trim();
    const created = new Date($("#main > ul.thread.replies > li > dl > dd.main > div.meta > a.created").attr("date"));
    const topicTitle = $("h1").text();
    const post = $("#main > ul.thread.replies > li > dl > dd.main .body").html();
    const score = + $("#main > ul.thread.replies > li > dl > dt > span").text();

    // Check error for topicId
    let topicId;
    try {
        topicId = + $("#main > h1 > a").attr("href").split("/")[2]
    } catch (error) {
        console.log(`Process reply cannot get topicId for reply ${response.id}`)
        throw error
    }

    // Extract notes
    const notes = extractNotes($, id);

    // Build reply object
    const reply = {
        id: id,
        user: user,
        date: created,
        topicTitle: topicTitle,
        topicId: topicId,
        replyNumber: replyNumber,
        post: post,
        notes: notes,
        score: score,
        status: response.status
    }

    return reply;
}


/**
 * Extract notes from a Cheerio object.
 *
 * @param {Cheerio} $ - The Cheerio object representing the HTML document.
 * @param {number} replyId - The ID of the reply.
 * @returns {?Array} An array of objects representing notes with additional metadata, or null if no notes are found.
 * @throws {Error} Throws an error if notes extraction fails.
 */
function extractNotes($, replyId) {
    /**
     * @typedef {Object} Note
     * @property {string} comment - The content of the note.
     * @property {string} user - The username associated with the note.
     * @property {number} replyId - The ID of the reply to which the note belongs.
     * @property {number} position - The position of the note starting from 0.
     * @property {string} htmlComment - The html content of the comment.
     */

    // Go through notes
    const notesHTML = $("#main > ul.thread.replies > li > dl > dd.notes > div > ul > li");
    if (notesHTML.length > 0) {
        // Convert notes li to data object and store in array
        const notes = [];

        notesHTML.each((i, e) => {
            const user = $(e).find(".user").text();
            const comment = $(e).find("span").text();
            const htmlComment = $(e).find("span").html();
            /**
            * @type {Note}
            */
            const note = { comment, user, replyId, position: i , htmlComment};
            notes.push(note);
        })
        return notes;

    } else {
        return null;
    }
}


module.exports = { processReply};