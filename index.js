import { getTwitchCreators, findAllTwitter, retrieveTwitterIds } from "./twitchExtract.js";
import { retrieveTweets } from "./twitterAPIextract.js";
import { MongoClient, ServerApiVersion } from 'mongodb';

import dotenv from 'dotenv';
dotenv.config();

let client;

async function closeDb() {
    await client.close();
}

async function buildIdDb(client) {
    // Determines how many creators retrieved per API call
    const batchSize = 2; // Max value of 100
    // Determines how many Twitch API calls made
    const iterations = 1;

    let twitchCursor = '';
    
    for (let i = 0; i < iterations; i++) {
        //let twitchResults = await getTwitchCreators(twitchCursor, batchSize);
        //let creatorDb = twitchResults.map;
        let creatorDb = new Map();
        creatorDb.set('bao', 'baovtuber')
        creatorDb.set('CDawgVA', 'CDawgVA')
        //twitchCursor = twitchResults.cursor;

        //await findAllTwitter(creatorDb);
        await retrieveTwitterIds(creatorDb, client);
    }
}

async function main() {
    const uri = process.env.MONGODB_URI
    
    if (!client) {
        client = new MongoClient(uri);
    }
    
    try{
        await client.connect();
        //await buildIdDb(client);
        await retrieveTweets(client);
    }
    catch (error) {
        console.error(error);
    }
}

await main();