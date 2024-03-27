import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config();

import moment from 'moment';
moment().format();

import Bottleneck from 'bottleneck';

async function requestTweets(userId, cursor = null) {
    const options = {
        method: 'GET',
        url: 'https://twitter241.p.rapidapi.com/user-tweets',
        params: {
            user: userId,
            count: 20,
        },
        headers: {
            'X-RapidAPI-Key': process.env.TWITTER_KEY,
            'X-RapidAPI-Host': 'twitter241.p.rapidapi.com'
        }
    }

    if (cursor) {
        options.params.cursor = cursor;
    }

    return axios.request(options)
        .then((response) => {
            return {
                "id": userId,
                "data": response.data.result,
            };
        })
        .catch((error) => console.log(error));
}

async function uploadTweet(tweetData, client) {
    const db = await client.db("twitter-data");
    const tweetCollection = await db.collection("tweets");

    tweetCollection.insertOne(tweetData, (err, res) => {
        if (err) throw err;
        console.log("Queued document");
    })
}

async function uploadProfileData (query, profileData, client) {
    const db = await client.db("twitter-data");
    const profileCollection = await db.collection("profile-data");

    profileCollection.updateOne(query, profileData, { upsert: true});
}

function handleTweets(result, lastUpdated, allTweetsFound, uploadsPromises, client) {
    let cursor;
    let tweetsLocation;

    for (let section of result.data.timeline.instructions) {
        if (section.type == "TimelineAddEntries") {
            tweetsLocation = section
        }
    }

    for (let tweet of tweetsLocation.entries){
        try {
            if (tweet.content.__typename == "TimelineTimelineCursor"){
                if (tweet.content.cursorType == "Bottom"){
                    cursor = tweet.content.value;
                }
                continue;
            }
            else if (tweet.content.__typename != "TimelineTimelineItem"){
                continue;
            }
            else if (tweet.content.itemContent.__typename != "TimelineTweet"){
                continue;
            }

            let dateOfTweet = moment(tweet.content.itemContent.tweet_results.result.legacy.created_at, "ddd MMM DD hh:mm:ss ZZ YYYY").toDate();

            if (dateOfTweet < lastUpdated) {
                allTweetsFound = true;
                break;
            }

            if (dateOfTweet > lastUpdated) {
                const tweetData = {
                    "user_id": result.id,
                    "date_posted": dateOfTweet,
                    "body": tweet.content.itemContent.tweet_results.result.legacy.full_text,
                    "views": parseInt(tweet.content.itemContent.tweet_results.result.views.count),
                    "likes": tweet.content.itemContent.tweet_results.result.legacy.favorite_count,
                    "retweets": tweet.content.itemContent.tweet_results.result.legacy.retweet_count,
                    "quotes": tweet.content.itemContent.tweet_results.result.legacy.quote_count,
                    "replies": tweet.content.itemContent.tweet_results.result.legacy.reply_count,
                    "bookmarks": tweet.content.itemContent.tweet_results.result.legacy.bookmark_count,
                }
                uploadsPromises.push(uploadTweet(tweetData, client));
                lastUpdated = dateOfTweet;
            }
        }
        catch (error){
            console.log(error);
            continue;
        }
    }

    return {
        allTweetsFound: allTweetsFound,
        uploadsPromises: uploadsPromises,
        cursor: cursor,
        lastUpdated: lastUpdated
    };
}

function handleProfileData (result, lastUpdated, uploadsPromises, client) {
    let tweetsLocation;

    for (let section of result.data.timeline.instructions) {
        if (section.type == "TimelineAddEntries") {
            tweetsLocation = section
        }
    }

    for (let tweet of tweetsLocation.entries){
        try {
            if (tweet.content.__typename != "TimelineTimelineItem"){
                continue;
            }
            else if (tweet.content.itemContent.__typename != "TimelineTweet"){
                continue;
            }

            let dateOfTweet = moment(tweet.content.itemContent.tweet_results.result.legacy.created_at, "ddd MMM DD hh:mm:ss ZZ YYYY").toDate();

            if (dateOfTweet < lastUpdated) {
                break;
            }

            if (dateOfTweet > lastUpdated) {
                const query = { "user_id": result.id }
                const profileData = { $set: {
                    "user_id": result.id,
                    "last_updated": dateOfTweet,
                    "description": tweet.content.itemContent.tweet_results.result.core.user_results.result.legacy.description,
                    "total_likes": tweet.content.itemContent.tweet_results.result.core.user_results.result.legacy.favourites_count,
                    "total_followers": tweet.content.itemContent.tweet_results.result.core.user_results.result.legacy.followers_count,
                    "location": tweet.content.itemContent.tweet_results.result.core.user_results.result.legacy.location,
                    "verified": tweet.content.itemContent.tweet_results.result.core.user_results.result.legacy.verified,
                }}
                uploadsPromises.push(uploadProfileData(query, profileData, client));
                break;
            }
        }
        catch (error){
            console.log(error);
            continue;
        }
    }

    return uploadsPromises;
}

async function retrieveTweets(client) {
        const twitterDb = await client.db("twitter-data");
        const idCollection = await twitterDb.collection("id-data");
        const profileCollection = await twitterDb.collection("profile-data");

        const cursorPromises = [];
        const idCursor = await idCollection.find({}, {twitterId:1});
        while (await idCursor.hasNext()){
            cursorPromises.push(idCursor.next());
        }
        const idArray = await Promise.all(cursorPromises);

        const limiter = new Bottleneck({
            maxConcurrent: 1,
            minTime: 2000
        });
        const requestPromises = idArray.map(idEntry => {
            return limiter.schedule(() => {
                return requestTweets(idEntry.twitterId);
            });
        });
        const tweetResults = await Promise.all(requestPromises);

        let uploadsPromises = [];
        let allTweetsFound = false;
        let lastUpdated = moment().subtract(2, 'days').toDate();

        for (let result of tweetResults) {
            try {
                console.log(await profileCollection.findOne({user_id: result.id}, {last_updated:1}));
                console.log("HELP")
                if (await profileCollection.findOne({user_id: result.id}, {last_updated:1}) != null) {
                    lastUpdated = await profileCollection.findOne({user_id: result.id}, {last_updated:1})
                    console.log(lastUpdated);
                }
                
                let handleResult = handleTweets(result, lastUpdated, allTweetsFound, uploadsPromises, client);
                allTweetsFound = handleResult.allTweetsFound;
                uploadsPromises = handleResult.uploadsPromises;

                let currCursor = handleResult.cursor;

                if (allTweetsFound == false) {
                    while (allTweetsFound == false) {
                        let subsequentResult = await limiter.schedule(() => {return requestTweets(result.id, currCursor)});
                        let handleSubsequent = handleTweets(subsequentResult, lastUpdated, allTweetsFound, uploadsPromises, client);
                        currCursor = handleSubsequent.cursor;
                        allTweetsFound = handleSubsequent.allTweetsFound;
                        uploadsPromises = handleResult.uploadsPromises;
                        lastUpdated = handleResult.lastUpdated;
                    }
                }

                uploadsPromises = handleProfileData(result, lastUpdated, uploadsPromises, client);

                const uploadResults = await Promise.all(uploadsPromises);
                uploadResults.forEach(() =>{
                    console.log("Inserted document");
                })
                await idCursor.close();
            }
            catch (error) {
                console.log(error);
                continue;
            }
        }
}

export { retrieveTweets }