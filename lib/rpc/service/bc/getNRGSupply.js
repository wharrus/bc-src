'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = getNrgSupply;

const { GetNrgSupplyResponse } = require('../../../protos/bc_pb'); /**
                                                                    * Copyright (c) 2017-present, BlockCollider developers, All rights reserved.
                                                                    *
                                                                    * This source code is licensed under the MIT license found in the
                                                                    * LICENSE file in the root directory of this source tree.
                                                                    *
                                                                    * 
                                                                    */

function getNrgSupply(context, call, callback) {
  context.server.engine.persistence.get(`bc.block.latest`).then(block => {
    let nrg = 28787582 + (block.getHeight() - 1) * 2;
    let response = new GetNrgSupplyResponse([nrg.toString()]);
    callback(null, response);
  }).catch(err => {
    context.logger.error(`Could not get nrg suppy, reason: ${err}'`);
    callback(err);
  });
}