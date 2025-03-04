const { updateAndScrapeReplies, updateLatestReplies , scrapeNewReplies} = require('./src/scraping_replies.js');
const { scrapeTopics: importTopics } = require('./src/scraping_topics.js')
const cron = require('node-cron');
// npm start
// npm run deploy:


async function start() {
    try {
        console.log(`start ${new Date()}`)
        await importTopics();
        await updateAndScrapeReplies();
        console.log(`___end`)
    } catch (error) {
        console.error('Error in start function:', error);
        // Wait for 30 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 30000));
        start(); // Retry the operation
    }
}

async function getUpToDate(){
    try {
        console.log(`getUpToDate ${new Date()}`)
        await importTopics();
        await scrapeNewReplies(50, 2)
        console.log(`___end`)
    } catch (error) {
        console.error('Error in getUpToDate function:', error);
        // Wait for 30 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 30000));
        getUpToDate(); // Retry the operation
    }
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
    console.log('Initializing cron schedule...');
    getUpToDate();
    // Schedule the job to run every 5 minutes
    cron.schedule('*/5 * * * *', () => {
        console.log('Cron job triggered at:', new Date());
        start();
    });
    console.log('Cron schedule initialized');
}

// Initialize the cron schedule
startCron();
