const intoStream = require('into-stream')
const { MessageLayer, ControlLayer } = require('streamr-client-protocol')
const { waitForEvent, waitForStreamToEnd } = require('streamr-test-utils')

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
 * This test verifies that a node can fulfill resend requests at L3. A resend
 * request will be sent to contactNode. Being unable to fulfill the request,
 * it will forward it to its neighbors of which none will be able to fulfill
 * it either. Then L3 will kick in: contactNode will ask the tracker for
 * storage nodes, connect to one of them, and forward the request to the
 * connected storage node. Meanwhile contactNode will act as a proxy in
 * between the requesting client and the storage node.
 */
describe('resend requests are fulfilled at L3', () => {
    let tracker
    let contactNode
    let neighborOne
    let neighborTwo
    let storageNode

    beforeAll(async () => {
        tracker = await startTracker(LOCALHOST, 28630, 'tracker')
        contactNode = await startNetworkNode(LOCALHOST, 28631, 'contactNode', [{
            store: () => {},
            requestLast: () => intoStream.object([]),
            requestFrom: () => intoStream.object([]),
            requestRange: () => intoStream.object([]),
        }])
        neighborOne = await startNetworkNode(LOCALHOST, 28632, 'neighborOne', [{
            store: () => {},
            requestLast: () => intoStream.object([]),
            requestFrom: () => intoStream.object([]),
            requestRange: () => intoStream.object([]),
        }])
        neighborTwo = await startNetworkNode(LOCALHOST, 28633, 'neighborTwo', [])
        storageNode = await startStorageNode(LOCALHOST, 28634, 'storageNode', [{
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
                StreamMessage.create(
                    ['streamId', 0, 950, 0, 'publisherId', 'msgChainId'],
                    [800, 0],
                    StreamMessage.CONTENT_TYPES.MESSAGE,
                    StreamMessage.ENCRYPTION_TYPES.NONE,
                    {},
                    StreamMessage.SIGNATURE_TYPES.ETH,
                    'signature'
                ),
            ]),
            requestFrom: () => intoStream.object([
                StreamMessage.create(
                    ['streamId', 0, 666, 0, 'publisherId', 'msgChainId'],
                    null,
                    StreamMessage.CONTENT_TYPES.MESSAGE,
                    StreamMessage.ENCRYPTION_TYPES.NONE,
                    {},
                    StreamMessage.SIGNATURE_TYPES.ETH,
                    'signature'
                ),
            ]),
            requestRange: () => intoStream.object([]),
        }])

        contactNode.subscribe('streamId', 0)
        neighborOne.subscribe('streamId', 0)
        neighborTwo.subscribe('streamId', 0)
        // storageNode automatically assigned (subscribed) by tracker

        contactNode.addBootstrapTracker(tracker.getAddress())
        neighborOne.addBootstrapTracker(tracker.getAddress())
        neighborTwo.addBootstrapTracker(tracker.getAddress())
        storageNode.addBootstrapTracker(tracker.getAddress())

        await Promise.all([
            waitForEvent(contactNode, Node.events.NODE_SUBSCRIBED),
            waitForEvent(neighborOne, Node.events.NODE_SUBSCRIBED),
            waitForEvent(neighborTwo, Node.events.NODE_SUBSCRIBED),
            waitForEvent(storageNode, Node.events.NODE_SUBSCRIBED)
        ])
    })

    afterAll(async () => {
        await tracker.stop()
        await contactNode.stop()
        await neighborOne.stop()
        await neighborTwo.stop()
        await storageNode.stop()
    })

    beforeEach(() => {
        // Prevent storageNode from being a neighbor of contactNode. Otherwise
        // L2 will be used to fulfill resend request, which will mean that L3
        // is skipped and we are just testing L2 again. TODO: find a better way
        // eslint-disable-next-line no-underscore-dangle
        storageNode._disconnectFromAllNodes()
    })

    test('requestResendLast', async () => {
        const stream = contactNode.requestResendLast('streamId', 0, 'requestId', 10)
        const events = await typesOfStreamItems(stream)
        expect(events).toEqual([
            UnicastMessage.TYPE,
            UnicastMessage.TYPE,
            UnicastMessage.TYPE,
        ])
    })

    test('requestResendFrom', async () => {
        const stream = contactNode.requestResendFrom(
            'streamId',
            0,
            'requestId',
            666,
            0,
            'publisherId',
            'msgChainId'
        )
        const events = await typesOfStreamItems(stream)
        expect(events).toEqual([
            UnicastMessage.TYPE,
        ])
    })

    test('requestResendRange', async () => {
        const stream = contactNode.requestResendRange(
            'streamId',
            0,
            'requestId',
            666,
            0,
            999,
            0,
            'publisherId',
            'msgChainId'
        )
        const events = await typesOfStreamItems(stream)
        expect(events).toEqual([])
    })
})
