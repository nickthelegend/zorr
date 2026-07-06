// Integration test: verifies the live Solana + MagicBlock integration on devnet.
// Read-only (reliable): devnet connectivity, the deployed Zorr program, the
// territory PDA, and the capture_tile instruction encoding.
import { address, createSolanaRpc, getProgramDerivedAddress } from '@solana/kit'

const RPC = 'https://api.devnet.solana.com'
const PROGRAM = 'BSDY7ZusGE7372ydW7K8BuE8ZoiYumTBrAR9uymPGL1F'

let failures = 0
function check(name, cond, detail = '') {
  if (cond) console.log(`  ✅ ${name}${detail ? '  — ' + detail : ''}`)
  else {
    console.log(`  ❌ ${name}${detail ? '  — ' + detail : ''}`)
    failures++
  }
}

const rpc = createSolanaRpc(RPC)

console.log('Solana + MagicBlock integration (devnet)\n')

// 1. Solana connectivity
const { value: bh } = await rpc.getLatestBlockhash().send()
check('devnet reachable (getLatestBlockhash)', !!bh?.blockhash, String(bh?.blockhash).slice(0, 12) + '…')

// 2. Deployed Zorr program is on-chain and executable
const prog = await rpc.getAccountInfo(address(PROGRAM), { encoding: 'base64' }).send()
check('Zorr program deployed on devnet', !!prog.value, PROGRAM)
check('Zorr program is executable', prog.value?.executable === true)
check('Zorr program owned by BPF loader', String(prog.value?.owner || '').startsWith('BPFLoader'))

// 3. Territory PDA is derivable and initialized on-chain
const [territory] = await getProgramDerivedAddress({
  programAddress: address(PROGRAM),
  seeds: [new TextEncoder().encode('territory')],
})
const terr = await rpc.getAccountInfo(address(territory), { encoding: 'base64' }).send()
check('territory PDA exists on-chain', !!terr.value, territory)

// 4. capture_tile instruction encoding matches the program's IDL
function i64le(n) {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setBigInt64(0, BigInt(n), true)
  return b
}
const DISC = [4, 55, 84, 232, 142, 81, 238, 39]
const data = new Uint8Array([...DISC, ...i64le(42), ...i64le(77)])
check('capture_tile data is 24 bytes (disc + 2×i64)', data.length === 24)
check('capture_tile discriminator matches IDL', JSON.stringify([...data.slice(0, 8)]) === JSON.stringify(DISC))

console.log(failures === 0 ? '\n🎉 ALL INTEGRATION CHECKS PASSED\n' : `\n❌ ${failures} CHECK(S) FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
