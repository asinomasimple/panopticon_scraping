const { fetchPagesFromArray } = require('../src/fetch');
const { processTopic } = require('../src/process');
const axios = require('axios');


const BASE_URL = 'https://qbn.com/topics/';

/**
 * Fetches multiple types of profiles
 */
async function testProfiles(){
    // utopian 541583 green
    // garbage 695391 certified
    // palimpsest 764338 invited
    // ORAZAL 509741 deleted
    // bollylands 772882 uncertified

    const ids = [541583]//, 695391, 764338, 509741, 772882 ];
    const urls = ids.map(v => (BASE_URL+v+"/"));
    console.log(`urls  ${urls}`)

    const fetched = await fetchPagesFromArray(urls);
    // Process the fetched topics
    const processedDataPromises = fetched.map(data => processTopic(data));
    const processedData = await Promise.all(processedDataPromises);
    console.log(processedData);
}
