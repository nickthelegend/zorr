// polyfill.js
import 'fast-text-encoding'
import { Buffer } from 'buffer'
import { install } from 'react-native-quick-crypto'

install()

// @solana/web3.js (used for MagicBlock Private Payments tx signing) needs a
// global Buffer; @solana/kit works on Uint8Array so the app didn't have one.
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer
}
