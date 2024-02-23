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
        
        // Open Nitter page
        let page = await browser.newPage();
        const nitterLink = `https://nitter.tux.pizza/${value}`;
        await page.goto(nitterLink);

        // Scrape Nitter instance for bio and Tweet data
        try {
            await page.waitForSelector(
                '.timeline-container',
                { timeout: 5000 }
            );
            // Scrape all profile information
            const twitterBio = await page.$eval('.profile-bio', div => div.innerHTML);
            const twitterLocation = await page.$eval('.profile-location > :nth-child(2)', div => div.innerHTML);
            const twitterWebsite = await page.$eval('.profile-website > :first-child > :nth-child(2)', div => div.href);
            const twitterPosts = await page.$eval('.posts > :nth-child(2)', div => div.innerHTML);
            const twitterFollowing = await page.$eval('.following > :nth-child(2)', div => div.innerHTML);
            const twitterFollowers = await page.$eval('.followers > :nth-child(2)', div => div.innerHTML);
            const twitterLikes = await page.$eval('.likes > :nth-child(2)', div => div.innerHTML);
            console.log(twitterFollowing+"TT");

            let tweetsCollection = [];
            
            // Scrape all info from tweets
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

            // Organize data into individual tweets
            for (let i = 0; i < 10; i++) {
                if (tweetUsername[i] == `@${value}`) {
                    tweetsCollection.push({
                        "body": tweetBody[i],
                        "comments": parseInt(tweetComments[i].replace(',', '')),
                        "retweets": parseInt(tweetRetweets[i].replace(',', '')),
                        "quotes": parseInt(tweetQuotes[i].replace(',', '')),
                        "likes": parseInt(tweetLikes[i].replace(',', ''))
                    })
                }
            }


            // Calculate aggregates
            let commentsSum = 0;
            let retweetsSum = 0;
            let quotesSum = 0;
            let likesSum = 0;
            for (const tweet of tweetsCollection){
                commentsSum += tweet.comments;
                retweetsSum += tweet.retweets;
                quotesSum += tweet.quotes;
                likesSum += tweet.likes;
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
                    "tweetStats": {
                        "avgComments": commentsSum / tweetsCollection.length,
                        "avgRetweets": retweetsSum / tweetsCollection.length,
                        "avgQuotes": quotesSum / tweetsCollection.length,
                        "avgLikes": likesSum / tweetsCollection.length,
                    }
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

export { getTwitterInfo }