const speedometer = require('speedometer')
const pidusage = require('pidusage')

module.exports = class Metrics {
    constructor(name = '') {
        this.name = name || ''
        this.timestamp = Date.now()
        this._metrics = new Map()
    }

    createSpeedometer(name) {
        this._metrics.set(name, speedometer(1))
    }

    // eslint-disable-next-line class-methods-use-this
    prettify(metrics) {
        return {
            msgSpeed: metrics.msgSpeed,
            msgInSpeed: metrics.msgInSpeed,
            msgOutSpeed: metrics.msgOutSpeed,
            msgSpeedUnit: 'messages/second',
            inSpeed: metrics.inSpeed,
            outSpeed: metrics.outSpeed,
            inOutSpeedUnit: 'bytes/second'
        }
    }

    // eslint-disable-next-line class-methods-use-this
    async getPidusage(pid = process.pid) {
        return pidusage(pid)
    }

    speed(name) {
        return this._metrics.get(name)
    }

    set(name, value) {
        this._metrics.set(name, value)
    }

    inc(name, step = 1) {
        this._put(name, Math.abs(step) || 0)
    }

    decr(name, step = 1) {
        this._put(name, -Math.abs(step) || 0)
    }

    _put(name, step) {
        if (typeof name !== 'string') {
            throw new Error('name is not a string')
        }

        if (!Number.isInteger(step)) {
            throw new Error('step is not an integer')
        }

        this._metrics.set(name, this.get(name) + step)
    }

    get(name) {
        return this._metrics.get(name) || 0
    }

    report() {
        const res = {
            name: this.name,
            timestamp: this.timestamp,
            metrics: Object.assign({}, ...[...this._metrics.entries()].map(([k, v]) => ({
                [k]: v
            }))),
            // eslint-disable-next-line no-underscore-dangle
            openHandles: process._getActiveRequests().length + process._getActiveHandles().length
        }

        return res
    }

    _reset() {
        this.timestamp = Date.now()
        this._metrics.clear()
    }

    reportAndReset() {
        const res = this.report()
        this._reset()

        return res
    }

    mergeAndReport(report, reset = false) {
        const res = [this.report()]
        res.push(report)

        if (reset) {
            this._reset()
        }

        return res
    }
}
