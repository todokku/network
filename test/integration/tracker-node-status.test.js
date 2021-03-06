const { startNetworkNode, startTracker } = require('../../src/composition')
const { LOCALHOST } = require('../util')
const TrackerServer = require('../../src/protocol/TrackerServer')

/**
 * This test verifies that tracker receives status messages from nodes with list of inBound and outBound connections
 */
describe('check status message flow between tracker and two nodes', () => {
    let tracker
    let nodeOne
    let nodeTwo
    const streamId = 'stream-1'

    beforeAll(async () => {
        tracker = await startTracker(LOCALHOST, 30750, 'tracker')
        nodeOne = await startNetworkNode(LOCALHOST, 30752, 'node-1')
        nodeTwo = await startNetworkNode(LOCALHOST, 30753, 'node-2')
    })

    afterAll(async () => {
        await nodeOne.stop()
        await nodeTwo.stop()
        await tracker.stop()
    })

    it('tracker should receive status message from node', async (done) => {
        tracker.protocols.trackerServer.once(TrackerServer.events.NODE_STATUS_RECEIVED, ({ statusMessage }) => {
            expect(statusMessage.getSource()).toEqual('node-1')
            // eslint-disable-next-line no-underscore-dangle
            expect(statusMessage.getStatus()).toEqual(nodeOne._getStatus())
            done()
        })

        nodeOne.addBootstrapTracker(tracker.getAddress())
    })

    it('tracker should receive status from second node', async (done) => {
        tracker.protocols.trackerServer.once(TrackerServer.events.NODE_STATUS_RECEIVED, ({ statusMessage }) => {
            expect(statusMessage.getSource()).toEqual('node-2')
            // eslint-disable-next-line no-underscore-dangle
            expect(statusMessage.getStatus()).toEqual(nodeTwo._getStatus())
            done()
        })
        nodeTwo.addBootstrapTracker(tracker.getAddress())
    })

    it('tracker should receive from both nodes new statuses', async (done) => {
        let receivedTotal = 0
        tracker.protocols.trackerServer.on(TrackerServer.events.NODE_STATUS_RECEIVED, ({ statusMessage }) => {
            if (statusMessage.getSource() === nodeOne.opts.id) {
                // eslint-disable-next-line no-underscore-dangle
                expect(statusMessage.getStatus()).toEqual(nodeOne._getStatus())
            }

            if (statusMessage.getSource() === nodeTwo.opts.id) {
                // eslint-disable-next-line no-underscore-dangle
                expect(statusMessage.getStatus()).toEqual(nodeTwo._getStatus())
            }

            receivedTotal += 1
            if (receivedTotal === 2) {
                done()
            }
        })

        nodeOne.subscribe(streamId, 0)
        nodeTwo.subscribe(streamId, 0)
    })
})
