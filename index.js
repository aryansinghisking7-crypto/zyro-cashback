const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. EXPRESS KEEP-ALIVE FOR RENDER FREE
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Zyro Bot is running!'));
app.listen(PORT, () => console.log(`✅ Web server on port ${PORT}`));

// 2. DISCORD BOT SETUP
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// 3. MONGODB SCHEMA
const UserSchema = new mongoose.Schema({
  userId: String,
  balance: { type: Number, default: 1000 },
  lastSpin: { type: Date, default: null }
});
const User = mongoose.model('User', UserSchema);

// 4. CONNECT TO MONGO
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.log(err));

// 5. DEFINE SLASH COMMANDS
const commands = [
  new SlashCommandBuilder()
  .setName('spin')
  .setDescription('Spin for coins! Costs 100 coins'),
  new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Check your coin balance')
].map(command => command.toJSON());

// 6. AUTO SYNC GLOBAL COMMANDS ON START
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    console.log('🔄 Syncing global slash commands...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('✅ Successfully synced global slash commands');
  } catch (error) {
    console.error(error);
  }
});

// 7. HANDLE SLASH COMMANDS
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'balance') {
    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) user = await User.create({ userId: interaction.user.id });
    await interaction.reply(`💰 Your balance: **${user.balance}** coins`);
  }

  if (commandName === 'spin') {
    await interaction.deferReply();
    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) user = await User.create({ userId: interaction.user.id });

    // Cooldown 10 seconds
    if (user.lastSpin && (Date.now() - user.lastSpin) < 10000) {
      const wait = Math.ceil((10000 - (Date.now() - user.lastSpin)) / 1000);
      return interaction.editReply(`⏳ Wait ${wait} seconds before spinning again!`);
    }

    const bet = 100;
    if (user.balance < bet) return interaction.editReply('💸 Not enough coins!');

    user.balance -= bet;
    const win = Math.random() < 0.4; // 40% win chance
    const prize = win? bet * 2 : 0;
    user.balance += prize;
    user.lastSpin = new Date();
    await user.save();

    const embed = new EmbedBuilder()
   .setTitle(win? '🎉 YOU WON!' : '😢 YOU LOST')
   .setDescription(`Bet: **${bet}** coins\nPrize: **${prize}** coins\nBalance: **${user.balance}** coins`)
   .setColor(win? 'Green' : 'Red');

    await interaction.editReply({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
