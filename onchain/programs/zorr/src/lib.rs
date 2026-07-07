use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral, vrf, vrf_callback};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;
use ephemeral_rollups_sdk::vrf::{
    self,
    instructions::{create_request_scoped_randomness_ix, RequestRandomnessParams},
    types::SerializableAccountMeta,
};

declare_id!("BSDY7ZusGE7372ydW7K8BuE8ZoiYumTBrAR9uymPGL1F");

pub const TERRITORY_SEED: &[u8] = b"territory";
pub const VRF_SEED: &[u8] = b"vrfseed";

#[ephemeral]
#[program]
pub mod zorr {
    use super::*;

    /// Create the player's territory account.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let t = &mut ctx.accounts.territory;
        t.tiles = 0;
        t.last_x = 0;
        t.last_y = 0;
        Ok(())
    }

    /// Capture one tile (fast path — meant to run on the Ephemeral Rollup).
    pub fn capture_tile(ctx: Context<CaptureTile>, tile_x: i64, tile_y: i64) -> Result<()> {
        let t = &mut ctx.accounts.territory;
        t.tiles = t.tiles.saturating_add(1);
        t.last_x = tile_x;
        t.last_y = tile_y;
        msg!("captured tile {},{} — total {}", tile_x, tile_y, t.tiles);
        Ok(())
    }

    /// Delegate the territory account to the delegation program (moves it to the ER).
    pub fn delegate(ctx: Context<DelegateInput>) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[TERRITORY_SEED],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Commit the ER territory state back to the base layer.
    pub fn commit(ctx: Context<CommitTerritory>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.territory.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// Capture a tile on the ER, then commit to the base layer.
    pub fn capture_and_commit(ctx: Context<CommitTerritory>, tile_x: i64, tile_y: i64) -> Result<()> {
        let t = &mut ctx.accounts.territory;
        t.tiles = t.tiles.saturating_add(1);
        t.last_x = tile_x;
        t.last_y = tile_y;
        t.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.territory.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// Undelegate the territory account from the delegation program.
    pub fn undelegate(ctx: Context<CommitTerritory>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.territory.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// Request MagicBlock VRF (verifiable randomness) into a scoped seed PDA.
    /// The 32-byte result seeds provably-fair Guardian summons and trustless
    /// battle RNG — the app derives the creature/match seed from it.
    pub fn request_seed(ctx: Context<RequestSeed>, scope: [u8; 16], client_seed: u8) -> Result<()> {
        msg!("vrf request scope={:?} client_seed={}", &scope[..4], client_seed);
        let s = &mut ctx.accounts.vrf_seed;
        s.fulfilled = false;
        let ix = create_request_scoped_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: ID,
            callback_discriminator: instruction::CallbackSeed::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![SerializableAccountMeta {
                pubkey: ctx.accounts.vrf_seed.key(),
                is_signer: false,
                is_writable: true,
            }]),
            callback_args: Some(vec![client_seed]),
            ..Default::default()
        });
        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    /// VRF oracle callback — writes the verifiable randomness into the seed PDA.
    /// Only the VRF program identity can invoke this (enforced by `#[vrf_callback]`).
    pub fn callback_seed(ctx: Context<CallbackSeed>, randomness: [u8; 32], client_seed: u8) -> Result<()> {
        let s = &mut ctx.accounts.vrf_seed;
        s.seed = randomness;
        s.counter = s.counter.saturating_add(1);
        s.fulfilled = true;
        msg!("CallbackSeed fulfilled client_seed={}", client_seed);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init_if_needed, payer = user, space = 8 + 8 + 8 + 8, seeds = [TERRITORY_SEED], bump)]
    pub territory: Account<'info, Territory>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Delegate context — `#[delegate]` adds the delegation program accounts.
#[delegate]
#[derive(Accounts)]
pub struct DelegateInput<'info> {
    pub payer: Signer<'info>,
    /// CHECK: the pda to delegate
    #[account(mut, del)]
    pub pda: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CaptureTile<'info> {
    #[account(mut, seeds = [TERRITORY_SEED], bump)]
    pub territory: Account<'info, Territory>,
}

/// Commit context — `#[commit]` adds the magic context/program accounts.
#[commit]
#[derive(Accounts)]
pub struct CommitTerritory<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [TERRITORY_SEED], bump)]
    pub territory: Account<'info, Territory>,
}

#[account]
pub struct Territory {
    pub tiles: u64,
    pub last_x: i64,
    pub last_y: i64,
}

/// VRF request context — `#[vrf]` injects the oracle program + identity accounts
/// and the `invoke_signed_vrf` helper. Base-layer (devnet) queue, no delegation.
#[vrf]
#[derive(Accounts)]
#[instruction(scope: [u8; 16])]
pub struct RequestSeed<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + 32 + 8 + 1,
        seeds = [VRF_SEED, scope.as_ref()],
        bump
    )]
    pub vrf_seed: Account<'info, VrfSeed>,
    /// CHECK: validated against the known VRF oracle queue (devnet or local test).
    #[account(
        mut,
        constraint = oracle_queue.key() == vrf::consts::DEFAULT_QUEUE
            || oracle_queue.key() == vrf::consts::DEFAULT_TEST_QUEUE
    )]
    pub oracle_queue: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

/// VRF callback context — `#[vrf_callback]` requires the VRF program identity
/// as signer, so only the oracle can fulfill.
#[vrf_callback]
#[derive(Accounts)]
pub struct CallbackSeed<'info> {
    #[account(mut)]
    pub vrf_seed: Account<'info, VrfSeed>,
}

#[account]
pub struct VrfSeed {
    /// 32 bytes of verifiable randomness from the MagicBlock VRF oracle.
    pub seed: [u8; 32],
    /// Increments each fulfillment (lets clients detect a fresh result).
    pub counter: u64,
    /// True once the oracle has written a result for the latest request.
    pub fulfilled: bool,
}
