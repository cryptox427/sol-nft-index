const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const port = 3000
const {getNFTsByCollection} = require('./services/web3')
const {getCollections, getNFTs, getOwners} = require('./services/crawler')
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

app.listen(port, () => {
    console.log(`App running on port ${port}.`)
})
const crawl = async () => {
    await getCollections();
    // getNFTsByCollection('3AjfxNENxaAmb2kenEWwXdfup1oGgEEaccqyxre6eQAb')
    const owners = await getNFTs()
    await getOwners(owners)
}

crawl();