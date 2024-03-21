import { getTwitchCreators, findAllTwitter, retrieveTwitterIds } from "./twitchExtract.js";
import { client } from './load.js';

async function buildIdDb() {
    // Determines how many creators retrieved per API call
    const batchSize = 20; // Max value of 100
    // Determines how many Twitch API calls made
    const iterations = 1;

    let twitchCursor = '';
    
    for (let i = 0; i < iterations; i++) {
        let twitchResults = await getTwitchCreators(twitchCursor, batchSize);
        let creatorDb = twitchResults.map;
        twitchCursor = twitchResults.cursor;

        await findAllTwitter(creatorDb);
        await retrieveTwitterIds(creatorDb, client);
    }
}

buildIdDb();