const axios = require('axios');

async function findOldestTopicNumber() {
    // Starting from a known maximum topic number
    let topicNumber = 67369;
    let oldestExistingTopic = null;
    console.log("start")
    while (topicNumber > 0) {
      const url = `https://qbn.com/topics/${topicNumber}/`;
  
      try {
        // Attempt to make a GET request to the topic URL
        await axios.get(url);
  
        // If the request succeeds, update the oldestExistingTopic and continue checking the next lower topic number
        oldestExistingTopic = topicNumber;
        console.log(topicNumber)
      } catch (error) {
        // If the request fails, check the next lower topic number
        console.log("request failed")
        if (oldestExistingTopic !== null) {
            console.log(`Oldest existing topic number found: ${oldestExistingTopic}`);
          } else {
            console.log("No existing topics found.");
          }
          topicNumber -= 1;
      }
  
      // Decrement the topic number
      topicNumber -= 1;
    }
  

    console.log("end")
  }
  

findOldestTopicNumber();