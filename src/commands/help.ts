import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';

export const helpCommand = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show all available commands');

export async function executeHelp(interaction: CommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📖 Kalshi Sentinel — Command Reference')
    .setDescription('All interactions with your Kalshi account happen here in Discord.')
    .addFields(
      {
        name: '🔗 Account',
        value: [
          '`/link` — Connect your Kalshi API key + private key to Discord',
          '`/balance` — View your cash balance and portfolio value',
        ].join('\n'),
      },
      {
        name: '📊 Markets',
        value: [
          '`/markets` — Browse live open Kalshi prediction markets',
          '`/markets status:open|closed|settled|unopened` — Filter by status',
        ].join('\n'),
      },
      {
        name: '💼 Portfolio',
        value: [
          '`/portfolio` — Overview of balance + net contract value',
          '`/positions` — All open positions with size and exposure',
          '`/settlements` — Resolved positions with profit/loss',
          '`/share ticker:<TICKER>` — Post a position publicly in the channel',
        ].join('\n'),
      },
      {
        name: '📈 Trading',
        value: [
          '`/bet ticker:<TICKER> side:<YES|NO> quantity:<n> price:<1-99>` — Place an order',
        ].join('\n'),
      },
      {
        name: '🔔 Alerts & Automation',
        value: [
          '`/alert set ticker:<TICKER> side:<YES|NO> percentage:<n>` — DM when price rises by n%',
          '`/alert list` — View your active alerts',
          '`/alert stop ticker:<TICKER>` — Cancel an alert',
          '`/stoploss set ticker:<TICKER> side:<YES|NO> percentage:<n>` — Auto-sell when price drops by n%',
          '`/stoploss list` — View your active stop-losses',
          '`/stoploss stop ticker:<TICKER>` — Cancel a stop-loss',
        ].join('\n'),
      },
      {
        name: '💡 Tips',
        value: [
          '• Run `/link` first before using any other command',
          '• Tickers look like `KXINFL-26DEC31-T3` — find them via `/markets`',
          '• Price is in cents: `45` = $0.45 per contract',
          '• Stop-loss and alerts monitor prices via real-time WebSocket',
        ].join('\n'),
      }
    )
    .setFooter({ text: 'Connected to Kalshi demo API • switch to live when ready' });

  await interaction.editReply({ embeds: [embed] });
}
