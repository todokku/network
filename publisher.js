const { MessageID, StreamID, MessageReference } = require('./src/identifiers')
const { startNetworkNode } = require('./src/composition')

const host = process.argv[2] || '127.0.0.1'
const port = process.argv[3] || 30302
const trackers = process.argv[4] ? process.argv[4].split(',') : ['ws://127.0.0.1:30300']
const streamId = process.argv[5] || 'default-stream-id'
const intervalInMs = process.argv[6] || 200

const id = `publisher-${port}`

startNetworkNode(host, port, id)
    .then(async (publisher) => {
        await Promise.all(trackers.map((trackerAddress) => publisher.addBootstrapTracker(trackerAddress)))

        let lastTimestamp = null

        setInterval(() => {
            const timestamp = Date.now()
            const msg = 'Hello world, ' + new Date().toLocaleString()

            publisher.publish(streamId, 0, timestamp, 0, publisher.id, lastTimestamp, 0, {
                msg
            })
            lastTimestamp = timestamp
        }, intervalInMs)
    })
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
