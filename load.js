import { MongoClient, ServerApiVersion } from 'mongodb';
import { getTwitterInfo } from './twitterExtract.js';

const uri = process.env.MONGODB_URI

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run(creatorDb) {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    
        await load(creatorDb, client);
    }
    finally {
        await client.close();
    }
};

async function load(creatorDb, client) {
    const tweetDb = await client.db("twitter-data");
    const collection = await tweetDb.collection("data");

    for (const [key, value] of creatorDb.entries()) {
        let userData = {
            "twitchUsername": key,
            "data": value
        };

        await collection.insertOne(userData, (err, res) => {
            if (err) throw err;
            console.log("Inserted document");
        })
    }
};

export { run }