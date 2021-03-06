const intoStream = require('into-stream')
const { MessageLayer, ControlLayer } = require('streamr-client-protocol')
const { waitForStreamToEnd, waitForEvent } = require('streamr-test-utils')

const { startNetworkNode, startStorageNode, startTracker } = require('../../src/composition')
const { LOCALHOST } = require('../util')
const Node = require('../../src/logic/Node')

const { UnicastMessage } = ControlLayer
const { StreamMessage } = MessageLayer

const typesOfStreamItems = async (stream) => {
    const arr = await waitForStreamToEnd(stream)
    return arr.map((msg) => msg.type)
}

/**
 * This test verifies that requesting a resend of stream S from a node that is
 * not subscribed to S (is uninvolved) works as expected. That is, the resend
 * request will be fulfilled via L3 by delegating & proxying through a storage
 * node.
 */
describe('request resend from uninvolved node', () => {
    let tracker
    let uninvolvedNode
    let involvedNode
    let storageNode

    beforeAll(async () => {
        tracker = await startTracker(LOCALHOST, 28640, 'tracker')
        uninvolvedNode = await startNetworkNode(LOCALHOST, 28641, 'uninvolvedNode', [{
            store: () => {},
            requestLast: () => intoStream.object([]),
        }])
        involvedNode = await startNetworkNode(LOCALHOST, 28642, 'involvedNode', [{
            store: () => {},
            requestLast: () => intoStream.object([]),
        }])
        storageNode = await startStorageNode(LOCALHOST, 28643, 'storageNode', [{
            store: () => {},
            requestLast: () => intoStream.object([
                StreamMessage.create(
                    ['streamId', 0, 756, 0, 'publisherId', 'msgChainId'],
                    [666, 50],
                    StreamMessage.CONTENT_TYPES.MESSAGE,
                    StreamMessage.ENCRYPTION_TYPES.NONE,
                    {},
                    StreamMessage.SIGNATURE_TYPES.ETH,
                    'signature'
                ),
                StreamMessage.create(
                    ['streamId', 0, 800, 0, 'publisherId', 'msgChainId'],
                    [756, 0],
                    StreamMessage.CONTENT_TYPES.MESSAGE,
                    StreamMessage.ENCRYPTION_TYPES.NONE,
                    {},
                    StreamMessage.SIGNATURE_TYPES.ETH,
                    'signature'
                ),
            ])
        }])

        involvedNode.subscribe('streamId', 0)
        // storageNode automatically assigned (subscribed) by tracker

        uninvolvedNode.addBootstrapTracker(tracker.getAddress())
        involvedNode.addBootstrapTracker(tracker.getAddress())
        storageNode.addBootstrapTracker(tracker.getAddress())

        await Promise.all([
            waitForEvent(involvedNode, Node.events.NODE_SUBSCRIBED),
            waitForEvent(storageNode, Node.events.NODE_SUBSCRIBED)
        ])
    })

    afterAll(async () => {
        await uninvolvedNode.stop()
        await involvedNode.stop()
        await storageNode.stop()
        await tracker.stop()
    })

    test('requesting resend from uninvolved node is fulfilled using l3', async () => {
        const stream = uninvolvedNode.requestResendLast('streamId', 0, 'requestId', 10)
        const events = await typesOfStreamItems(stream)

        expect(events).toEqual([
            UnicastMessage.TYPE,
            UnicastMessage.TYPE,
        ])
        expect(uninvolvedNode.streams.getStreamsAsKeys()).toEqual([]) // sanity check
    })
})
