'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});


const debug = require('debug')('bcnode:rpc:server:rover'); /**
                                                            * Copyright (c) 2017-present, BlockCollider developers, All rights reserved.
                                                            *
                                                            * This source code is licensed under the MIT license found in the
                                                            * LICENSE file in the root directory of this source tree.
                                                            *
                                                            * 
                                                            */

const BC_MINER_MUTEX = process.env.BC_MINER_MUTEX === 'true';
const BC_SUPER_COLLIDER = process.env.BC_SUPER_COLLIDER ? process.env.BC_SUPER_COLLIDER.toLowerCase() : 'bc';

const RpcServer = require('../server').default;
const UnsettledTxManagerAlt = require('../../bc/unsettledTxManagerAlt');
const QueueEventEmitter = require('queue-event-emitter');

const { collectBlock } = require('./rover/index');
const { SettleTxCheckResponse } = require('../../protos/rover_pb');
const { Null, Block } = require('../../protos/core_pb');
const { getLogger } = require('../../logger');

const logger = getLogger(__filename);

class CollectorServiceImpl {

  constructor(server, emitter, roverEmitter) {
    this._server = server;
    this._emitter = emitter;
    this._roverEmitter = roverEmitter;
    let persistence = server.engine.persistence;
    this._persistence = persistence;
    this._unsettledTxManagerAlt = new UnsettledTxManagerAlt(persistence, server.engine.minerKey);
  } // eslint-disable-line no-undef


  get server() {
    return this._server;
  }

  /**
   * Implements the collectBlock RPC method.
   */
  collectBlock(call, callback) {
    debug(`collectBlock() call: %o`, call);
    call.on('data', message => {
      debug(`STREAM Got block %o`, message.toObject());
      //  collectBlock(this._getContext(), message)
      //if (!BC_MINER_MUTEX) {
      if (true) {
        collectBlock(this._getContext(), message);
        return;
      } else {
        this._persistence.get(`${BC_SUPER_COLLIDER}.miner.mutex`).then(mutex => {
          if (!mutex) {} else if (mutex === 'open') {
            collectBlock(this._getContext(), message);
          } else {
            this._persistence.putBlock(message, 0).then(() => {
              collectBlock(this._getContext(), message);
              return;
            });
          }
        });
      }
    });

    call.on('error', function (err) {
      logger.error(`STREAM error while collecting block %o`, err.stack);
    });

    call.on('status', function (status) {
      debug(`STREAM STATUS %o`, status);
    });
  }

  isBeforeSettleHeight(call, callback) {
    const req = call.request;
    const possibleTransactions = req.getPossibleTransactionsList();
    logger.debug(`isBeforeSettleHeight-grpc possibleTransactions.length: ${possibleTransactions.length}`);
    const grpcResult = new SettleTxCheckResponse();
    let blockHash = req.getBlockHash();
    let result = this._unsettledTxManagerAlt.onNewRoveredBlock(possibleTransactions, blockHash).then(result => {
      grpcResult.setMarkedTransactionsList(result);
      callback(null, grpcResult);
    }).catch(err => {
      logger.debug(`error: ${err}`);
    });
  }

  join(call, callback) {
    this.server.engine.rovers.roverRpcJoined(call);
  }

  reportSyncStatus(call, callback) {
    this.server.engine.rovers.setRoverSyncStatus(call, function () {
      callback(null, new Null());
    });
  }

  reportBlockRange(call, callback) {
    this.server.engine.rovers.setRoverBlockRange(call, function () {
      callback(null, new Null());
    });
  }

  _getContext() {
    return {
      server: this._server,
      emitter: this._emitter,
      roverEmitter: this._roverEmitter
    };
  }
}
exports.default = CollectorServiceImpl;