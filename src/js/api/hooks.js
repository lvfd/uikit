import { assign, fastdom, hasOwn, isEqual, isPlainObject } from 'uikit-util';

export default function (UIkit) {
    UIkit.prototype._callHook = function (hook) {
        this.$options[hook]?.forEach((handler) => handler.call(this));
    };

    UIkit.prototype._callConnected = function () {
        if (this._connected) {
            return;
        }

        this._data = {};
        this._computed = {};

        this._initProps();

        this._callHook('beforeConnect');
        this._connected = true;

        this._initEvents();
        this._initObservers();

        this._callHook('connected');
        this._callUpdate();
    };

    UIkit.prototype._callDisconnected = function () {
        if (!this._connected) {
            return;
        }

        this._callHook('beforeDisconnect');
        this._disconnectObservers();
        this._unbindEvents();
        this._callHook('disconnected');

        this._connected = false;
        delete this._watch;
    };

    UIkit.prototype._callUpdate = function (e = 'update') {
        if (!this._connected) {
            return;
        }

        if (e === 'update' || e === 'resize') {
            this._callWatches();
        }

        if (!this.$options.update) {
            return;
        }

        if (!this._updates) {
            this._updates = new Set();
            fastdom.read(() => {
                if (this._connected) {
                    runUpdates.call(this, this._updates);
                }
                delete this._updates;
            });
        }

        this._updates.add(e.type || e);
    };

    UIkit.prototype._callWatches = function () {
        if (this._watch) {
            return;
        }

        const initial = !hasOwn(this, '_watch');

        this._watch = fastdom.read(() => {
            if (this._connected) {
                runWatches.call(this, initial);
            }
            this._watch = null;
        });
    };

    function runUpdates(types) {
        for (const { read, write, events = [] } of this.$options.update) {
            if (!types.has('update') && !events.some((type) => types.has(type))) {
                continue;
            }

            let result;
            if (read) {
                result = read.call(this, this._data, types);

                if (result && isPlainObject(result)) {
                    assign(this._data, result);
                }
            }

            if (write && result !== false) {
                fastdom.write(() => {
                    if (this._connected) {
                        write.call(this, this._data, types);
                    }
                });
            }
        }
    }

    function runWatches(initial) {
        const values = { ...this._computed };
        this._computed = {};

        for (const [key, { watch, immediate }] of Object.entries(this.$options.computed || {})) {
            if (
                watch &&
                ((initial && immediate) ||
                    (hasOwn(values, key) && !isEqual(values[key], this[key])))
            ) {
                watch.call(this, this[key], initial ? undefined : values[key]);
            }
        }
    }
}
