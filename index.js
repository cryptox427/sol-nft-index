const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const port = 5000
const {test, getSale, getNFTsByCollection} = require('./services/web3')
const {getCollections, getNFTs, getWallets, getTokenTransfers, getTransactions, getSales} = require('./services/crawler')
require('dotenv').config()

app.use(bodyParser.json())
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
)

app.get('/', (request, response) => {
    response.json({info: 'Node.js, Express, and Postgres API'})
})

// app.listen(port, () => {
//     console.log(`App running on port ${port}.`)
// })
const crawl = async () => {
    await getCollections();
    await getNFTs();
    getWallets();
    getTokenTransfers();
    getTransactions();
    getSales()
    // console.log('Done....');
}

crawl();
// getNFTsByCollection('3AjfxNENxaAmb2kenEWwXdfup1oGgEEaccqyxre6eQAb')