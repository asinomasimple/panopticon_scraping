const { updateAndScrapeReplies } = require('./src/scraping_replies.js');
const { scrapeTopics: importTopics } = require('./src/scraping_topics.js')
const cron = require('node-cron');
// npm start
// npm run deploy:


async function start() {
    console.log(`start ${new Date()}`)
    await importTopics();
    await updateAndScrapeReplies();
    console.log(`___end`)
}


exports.scrapeReplies = async () => {
    updateAndScrapeReplies();
}

exports.scrapeTopics = async () => {
    importTopics()
}

exports.example = async (message, context) => {
    const data = Buffer.from(message.data, 'base64').toString();
    console.log(`Received message: ${data}`);
}


function startCron() {
    // Schedule the job to run every 5 minutes
    cron.schedule('*/5 * * * *', () => {
        start();
    });

}
startCron();