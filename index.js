const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== DATABASE =====
mongoose.connect(process.env.MONGO_URI);
const userSchema = new mongoose.Schema({
  userId: String,
  balance: { type: Number, default: 0 },
  spins: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder().setName('spin').setDescription('Use 1 spin slot to spin for cashback'),
  
  new SlashCommandBuilder().setName('wallet').setDescription('Check cashback and spins')
    .addUserOption(o => o.setName('user').setDescription('User to check. Leave empty for yourself').setRequired(false)),
    
  new SlashCommandBuilder().setName('spins').setDescription('Check spin slots')
    .addUserOption(o => o.setName('user').setDescription('User to check. Leave empty for yourself').setRequired(false)),
    
  new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 cashback users'),
  
  new SlashCommandBuilder().setName('cashback').setDescription('ADMIN: Give 1 spin slot to user')
    .addUserOption(o => o.setName('user').setDescription('User to give spin to').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  new SlashCommandBuilder().setName('addcash').setDescription('ADMIN: Add cashback to user')
    .addUserOption(o => o.setName('user').setDescription('User to add cash to').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount to add').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  new SlashCommandBuilder().setName('removecash').setDescription('ADMIN: Remove cashback from user')
    .addUserOption(o => o.setName('user').setDescription('User to remove cash from').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount to remove').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  new SlashCommandBuilder().setName('resetuser').setDescription('ADMIN: Reset user balance and spins')
    .addUserOption(o => o.setName('user').setDescription('User to reset').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  new SlashCommandBuilder().setName('setcooldown').setDescription('ADMIN: Set spin cooldown')
    .addIntegerOption(o => o.setName('minutes').setDescription('Cooldown in minutes').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
].map(cmd => cmd.toJSON());

// ===== REGISTER GUILD COMMANDS =====
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  const guilds = client.guilds.cache.map(g => g.id);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  
  for (const guildId of guilds) {
    try {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
      console.log(`Commands registered for guild ${guildId}`);
    } catch (err) { console.error(err); }
  }
});

// ===== BOT LOGIC =====
let cooldown = 5;

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const { commandName } = interaction;

  // /spin
  if (commandName === 'spin') {
    let userData = await User.findOne({ userId: interaction.user.id });
    if (!userData || userData.spins < 1) return interaction.reply('❌ You have 0 spin slots. Ask admin for `/cashback`');
    userData.spins -= 1;
    const win = Math.floor(Math.random() * 100) + 10; 
    userData.balance += win;
    await userData.save();
    return interaction.reply(`🎰 You spun and won **₹${win}**!\n💰 New Balance: ₹${userData.balance}\n🎰 Spins left: ${userData.spins}`);
  }

  // /wallet
  if (commandName === 'wallet') {
    const user = interaction.options.getUser('user') || interaction.user;
    let data = await User.findOne({ userId: user.id }) || { balance: 0, spins: 0 };
    return interaction.reply(`👛 **${user.username}'s Wallet**\n💰 Cashback: ₹${data.balance}\n🎰 Spin Slots: ${data.spins}`);
  }

  // /spins
  if (commandName === 'spins') {
    const user = interaction.options.getUser('user') || interaction.user;
    let data = await User.findOne({ userId: user.id }) || { spins: 0 };
    return interaction.reply(`🎰 **${user.username}** has **${data.spins}** spin slot(s)`);
  }

  // /leaderboard
  if (commandName === 'leaderboard') {
    const top = await User.find().sort({ balance: -1 }).limit(10);
    let msg = '🏆 **Leaderboard**\n';
    top.forEach((u, i) => msg += `${i+1}. <@${u.userId}> - ₹${u.balance}\n`);
    return interaction.reply(msg || 'No data yet');
  }

  // /cashback - ADMIN
  if (commandName === 'cashback') {
    const user = interaction.options.getUser('user');
    let data = await User.findOneAndUpdate({ userId: user.id }, { $inc: { spins: 1 } }, { upsert: true, new: true });
    return interaction.reply(`✅ Gave 1 spin to **${user.username}**. Total: ${data.spins}`);
  }

  // /addcash - ADMIN
  if (commandName === 'addcash') {
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    let data = await User.findOneAndUpdate({ userId: user.id }, { $inc: { balance: amount } }, { upsert: true, new: true });
    return interaction.reply(`✅ Added ₹${amount} to **${user.username}**. New balance: ₹${data.balance}`);
  }

  // /removecash - ADMIN
  if (commandName === 'removecash') {
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    let data = await User.findOneAndUpdate({ userId: user.id }, { $inc: { balance: -amount } }, { new: true });
    return interaction.reply(`✅ Removed ₹${amount} from **${user.username}**. New balance: ₹${data.balance}`);
  }

  // /resetuser - ADMIN
  if (commandName === 'resetuser') {
    const user = interaction.options.getUser('user');
    await User.findOneAndUpdate({ userId: user.id }, { balance: 0, spins: 0 });
    return interaction.reply(`✅ Reset **${user.username}**`);
  }

  // /setcooldown - ADMIN
  if (commandName === 'setcooldown') {
    cooldown = interaction.options.getInteger('minutes');
    return interaction.reply(`✅ Cooldown set to ${cooldown} minutes`);
  }
});

client.login(process.env.TOKEN);
