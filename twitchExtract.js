import axios from 'axios';
import * as puppeteer from 'puppeteer';
import Bottleneck from 'bottleneck';

import dotenv from 'dotenv';
import { Collection } from 'mongodb';
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

async function uploadToDb(idData, client) {
    const db = await client.db("twitter-data");
    const idCollection = await db.collection("id-data");

    idCollection.insertOne(idData, (err, res) => {
        if (err) throw err;
        console.log("Queued document");
    })
}

async function retrieveTwitterIds(creatorDb, client) {
    const fullArray = Array.from(creatorDb);
    
    console.log(fullArray);

    const limiter = new Bottleneck({
        maxConcurrent: 1,
        minTime: 2000,
    });
  
    const requestPromises = fullArray.map(user => {
        return limiter.schedule(() =>{
            return requestId(user[1])
        });
    }); 

    const twitterResults = await Promise.all(requestPromises);

    let promiseNumber = 0;
    const uploadsPromises = [];

    for (const user of fullArray) {
        let idData = {
            "twitchUsername": user[0],
            "twitterId": twitterResults[promiseNumber],
        }
        uploadsPromises.push(uploadToDb(idData, client));
        promiseNumber++;
        if (promiseNumber == twitterResults.length){
            break;
        }
    }

    const uploadResults = await Promise.all(uploadsPromises);
    uploadResults.forEach(() =>{
        console.log("Inserted document")
    })

}

export { getTwitchCreators, findAllTwitter, retrieveTwitterIds }