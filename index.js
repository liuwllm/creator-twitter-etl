import { getTwitchCreators, findAllTwitter, retrieveTwitterIds } from "./twitchExtract.js";
import { retrieveTweets } from "./twitterAPIextract.js";
import { MongoClient } from 'mongodb';
import { aggregate } from './aggregate.js'

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
        //twitchCursor = twitchResults.cursor;

        let creatorDb = new Map();
        creatorDb.set("bao", "baovtuber");
        creatorDb.set("CDawgVA", "CDawgVA");
        //await findAllTwitter(creatorDb);
        await retrieveTwitterIds(creatorDb, client);
    }
}

async function main() {
    const uri = process.env.MONGODB_URI
    
    // Change values depending on which function needed; typically will only be retrieving tweets
    const buildingDb = true;
    const retrievingTweets = true;

    if (!client) {
        client = new MongoClient(uri);
    }
    
    try{
        await client.connect();
        if (buildingDb){
            //await buildIdDb(client);
        }
        if (retrievingTweets){
            //await retrieveTweets(client);
            await aggregate(client);
        }
    }
    catch (error) {
        console.error(error);
    }
}

await main();