import moment from 'moment';
moment().format();

async function uploadAggData (query, aggData, client) {
    const db = await client.db("twitter-data");
    const aggCollection = await db.collection("tweets-aggregations");

    aggCollection.updateOne(query, aggData, { upsert: true} );
}

async function handleAggData (aggCursor, client) {
    const uploadsPromises = [];

    for await (const doc of aggCursor) {
        console.log(doc);
        console.log("IMKMS")
        const query = { "user_id": doc._id }
        const aggData = { $set: {
            "user_id": doc._id,
            "avg_views": doc.avg_views,
            "avg_likes": doc.avg_likes,
            "avg_retweets": doc.avg_retweets,
            "avg_quotes": doc.avg_quotes,
            "avg_replies": doc.avg_replies,
            "avg_bookmarks": doc.avg_bookmarks
        }}
        uploadsPromises.push(uploadAggData(query, aggData, client));
    }
    
    console.log(await uploadsPromises);

    return uploadsPromises;
}

async function aggregate(client) {
    const db = client.db("twitter-data");
    const tweetsCollection = db.collection("tweets");

    const date = moment().subtract(30, 'days').toDate();

    const pipeline = [
        { $match: { date_posted: { $gt: date }} },
        { $group: { 
            _id: "$user_id",
            avg_views: { $avg: "$views" },
            avg_likes: { $avg: "$likes" },
            avg_retweets: { $avg: "$retweets" },
            avg_quotes: { $avg: "$quotes" },
            avg_replies: { $avg: "$replies" },
            avg_bookmarks: { $avg: "$bookmarks" }
        }}
    ]

    const aggCursor = tweetsCollection.aggregate(pipeline);

    const uploadsPromises = handleAggData(aggCursor, client);

    const uploadResults = await Promise.all(uploadsPromises);
    uploadResults.forEach(() =>{
        console.log("Calculated aggregation");
    })

}

export { aggregate }