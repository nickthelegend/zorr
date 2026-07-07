// Integration test: MagicBlock VRF on Solana devnet (base-layer queue).
// Requests verifiable randomness into a scoped seed PDA, waits for the oracle
// to fire the on-chain callback, then reads the PDA and asserts a real 32-byte
// random seed landed. This is the same request→callback path the app uses for
// provably-fair Guardian summons and trustless battle seeds.
import * as anchor from '@coral-xyz/anchor'
import { Program, web3 } from '@coral-xyz/anchor'
import idl from '../target/idl/zorr.json'

// Devnet base-layer VRF oracle queue (ephemeral_rollups_sdk::vrf::consts::DEFAULT_QUEUE).
const DEFAULT_QUEUE = new web3.PublicKey('Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh')

const base = new anchor.AnchorProvider(
  new anchor.web3.Connection('https://api.devnet.solana.com', { commitment: 'confirmed' }),
  anchor.Wallet.local(),
)
anchor.setProvider(base)
const program = new Program(idl as anchor.Idl, base)

function randBytes(n: number): number[] {
  const a: number[] = []
  for (let i = 0; i < n; i++) a.push(Math.floor(Math.random() * 256))
  return a
}

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  console.log(`  ${cond ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`)
  if (!cond) failures++
}

async function main() {
  console.log('Zorr VRF integration (Solana devnet · base-layer oracle)\n')
  console.log('Program:', program.programId.toString())
  console.log('Wallet: ', base.wallet.publicKey.toString(), '\n')

  const scope = randBytes(16)
  const [vrfSeedPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from('vrfseed'), Buffer.from(scope)],
    program.programId,
  )
  const clientSeed = Math.floor(Math.random() * 256)
  const tag = `client_seed=${clientSeed}`
  console.log('VrfSeed PDA:', vrfSeedPda.toString(), '| clientSeed:', clientSeed)

  // Pre-arm a one-shot promise resolved when the oracle's callback lands.
  let resolveSig!: (sig: string) => void
  const sigPromise = new Promise<string>((r) => (resolveSig = r))
  const subId = base.connection.onLogs(
    program.programId,
    (info) => {
      if (!info.err && info.logs.some((l) => l.includes('CallbackSeed fulfilled')) && info.logs.some((l) => l.includes(tag))) {
        resolveSig(info.signature)
      }
    },
    'confirmed',
  )

  try {
    const tx = await (program.methods as any)
      .requestSeed(scope, clientSeed)
      .accountsPartial({ payer: base.wallet.publicKey, oracleQueue: DEFAULT_QUEUE })
      .rpc({ skipPreflight: true, commitment: 'confirmed' })
    check('request_seed submitted', !!tx, String(tx).slice(0, 16) + '…')

    const start = Date.now()
    const sig = await Promise.race<string | null>([
      sigPromise,
      new Promise<null>((r) => setTimeout(() => r(null), 45_000)),
    ])
    check('VRF oracle fulfilled the callback', !!sig, sig ? `${Date.now() - start}ms` : 'not observed within 45s')

    if (sig) {
      const acct: any = await (program.account as any).vrfSeed.fetch(vrfSeedPda, 'confirmed')
      const seedBytes: number[] = Array.from(acct.seed as number[])
      check('VrfSeed.fulfilled == true', acct.fulfilled === true)
      check('seed is 32 bytes', seedBytes.length === 32)
      check('seed is non-zero (real randomness)', seedBytes.some((b) => b !== 0))
      check('counter incremented', Number(acct.counter) >= 1, `counter=${acct.counter}`)
      console.log('  seed(hex):', Buffer.from(seedBytes).toString('hex').slice(0, 40) + '…')
    }
  } finally {
    await base.connection.removeOnLogsListener(subId)
  }

  console.log(failures === 0 ? '\n🎉 ALL VRF CHECKS PASSED\n' : `\n❌ ${failures} CHECK(S) FAILED\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
