import _ from 'lodash';
import axios from 'axios';

import dotenv from 'dotenv';

dotenv.config();

// Retrieve OAuth token from Twitch
async function getTwitchOAuth() {
    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://id.twitch.tv/oauth2/token?client_id=ho5ey7ej0cfvywswac5ivjpub0gk3h&client_secret=tqwy5g03byx5ub5w4jl3ecvd9xyjci&grant_type=client_credentials',
        headers: { }
    };

    return axios.request(config)
        .then((response) => {
            return response.data
        })
        .catch((error) => console.log(error));
}

async function initializeCreators() {
    // Initialize Twitch to Twitter link map
    const creatorDb = new Map();
    
    console.log(process.env.TWITCH_ID);

    const token = await getTwitchOAuth();
    console.log('Bearer ' + token.access_token);

    const config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'https://api.twitch.tv/helix/streams',
        headers: {
            'Content-Type' : 'application/json',
            'Client-ID': process.env.TWITCH_ID,
            'Authorization': `Bearer ${token.access_token}`,
        }
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
            return creatorDb;
        })
        .catch((error) => console.log(error));
}

initializeCreators();