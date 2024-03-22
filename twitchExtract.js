import axios from 'axios';
import * as puppeteer from 'puppeteer';
import { createClient, connectClient } from './load.js';

import dotenv from 'dotenv';

dotenv.config();

// Retrieve OAuth token from Twitch
async function getTwitchOAuth() {
    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_ID}&client_secret=${process.env.TWITCH_SECRET}&grant_type=client_credentials`,
        headers: { }
    };

    return axios.request(config)
        .then((response) => {
            return response.data
        })
        .catch((error) => console.log(error));
}

// Initialize map of Twitch usernames to be mapped to Twitter links
async function getTwitchCreators(cursor, batchSize) {
    // Initialize Twitch to Twitter link map
    const creatorDb = new Map();

    const token = await getTwitchOAuth();

    const config = {
        method: 'get',
        maxBodyLength: Infinity,
        headers: {
            'Content-Type' : 'application/json',
            'Client-ID': process.env.TWITCH_ID,
            'Authorization': `Bearer ${token.access_token}`,
        }
    }

    if (cursor == '') {
        config.url = `https://api.twitch.tv/helix/streams?first=${batchSize}`;
    }
    else {
        config.url = `https://api.twitch.tv/helix/streams?first=${batchSize}&after=${cursor}`;
    }

    //GET request for /streams endpoint to retrieve creator usernames based on streams with highest viewer count
    return axios.request(config)
        .then((response) => {
            response.data.data.forEach(stream => {
                if (!creatorDb.has(stream.user_name)) {
                    creatorDb.set(stream.user_name, '')
                };
            })
            console.log(creatorDb);
            return {
                'map': creatorDb,
                'cursor': response.data.pagination.cursor
            }
        })
        .catch((error) => console.log(error));
}

// Retrieve Twitter links via scraping
async function findAllTwitter(creatorDb) {
    const browser = await puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: false,
    })

    for (const [key, value] of creatorDb.entries()) {
        let page = await browser.newPage();
        const twitchLink = `https://twitch.tv/${key}/about`;

        // Search for Twitter link in "About" section of Twitch
        try {
            await page.goto(twitchLink);
            await page.waitForSelector(
                'a.ScCoreLink-sc-16kq0mq-0.dFpxxo.tw-link',
                { timeout: 5000 }
            );
            const twitterLink = await page.$eval('a.ScCoreLink-sc-16kq0mq-0.dFpxxo.tw-link[href*=twitter]', tw => tw.href);
            // Map Twitch username to Twitter link
            const splitLink = twitterLink.split('/');
            const twitterUsername = splitLink[splitLink.length - 1];

            creatorDb.set(key, twitterUsername);
            console.log("Twitter username successfully found");
        }
        catch (error) {
            console.error("Timed out trying to retrieve Twitter username");
        }
        finally {
            await page.close();
        }
    }
    await browser.close()
}

async function requestId(user) {
    const options = {
        method: 'GET',
        url: 'https://twitter241.p.rapidapi.com/user',
        params: {
            username: user
        },
        headers: {
            'X-RapidAPI-Key': process.env.TWITTER_KEY,
            'X-RapidAPI-Host': 'twitter241.p.rapidapi.com'
        }
    }
    
    return axios.request(options)
        .then((response) => {
            return response.data.result.data.user.result.rest_id;
        })
        .catch((error) => console.log(error));
}

async function concurrentReqTwitter(requestPromises, creatorDb) {
    const client = createClient();
    try {
        await connectClient(client);

        const twitterDb = await client.db("twitter-data");
        const collection = await twitterDb.collection("id-data");

        const uploadsPromises = [];

        Promise.all(requestPromises)
            .then((results) => {
                let promiseNumber = 0;
        
                for (const [key, value] of creatorDb.entries()) {
                    let idData = {
                        "twitchUsername": key,
                        "twitterId": results[promiseNumber],
                    }
                    uploadsPromises.push(
                        collection.insertOne(idData, (err, res) => {
                            if (err) throw err;
                            console.log("Queued document");
                        })
                    )
                    promiseNumber++;
                    if (promiseNumber == results.length){
                        break;
                    }
                }
            })
            
        return uploadsPromises;
    }
    finally {
        await client.close();
    }
}

async function concurrentUploadTwitter(uploadsPromises){
    Promise.all(uploadsPromises)
        .then((results) => {
            results.forEach(() =>{
                console.log("Inserted document")
            })
        })
}

function sliceCreatorDb(creatorDb) {
    const creatorDbArray = Array.from(creatorDb);
    const fullArray = [];

    let count = 0;
    while(true){
        if (count + 10 >= creatorDbArray.length){
            fullArray.push(creatorDbArray.slice(count))
            break;
        }
        else {
            fullArray.push(creatorDbArray.slice(count, count + 10))
            count += 10;
        }
    }
    
    return fullArray;
}

async function retrieveTwitterIds(creatorDb) {
    const fullArray = sliceCreatorDb(creatorDb);

    try {
        for (const arrayBatch of fullArray){
            const requestPromises = [];
            
            for (const user of arrayBatch){
                requestPromises.push(requestId(user[1]));
            }

            const uploadsPromises = await concurrentReqTwitter(requestPromises, creatorDb);
            await concurrentUploadTwitter(uploadsPromises);
        }
    }
    catch(error) {
        console.log(error);
    }
}

export { getTwitchCreators, findAllTwitter, retrieveTwitterIds }