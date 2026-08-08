/**
 * /markets command
 * View available Kalshi prediction markets
 */

import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { kalshiAPIClient } from '../kalshi-api-client.js';

export const marketsCommand = new SlashCommandBuilder()
  .setName('markets')
  .setDescription('View available Kalshi prediction markets')
  .addStringOption(option =>
    option
      .setName('status')
      .setDescription('Filter by market status (default: open)')
      .setRequired(false)
      .addChoices(
        { name: '🟢 Open', value: 'open' },
        { name: '🔴 Closed', value: 'closed' },
        { name: '✅ Settled', value: 'settled' },
        { name: '⏳ Unopened', value: 'unopened' },
      )
  );

export async function executeMarkets(interaction: CommandInteraction) {
  try {
    const status = (interaction.options.get('status')?.value as string) ?? 'open';

    console.log(`📊 Fetching Kalshi markets (status: ${status})...`);

    const markets = await kalshiAPIClient.getMarkets({ status });

    if (!markets || markets.length === 0) {
      await interaction.editReply({
        content: '📭 No markets found for that status.',
      });
      return;
    }

    // Create embed with markets
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('📊 Kalshi Prediction Markets')
      .setDescription(`Showing ${Math.min(markets.length, 10)} ${status} markets`)
      .setFooter({ text: 'Use /bet <ticker> to place a bet' });

    // Add fields for first 10 markets
    markets.slice(0, 10).forEach((market, index) => {
      const yesPrice = market.yes_price ? `${(market.yes_price * 100).toFixed(1)}¢` : 'N/A';
      const noPrice = market.no_price ? `${(market.no_price * 100).toFixed(1)}¢` : 'N/A';
      const title = `${index + 1}. ${market.title}`.slice(0, 256);
      const value = `Ticker: \`${market.event_ticker}\`\nYES: ${yesPrice} | NO: ${noPrice}`.slice(0, 1024);

      embed.addFields({ name: title, value, inline: false });
    });

    await interaction.editReply({
      embeds: [embed],
    });

    console.log(`✅ Displayed ${Math.min(markets.length, 10)} markets to ${interaction.user.username}`);
  } catch (error) {
    console.error('Error in /markets command:', error);
    await interaction.editReply({
      content: '❌ Failed to fetch markets. Please try again later.',
    });
  }
}
