# creator-twitter-etl

This project is an ETL pipeline that collects Twitter data from top Twitch streamers and loads this data into a MongoDB database.

This project makes use of the Twitch API to retrieve Twitch streamers with the highest CCV. A Twitter username is found for each streamer by scraping the streamer's About section on Twitch. A Nitter instance is then scraped for all relevant data for each streamer.

This project currently retrieves the following data from each Twitter profile in the following format:
```javascript
{
    "twitchUsername": "",
    "data": {
        "username": "",
        "profile": {
            "bio": "",
            "location": "",
            "website": "",
            "posts": "",
            "following": "",
            "followers": "",
            "likes": "",
        },
        "tweets": {
            [{
                "body": "",
                "comments": "",
                "retweets": "",
                "quotes": "",
                "likes": "",
            }]
        },
        "tweetStats": {
            "avgComments": "",
            "avgRetweets": "",
            "avgQuotes": "",
            "avgLikes": "",
        },
    }
}
```

## Usage
Set up a .env file in the root directory with your Twitch ID, Twitch Secret, and MongoDB URI as such:

```
TWITCH_ID=my_id
TWITCH_SECRET=my_secret
MONGODB_URI="my_uri"
```

Change the number of creators data is retrieved for by adjusting the `batchSize` variable and `iterations` variable in `index.js`.

```javascript
// Determines how many creators retrieved per API call
const batchSize = 10; // Max value of 100
// Determines how many Twitch API calls made
const iterations = 1;
```

Run the pipeline in the root directory as such:
```shell
node index.js
```