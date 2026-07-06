import * as anchor from '@coral-xyz/anchor'
import { Program, web3 } from '@coral-xyz/anchor'
import { GetCommitmentSignature } from '@magicblock-labs/ephemeral-rollups-sdk'
import idl from '../target/idl/zorr.json'

const TERRITORY_SEED = 'territory'
const VALIDATOR = new web3.PublicKey('MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57')

const base = new anchor.AnchorProvider(
  new anchor.web3.Connection('https://api.devnet.solana.com', { commitment: 'confirmed' }),
  anchor.Wallet.local(),
)
const er = new anchor.AnchorProvider(
  new anchor.web3.Connection('https://devnet-as.magicblock.app/', {
    wsEndpoint: 'wss://devnet-as.magicblock.app/',
    commitment: 'confirmed',
  }),
  anchor.Wallet.local(),
)
anchor.setProvider(base)

const program = new Program(idl as anchor.Idl, base)
const programER = new Program(idl as anchor.Idl, er)
const [territory] = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from(TERRITORY_SEED)], program.programId)

async function step(label: string, fn: () => Promise<string>) {
  const t = Date.now()
  try {
    const sig = await fn()
    console.log(`✅ ${label} (${Date.now() - t}ms): ${sig}`)
    return sig
  } catch (e: any) {
    console.log(`⚠️  ${label}: ${(e.message || String(e)).slice(0, 160)}`)
    return null
  }
}

async function main() {
  console.log('Program:', program.programId.toString())
  console.log('Territory PDA:', territory.toString())
  console.log('Wallet:', base.wallet.publicKey.toString(), '\n')

  await step('initialize (base)', async () => {
    const tx = await program.methods.initialize().accounts({ user: base.wallet.publicKey }).transaction()
    return base.sendAndConfirm(tx, [], { skipPreflight: true, commitment: 'confirmed' })
  })

  await step('delegate → ER (base)', async () => {
    const tx = await program.methods
      .delegate()
      .accounts({ payer: base.wallet.publicKey, pda: territory })
      .remainingAccounts([{ pubkey: VALIDATOR, isSigner: false, isWritable: false }])
      .transaction()
    return base.sendAndConfirm(tx, [], { skipPreflight: true, commitment: 'confirmed' })
  })
  await new Promise((r) => setTimeout(r, 3000))

  // The headline: a gasless, instant tile capture on the Ephemeral Rollup.
  await step('captureTile ON ER ⚡', () =>
    programER.methods.captureTile(new anchor.BN(42), new anchor.BN(77)).accounts({ territory }).rpc(),
  )
  await step('captureTile ON ER ⚡ (again)', () =>
    programER.methods.captureTile(new anchor.BN(43), new anchor.BN(77)).accounts({ territory }).rpc(),
  )

  const commitSig = await step('commit ER → base', () =>
    programER.methods.commit().accounts({ payer: er.wallet.publicKey }).rpc(),
  )
  if (commitSig) {
    await step('base commitment', async () => GetCommitmentSignature(commitSig, er.connection))
  }

  try {
    const acct: any = await (programER.account as any).territory.fetch(territory)
    console.log(`\n🗺️  Territory on ER → tiles: ${acct.tiles.toString()}, last: ${acct.lastX},${acct.lastY}`)
  } catch (e: any) {
    console.log('read territory:', (e.message || String(e)).slice(0, 120))
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
