import { getTwitchCreators, findAllTwitter } from "./twitchExtract.js";

async function main() {
    // Determines how many creators retrieved per API call
    const batchSize = 1; // Max value of 100
    // Determines how many Twitch API calls made
    const iterations = 2;

    let twitchCursor = '';
    
    for (let i = 0; i < iterations; i++) {
        let twitchResults = await getTwitchCreators(twitchCursor, batchSize);
        let creatorDb = twitchResults.map;
        twitchCursor = twitchResults.cursor;
    
        // Scrape Twitch for Twitter links
        await findAllTwitter(creatorDb);
        console.log(creatorDb);
    }
}

main();