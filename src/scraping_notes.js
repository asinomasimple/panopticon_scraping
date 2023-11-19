const { fetchPagesFromArray } = require("./fetch");
const { processReply } = require("./process_replies");
const {getLastReplyIdFromNotes, insertNotes, updateNotesInDb} = require("./db_replies");

/**
 * Checks the 'notes' table, retrieve last reply_id and scrapes new replies 
 * Inserts notes from replies in the 'notes' table
 */
async function scrapeNotes(replyId) {
    console.log("scraping notes....")

    /*
    // Get the last reply id
    if(replyId === undefined){
        replyId = await getLastReplyIdFromNotes()+1;
    }
    const amount = 1;
    console.log(`fetch ids ${replyId} to ${replyId+amount-1}`);


    if(replyId+amount > 4106617){
        throw Error("You've gone too far")
    }*/

    // Build url
    const urls = [4106712, 4106700, 4106701].map(v => `https://qbn.com/reply/${v}/`)

    // Fetch pages
    const fetched = await fetchPagesFromArray(urls)
    console.log("urls fetched")

    // Process the fetched pages
    const dataPromises = fetched.map(data => processReply(data));
    const data = await Promise.all(dataPromises);
    console.log("data processed")

    // Extract notes from data
    const notes = data.filter(d => d.notes != null)
        .map(d => d.notes);
    
    // Update notes in db
    if (notes.length > 0) {
        const notesPromises = notes.map(d => updateNotesInDb(d));
        const updatedNotes = await Promise.all(notesPromises);
    }
    console.log("done scraping notes")
}

scrapeNotes()