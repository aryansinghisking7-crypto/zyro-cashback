const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ] 
});

// MongoDB Schema
const UserSchema = new mongoose.Schema({
  userId: String,
  balance: { type: Number, default: 1000 },
  lastSpin: { type: Date, default: null }
});
const User = mongoose.model('User', UserSchema);

// Connect to Mongo
mongoose.connect(process.env.MONGO_URI)
 .then(() => console.log('✅ MongoDB Connected'))
 .catch(err => console.log(err));

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  //!spin command
  if (message.content === '!spin') {
    let user = await User.findOne({ userId: message.author.id });
    if (!user) user = await User.create({ userId: message.author.id });

    // Cooldown 10 seconds
    if (user.lastSpin && (Date.now() - user.lastSpin) < 10000) {
      return message.reply('⏳ Wait 10 seconds before spinning again!');
    }

    const bet = 100;
    if (user.balance < bet) return message.reply('💸 Not enough coins!');

    user.balance -= bet;
    const win = Math.random() < 0.4; // 40% win chance
    const prize = win? bet * 2 : 0;
    user.balance += prize;
    user.lastSpin = new Date();
    await user.save();

    const embed = new EmbedBuilder()
     .setTitle(win? '🎉 YOU WON!' : '😢 YOU LOST')
     .setDescription(`Bet: ${bet} coins\nPrize: ${prize} coins\nBalance: ${user.balance} coins`)
     .setColor(win? 'Green' : 'Red');
    
    message.reply({ embeds: [embed] });
  }

  //!balance command
  if (message.content === '!balance') {
    let user = await User.findOne({ userId: message.author.id });
    if (!user) user = await User.create({ userId: message.author.id });
    message.reply(`💰 Your balance: ${user.balance} coins`);
  }
});

client.login(process.env.TOKEN);
