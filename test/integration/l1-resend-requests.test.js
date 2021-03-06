const intoStream = require('into-stream')
const { MessageLayer, ControlLayer } = require('streamr-client-protocol')
const { waitForStreamToEnd } = require('streamr-test-utils')

const { startNetworkNode, startTracker } = require('../../src/composition')
const { LOCALHOST } = require('../util')

const { UnicastMessage } = ControlLayer
const { StreamMessage } = MessageLayer

const typesOfStreamItems = async (stream) => {
    const arr = await waitForStreamToEnd(stream)
    return arr.map((msg) => msg.type)
}

/**
 * This test verifies that a node can fulfill resend requests at L1. This means
 * that the node
 *      a) understands and handles resend requests,
 *      b) can respond with resend responses, and finally,
 *      c) uses its local storage to find messages.
 */
describe('resend requests are fulfilled at L1', () => {
    let tracker
    let contactNode

    beforeAll(async () => {
        tracker = await startTracker(LOCALHOST, 28600, 'tracker')
        contactNode = await startNetworkNode(LOCALHOST, 28601, 'contactNode', [{
            store: () => {},
            requestLast: () => intoStream.object([
                StreamMessage.create(
                    ['streamId', 0, 666, 50, 'publisherId', 'msgChainId'],
                    null,
                    StreamMessage.CONTENT_TYPES.MESSAGE,
                    StreamMessage.ENCRYPTION_TYPES.NONE,
                    {},
                    StreamMessage.SIGNATURE_TYPES.ETH,
                    'signature'
                ),
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
                )
            ]),
            requestFrom: () => intoStream.object([
                StreamMessage.create(
                    ['streamId', 0, 666, 50, 'publisherId', 'msgChainId'],
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
        contactNode.addBootstrapTracker(tracker.getAddress())
        contactNode.subscribe('streamId', 0)
    })

    afterAll(async () => {
        await contactNode.stop()
        await tracker.stop()
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
