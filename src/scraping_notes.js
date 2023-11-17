const { fetchPagesFromArray } = require("./fetch");
const { processReply } = require("./process");
const {getLastReplyIdFromNotes, insertNotes} = require("./database");

/**
 * Checks the 'notes' table, retrieve last reply_id and scrapes new replies 
 * Inserts notes from replies in the 'notes' table
 */
async function scrapeNotes(replyId) {
    console.log("scraping notes....")
    // Get the last reply id
    if(replyId === undefined){
        replyId = await getLastReplyIdFromNotes()+1;
    }
    const amount = 1;
    console.log(`fetch ids ${replyId} to ${replyId+amount-1}`);


    if(replyId+amount > 4106617){
        throw Error("You've gone too far")
    }

    // Build url
    const urls = Array.from({ length: amount }, (_, i) => `https://qbn.com/reply/${replyId + i}/`);

    // Fetch pages
    const fetched = await fetchPagesFromArray(urls)
    console.log("urls fetched")

    // Process the fetched pages
    const dataPromises = fetched.map(data => processReply(data));
    const data = await Promise.all(dataPromises);
    console.log("data processed")

    // Filter the replies with notes
    const repliesWithNotes = data.filter(d => d.notes.length > 0)
    // Add reply id and position to each note
    const notes = repliesWithNotes.map(d => d.notes.map((n,i) => ({ ...n, reply_id: d.id , position:i}) )).flat()
    
    await insertNotes(notes)

    console.log("Start again....")
    scrapeNotes(replyId+amount)

}

scrapeNotes()