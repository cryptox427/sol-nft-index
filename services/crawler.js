const axios = require('axios');
const Pool = require('pg').Pool
const pool = new Pool({
    user: 'me',
    host: 'localhost',
    database: 'api',
    password: 'gentle',
    port: 5432,
})
const format = require('pg-format');
const {getNFTsByCollection, getNFTTokens} = require('./web3');

const getCollections = () => {
    return new Promise(((resolve, reject) => {
        axios.get(process.env.MARKET_URL)
            .then(async res => {
                // console.log(res)
                if (res.status === 200) {
                    let temp = res.data;
                    let data = []
                    for (let i = 0; i < temp.length; i++) {
                        const length = temp[i].updateAuth.length;
                        if (length > 10) {
                            if (!temp[i].updateAuth.split('"')[1]) continue;
                            data.push([
                                temp[i].updateAuth.split('"')[1],
                                true,
                                temp[i].name,
                                temp[i].name,
                                temp[i].url,
                                temp[i].img
                            ])
                            if (length > 60) {
                                if (!temp[i].updateAuth.split('"')[3]) continue;
                                data.push([
                                    temp[i].updateAuth.split('"')[1],
                                    true,
                                    temp[i].name,
                                    temp[i].name,
                                    temp[i].url,
                                    temp[i].img
                                ])
                                data.push([
                                    temp[i].updateAuth.split('"')[3],
                                    true,
                                    temp[i].name,
                                    temp[i].name,
                                    temp[i].url,
                                    temp[i].img
                                ])
                            }
                        }
                    }
                    console.log('data----', data);
                    let collectionQuery = format('INSERT INTO collections (id, verified, name, symbol, slug, image) VALUES %L returning id', data);
                    const result = await pool.query(collectionQuery)
                    console.log('result----', result);
                    resolve()
                }
            }).catch(e => {
            console.log(e)
            reject(e)
        })
    }))

};

const getNFTs = () => {
    return new Promise(((resolve, reject) => {
        pool.query('SELECT * FROM collections', async (error, results) => {
            if (error) {
                console.log(error)
                reject(error)
            }
            let ownersList = []
            for (let i = 0; i < results.rows.length; i++) {
                const {data, owners} = await getNFTsByCollection(results.rows[i].id)
                const tokenQuery = format('INSERT INTO tokens (id, verified, name, symbol, slug, image) VALUES %L returning id', data);
                const result = await pool.query(tokenQuery)
                console.log('result----', result);
                ownersList.push(...owners)
            }
            console.log(results.rows);
            resolve(ownersList)
        })
    }))
};

const getOwners = async (owners) => {
    return new Promise((async (resolve, reject) => {
        try {
            let data = []
            for (let i = 0; i < owners.length; i++) {
                const result = await getNFTTokens('BiLSmeewsZXzvXBS34rFYkg6UvxzEh4Q17Yrd6EZMALP');
                const tokens = JSON.stringify(result.map(el => el.mint));
                data.push([owners, tokens])
                console.log('----', result);
            }
            const ownerQuery = format('INSERT INTO wallets (id, tokens) VALUES %L returning id', data);
            const result = await pool.query(ownerQuery)
            console.log('result----', result);
            resolve();
        } catch (e) {
            reject(e)
        }
    }))

}

module.exports = {
    getCollections,
    getNFTs,
    getOwners
}