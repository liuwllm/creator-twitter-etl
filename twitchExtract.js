import _ from 'lodash';
import axios from 'axios';
import * as puppeteer from 'puppeteer';

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
        await page.goto(twitchLink);

        // Search for Twitter link in "About" section of Twitch
        try {
            await page.waitForSelector(
                'a.ScCoreLink-sc-16kq0mq-0.dFpxxo.tw-link',
                { timeout: 5000 }
            );
            const twitterLink = await page.$eval('a.ScCoreLink-sc-16kq0mq-0.dFpxxo.tw-link[href*=twitter]', tw => tw.href);
            // Map Twitch username to Twitter link
            creatorDb.set(key, twitterLink);
            console.log("Twitter link successfully found");
        }
        catch (error) {
            console.error("Timed out trying to retrieve Twitter link");
        }
        finally {
            await page.close();
        }
    }
    await browser.close()
}

export { getTwitchCreators, findAllTwitter }