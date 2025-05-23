const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot je online!");
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Web server běží na portu " + listener.address().port);
});

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const TOKEN = "YOUR_TOKEN";
const adminChannelId = "ADMIN_CHANNEL_ID";
const userChannelId = "USER_CHANNEL_ID";

const whitelistRoleId = "ROLE_TO_ADD";
const adminRoleId = "ROLE_TO_ADMIN";
const removeRoleId = "ROLE_TO_REMOVE";

const questions = [
  "Kolik ti je let?",
  "Jak dlouho RPíš?",
  "Lore postavy",
  "Co je to RP?",
  "Co je /me a /do a uveď příklad",
  "Co je to powergaming a uveď příklad",
  "Jsi na postřelený a na serveru nejsou žádné EMS. Jak se dál zachováš a co jak to budeš RPit (nemusíš uvádět /me a /do",
];

const userAnswers = new Map();

client.once("ready", async () => {
  console.log(`✅ Přihlášen jako ${client.user.tag}`);

  const userChannel = await client.channels.fetch(userChannelId);

  const startEmbed = new EmbedBuilder()
    .setTitle("Žádost o whitelist")
    .setDescription(
      "Klikni na tlačítko níže a vyplň prosím několik otázek pro whitelist.",
    )
    .setColor("Blue");

  const startButton = new ButtonBuilder()
    .setCustomId("startWhitelist")
    .setLabel("Začít žádost")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(startButton);

  await userChannel.send({ embeds: [startEmbed], components: [row] });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === "startWhitelist") {
      try {
        await interaction.reply({
          content: "Zprávu jsme ti odeslali do PM",
          ephemeral: true,
        });

        const user = interaction.user;
        const dm = await user.createDM();

        userAnswers.set(user.id, { answers: [], current: 0 });

        const embed = new EmbedBuilder()
          .setTitle(`Otázka 1/${questions.length}`)
          .setDescription(questions[0])
          .setColor("Blue");

        await dm.send({ embeds: [embed] });
      } catch {
        await interaction.reply({
          content:
            "Nepodařilo se mi ti poslat zprávu do DM. Zkontroluj nastavení soukromí.",
          ephemeral: true,
        });
      }
    }

    if (
      interaction.customId.startsWith("approve_") ||
      interaction.customId.startsWith("deny_")
    ) {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!member.roles.cache.has(adminRoleId)) {
        await interaction.reply({
          content: "Nemáš oprávnění schválit nebo odmítnout žádost.",
          ephemeral: true,
        });
        return;
      }
    }

    if (interaction.customId.startsWith("approve_")) {
      const userId = interaction.customId.split("_")[1];
      const guild = interaction.guild;

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        await interaction.reply({
          content: "Uživatel není na serveru.",
          ephemeral: true,
        });
        return;
      }

      await member.roles.add(whitelistRoleId);
      await member.roles.remove(removeRoleId).catch(() => {});

      const approver = interaction.user;

      const embed = new EmbedBuilder()
        .setTitle("Whitelist schválen")
        .setDescription(
          `Tvoje žádost byla schválena. Gratulujeme! 🎉\n\nSchválil: ${approver.tag}`,
        )
        .setColor("Green");

      await member.send({ embeds: [embed] }).catch(() => {});

      await interaction.update({
        content: `Whitelist žádost uživatele <@${userId}> admin který schvalil whitelist: <@${interaction.user.id}>.`,
        components: [],
        embeds: [],
      });
    }

    if (interaction.customId.startsWith("deny_")) {
      const userId = interaction.customId.split("_")[1];

      const modal = new ModalBuilder()
        .setCustomId(`denyModal_${userId}`)
        .setTitle("Důvod zamítnutí whitelistu");

      const reasonInput = new TextInputBuilder()
        .setCustomId("denyReason")
        .setLabel("Napiš důvod zamítnutí")
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(5)
        .setRequired(true);

      const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("denyModal_")) {
      const userId = interaction.customId.split("_")[1];
      const reason = interaction.fields.getTextInputValue("denyReason");

      const guild = interaction.guild;
      const member = await guild.members.fetch(userId).catch(() => null);

      const embed = new EmbedBuilder()
        .setTitle("Whitelist zamítnut")
        .setDescription(
          `Tvoje žádost byla bohužel zamítnuta.\n**Důvod:** ${reason}`,
        )
        .setColor("Red");

      if (member) {
        await member.send({ embeds: [embed] }).catch(() => {});
      }

      try {
        await interaction.message
          .delete()
          .catch((err) =>
            console.error("❌ Chyba při mazání embed zprávy:", err),
          );

        await interaction.reply({
          content: `Žádost uživatele <@${userId}> byla zamítnuta s důvodem: **${reason}** Admin který odmítnul whitelist: <@${interaction.user.id}>`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("❌ Chyba při zpracování zamítnutí:", error);
        await interaction.reply({
          content:
            "Nastala chyba při mazání zprávy nebo při odesílání odpovědi.",
          ephemeral: true,
        });
      }
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild && userAnswers.has(message.author.id)) {
    const data = userAnswers.get(message.author.id);
    data.answers.push(message.content);
    data.current++;

    if (data.current < questions.length) {
      const embed = new EmbedBuilder()
        .setTitle(`Otázka ${data.current + 1}/${questions.length}`)
        .setDescription(questions[data.current])
        .setColor("Blue");
      await message.channel.send({ embeds: [embed] });
    } else {
      const thankEmbed = new EmbedBuilder()
        .setTitle("Děkujeme za vyplnění žádosti")
        .setDescription(
          "Tvoje odpovědi jsme přijali a čekej na schválení administrátory.",
        )
        .setColor("Green");
      await message.channel.send({ embeds: [thankEmbed] });

      try {
        const adminChannel = await client.channels.fetch(adminChannelId);

        const embed = new EmbedBuilder()
          .setTitle("Nová žádost o whitelist")
          .setDescription(`Žádost uživatele <@${message.author.id}>`)
          .setColor("Green")
          .addFields(
            questions.map((q, i) => ({
              name: q,
              value: data.answers[i] || "Nezodpovězeno",
            })),
          );

        const approveBtn = new ButtonBuilder()
          .setCustomId(`approve_${message.author.id}`)
          .setLabel("Schválit")
          .setStyle(ButtonStyle.Success);

        const denyBtn = new ButtonBuilder()
          .setCustomId(`deny_${message.author.id}`)
          .setLabel("Odmítnout")
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);

        await adminChannel.send({ embeds: [embed], components: [row] });
        console.log(
          `✅ Žádost od ${message.author.tag} byla odeslána do admin kanálu.`,
        );
      } catch (err) {
        console.error(
          "❌ Chyba při odesílání embed zprávy do admin kanálu:",
          err,
        );
      }

      userAnswers.delete(message.author.id);
    }
  }
});

client.login(TOKEN);
