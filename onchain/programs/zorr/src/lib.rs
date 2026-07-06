use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

declare_id!("BSDY7ZusGE7372ydW7K8BuE8ZoiYumTBrAR9uymPGL1F");

pub const TERRITORY_SEED: &[u8] = b"territory";

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
