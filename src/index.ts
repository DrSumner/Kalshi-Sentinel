import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  SlashCommandBuilder,
  CommandInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import * as dotenv from "dotenv";
import { databaseManager } from "./database-manager.js";
import { kalshiUserManager } from "./kalshi-user-manager.js";
import { alertManager } from "./alert-manager.js";
import { stopLossManager } from "./stoploss-manager.js";

// Import commands
import {
  marketsCommand,
  executeMarkets,
  linkCommand,
  executeLink,
  handleLinkModal,
  betCommand,
  executeBet,
  portfolioCommand,
  executePortfolio,
  balanceCommand,
  executeBalance,
  settlementsCommand,
  executeSettlements,
  positionsCommand,
  executePositions,
  alertCommand,
  executeAlert,
  stoplossCommand,
  executeStopLoss,
  helpCommand,
  executeHelp,
  shareCommand,
  executeShare,
} from './commands/index.js';

declare var process: any;

dotenv.config();

const CLIENT_TOKEN = process.env.CLIENT_TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID;
const MONGODB_URI = process.env.MONGODB_URI;

if (!CLIENT_TOKEN) {
  throw new Error("No CLIENT_TOKEN provided.");
}

if (!APPLICATION_ID) {
  throw new Error("No APPLICATION_ID provided.");
}

if (!MONGODB_URI) {
  throw new Error("No MONGODB_URI provided.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

let botReady = false;

client.once(Events.ClientReady, async (discord) => {
  try {
    console.log(`🤖 Kalshi Discord Bot Ready! Logged in as ${discord.user.tag}`);
    console.log(`📊 Prediction betting bot for Kalshi`);

    alertManager.setDiscordClient(client);
    stopLossManager.setDiscordClient(client);

    await databaseManager.connect();
    await kalshiUserManager.connect(MONGODB_URI);

    console.log('✅ Database connected');
    console.log('✅ Kalshi API client ready');
    console.log('✅ Alert manager initialized');

    const rest = new REST().setToken(CLIENT_TOKEN);
    const commands = [
      marketsCommand, linkCommand, betCommand, portfolioCommand,
      balanceCommand, settlementsCommand, positionsCommand, alertCommand, stoplossCommand,
      helpCommand, shareCommand,
    ];
    await rest.put(Routes.applicationCommands(APPLICATION_ID), {
      body: commands.map(cmd => cmd.toJSON()),
    });
    console.log('✅ Registered commands: /markets, /link, /bet, /portfolio, /balance, /settlements, /positions, /alert, /stoploss');

    botReady = true;
    console.log('✅ Kalshi bot initialized — ready for trading!');

    client.on(Events.GuildCreate, async (guild) => {
      console.log(`🚀 Kalshi bot added to server: ${guild.name} (${guild.id})`);
    });

  } catch (error) {
    console.error('❌ Error starting bot:', error);
    process.exit(1);
  }
});

// Registered before login so no interaction events are ever missed
client.on(Events.InteractionCreate, (interaction) => {
  const age = Date.now() - interaction.createdTimestamp;
  const name = (interaction as any).commandName ?? (interaction as any).customId ?? 'unknown';
  console.log(`⚡ Interaction received: ${name} (age: ${age}ms)`);

  if (age > 2000) {
    console.log(`⏭️ Dropped stale interaction: ${name} (${age}ms old)`);
    return;
  }

  handleInteraction(interaction).catch(err =>
    console.error('Unhandled interaction error:', err)
  );
});

async function handleInteraction(interaction: any) {
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'kalshi_link_modal') {
      await handleLinkModal(interaction);
    }
    return;
  }

  if (!interaction.isCommand()) return;

  if (!botReady) {
    await (interaction as ChatInputCommandInteraction).reply({
      content: '⏳ Bot is still starting up, please try again in a moment.',
      ephemeral: true,
    });
    return;
  }

  const cmd = interaction as ChatInputCommandInteraction;
  const publicCommands = new Set(['markets', 'help', 'share']);

  // /link responds with a modal — cannot deferReply first
  if (cmd.commandName !== 'link') {
    try {
      await cmd.deferReply({ ephemeral: !publicCommands.has(cmd.commandName) });
      console.log(`✅ Deferred /${cmd.commandName}`);
    } catch (err: any) {
      console.error(`❌ deferReply failed for /${cmd.commandName}:`, err?.rawError ?? err?.message);
      return;
    }
  }

  try {
    switch (cmd.commandName) {
      case 'markets':    await executeMarkets(cmd);    break;
      case 'link':       await executeLink(cmd);       break;
      case 'bet':        await executeBet(cmd);        break;
      case 'portfolio':  await executePortfolio(cmd);  break;
      case 'balance':    await executeBalance(cmd);    break;
      case 'settlements':await executeSettlements(cmd);break;
      case 'positions':  await executePositions(cmd);  break;
      case 'alert':      await executeAlert(cmd);      break;
      case 'stoploss':   await executeStopLoss(cmd);   break;
      case 'help':        await executeHelp(cmd);        break;
      case 'share':       await executeShare(cmd);       break;
      default:
        await cmd.reply({ content: '❌ Unknown command.', ephemeral: true });
    }
  } catch (error) {
    console.error(`Error executing /${cmd.commandName}:`, error);
  }
}

client.on('error', (error: any) => {
  console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', (error: any) => {
  console.error('❌ Unhandled promise rejection:', error);
});

console.log('🤖 Starting Kalshi Discord Bot');
console.log('📊 Platform: Kalshi Prediction Markets');
console.log('🎯 Features: Browse markets, link accounts, place bets, track portfolio');
client.login(CLIENT_TOKEN);
