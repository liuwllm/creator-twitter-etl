import * as puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

async function getTwitterInfo(creatorDb) {
    const browser = await puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: false,
    })

    for (const [key, value] of creatorDb.entries()) {
        if (value == '') {
            continue;
        }
        
        let page = await browser.newPage();
        const nitterLink = `https://nitter.tux.pizza/${value}`;
        await page.goto(nitterLink);

        // Scrape Nitter instance for bio and Tweet data
        try {
            await page.waitForSelector(
                '.timeline-container',
                { timeout: 5000 }
            );
            console.log(await page.content());
            const twitterBio = await page.$eval('.profile-bio', div => div.innerHTML);
            const twitterLocation = await page.$eval('.profile-location > :nth-child(2)', div => div.innerHTML);
            const twitterWebsite = await page.$eval('.profile-website > :first-child > :nth-child(2)', div => div.href);
            const twitterPosts = await page.$eval('.posts > :nth-child(2)', div => div.innerHTML);
            const twitterFollowing = await page.$eval('.following > :nth-child(2)', div => div.innerHTML);
            const twitterFollowers = await page.$eval('.followers > :nth-child(2)', div => div.innerHTML);
            const twitterLikes = await page.$eval('.likes > :nth-child(2)', div => div.innerHTML);
            console.log(twitterFollowing+"TT");

            let tweetsCollection = [];

            const tweetUsername = await page.$$eval('.username', divs => {
                return divs.map(div => div.innerHTML);
            });
            const tweetBody = await page.$$eval('.tweet-content.media-body', divs => {
                return divs.map(div => div.innerHTML);
            });
            const tweetComments = await page.$$eval('.tweet-stats > :first-child', divs => {
                return divs.map(div => div.lastChild.textContent.trim());
            });
            const tweetRetweets = await page.$$eval('.tweet-stats > :nth-child(2)', divs => {
                return divs.map(div => div.lastChild.textContent.trim());
            });
            const tweetQuotes = await page.$$eval('.tweet-stats > :nth-child(3)', divs => {
                return divs.map(div => div.lastChild.textContent.trim());
            });
            const tweetLikes = await page.$$eval('.tweet-stats > :nth-child(4)', divs => {
                return divs.map(div => div.lastChild.textContent.trim());
            });

            for (let i = 0; i < 10; i++) {
                if (tweetUsername[i] == `@${value}`) {
                    tweetsCollection.push({
                        "body": tweetBody[i],
                        "comments": tweetComments[i],
                        "retweets": tweetRetweets[i],
                        "quotes": tweetQuotes[i],
                        "likes": tweetLikes[i]
                    })
                }
            }

            console.log(tweetsCollection);

            creatorDb.set(
                key, 
                {
                    "username": value,
                    "profile": {
                        "bio": twitterBio,
                        "location": twitterLocation,
                        "website": twitterWebsite,
                        "posts": twitterPosts,
                        "following": twitterFollowing,
                        "followers": twitterFollowers,
                        "likes": twitterLikes
                    },
                    "tweets": tweetsCollection,
                });
            console.log("Twitter data successfully found");
            console.log(creatorDb);
        }
        catch (error) {
            console.log(error);
        }
        finally {
            await page.close();
        }
    }
    await browser.close()
}

let map = new Map();
map.set("test", "TenZOfficial")

getTwitterInfo(map);

export { getTwitterInfo }