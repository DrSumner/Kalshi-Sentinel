import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { kalshiUserManager } from '../kalshi-user-manager.js';
import { makeSignedGetRequest } from '../kalshi-request-signer.js';

dotenv.config();

const KALSHI_BASE_URL = process.env.KALSHI_BASE_URL || 'https://demo-api.kalshi.co';

export const shareCommand = new SlashCommandBuilder()
  .setName('share')
  .setDescription('Share an open position publicly in the chat')
  .addStringOption(option =>
    option
      .setName('ticker')
      .setDescription('Market ticker of the position to share (e.g. KXINFL-26DEC31-T3)')
      .setRequired(true)
  );

export async function executeShare(interaction: CommandInteraction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const ticker = ((interaction.options as any).getString('ticker') || '').toUpperCase().trim();

  try {
    const kalshiUser = await kalshiUserManager.getKalshiUser(userId);

    if (!kalshiUser?.kalshi_api_key || !kalshiUser?.kalshi_private_key) {
      await interaction.editReply({
        content: '❌ No Kalshi account linked. Use `/link` first.',
      });
      return;
    }

    // Fetch all positions and find the matching ticker
    const posData = await makeSignedGetRequest(
      '/trade-api/v2/portfolio/positions?limit=100',
      kalshiUser.kalshi_api_key,
      kalshiUser.kalshi_private_key,
      KALSHI_BASE_URL
    );

    const positions: any[] = posData?.market_positions ?? [];

    // Match by exact ticker OR by prefix (event ticker without outcome suffix)
    const pos = positions.find(
      (p: any) => p.ticker?.toUpperCase() === ticker ||
                  p.ticker?.toUpperCase().startsWith(ticker + '-')
    );

    if (!pos) {
      const available = positions.map((p: any) => `\`${p.ticker}\``).join('\n') || 'none';
      await interaction.editReply({
        content: `❌ No open position found for \`${ticker}\`.\n\n**Your open positions:**\n${available}`,
      });
      return;
    }

    // Use the full ticker from the position object for market lookup
    const fullTicker = pos.ticker;

    let marketTitle = fullTicker;
    let marketStatus = 'Unknown';
    let yesPrice = 'N/A';
    let noPrice = 'N/A';

    try {
      const marketData = await makeSignedGetRequest(
        `/trade-api/v2/markets/${fullTicker}`,
        kalshiUser.kalshi_api_key,
        kalshiUser.kalshi_private_key,
        KALSHI_BASE_URL
      );
      const market = marketData?.market;
      if (market) {
        marketTitle = market.title || fullTicker;
        marketStatus = market.status || 'Unknown';
        const yesBid = market.yes_bid_dollars ?? market.yes_price;
        const noBid = market.no_bid_dollars ?? market.no_price;
        yesPrice = yesBid != null ? `$${parseFloat(yesBid).toFixed(2)}` : 'N/A';
        noPrice = noBid != null ? `$${parseFloat(noBid).toFixed(2)}` : 'N/A';
      }
    } catch {
      // Use defaults if market fetch fails
    }

    const positionSize = parseFloat(pos.position_fp ?? 0);
    const cost = parseFloat(pos.market_exposure_dollars ?? 0);
    // Max profit = full payout ($1 per contract) minus what was paid
    const maxProfit = positionSize * 1.00 - cost;
    const pnlColor = maxProfit >= 0 ? 0x2ecc71 : 0xe74c3c;

    const embed = new EmbedBuilder()
      .setColor(pnlColor)
      .setTitle(`📣 ${username}'s Trade`)
      .setDescription(`**${marketTitle}**\n\`${fullTicker}\``)
      .addFields(
        { name: '📦 Position Size', value: `\`${positionSize.toFixed(0)}\` contracts`, inline: true },
        { name: '💸 Cost', value: `\`$${cost.toFixed(2)}\``, inline: true },
        { name: '✅ YES Price', value: yesPrice, inline: true },
        { name: '🏆 Max Profit', value: `\`$${maxProfit.toFixed(2)}\``, inline: true },
        { name: '📋 Status', value: `\`${marketStatus}\``, inline: true },
      )
      .setFooter({ text: 'Kalshi Sentinel • Live market data' })
      .setTimestamp();

    // Public reply — visible to everyone in the channel
    await interaction.editReply({ embeds: [embed] });
    console.log(`📣 ${username} shared position: ${fullTicker}`);

  } catch (error) {
    console.error('Error in /share command:', error);
    await interaction.editReply({
      content: '❌ Failed to fetch position. Please try again.',
    });
  }
}
