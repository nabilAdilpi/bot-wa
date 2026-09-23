// Import Module
require('./len')
require('./database/Menu/nbilMenu')
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { exec } = require("child_process");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const TMP_DIR = path.join(os.tmpdir(), "fotolive-bot");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// Import Scrape
const Ai4Chat = require('./scrape/Ai4Chat');
const tiktok2 = require('./scrape/Tiktok');

// ================= Helper Khusus .fotolive =================

// Ambil objek videoMessage: dari pesan langsung (caption .fotolive)
// atau dari pesan yang di-reply (quoted)
function getVideoMessage(msg) {
    const m = msg.message;
    if (!m) return null;

    if (m.videoMessage) return m.videoMessage;

    const ctx = m.extendedTextMessage?.contextInfo;
    if (ctx?.quotedMessage?.videoMessage) return ctx.quotedMessage.videoMessage;

    return null;
}

async function downloadVideo(videoMsg, outPath) {
    const stream = await downloadContentFromMessage(videoMsg, "video");
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    fs.writeFileSync(outPath, Buffer.concat(chunks));
}

// Proses video jadi versi pendek & ringan, cocok untuk efek "live photo"
function processToLivePhoto(inputPath, outputPath, { maxDurationSec = 6 } = {}) {
    return new Promise((resolve, reject) => {
        const cmd = `ffmpeg -y -i "${inputPath}" -t ${maxDurationSec} -vf "scale=480:-2" -an -c:v libx264 -preset fast -crf 28 -movflags +faststart "${outputPath}"`;
        exec(cmd, (err, stdout, stderr) => {
            if (err) return reject(stderr || err);
            resolve(outputPath);
        });
    });
}

// ================= Helper Khusus .stiker =================

// Ambil objek imageMessage: dari pesan langsung (caption .stiker)
// atau dari pesan yang di-reply (quoted)
function getImageMessage(msg) {
    const m = msg.message;
    if (!m) return null;

    if (m.imageMessage) return m.imageMessage;

    const ctx = m.extendedTextMessage?.contextInfo;
    if (ctx?.quotedMessage?.imageMessage) return ctx.quotedMessage.imageMessage;

    return null;
}

async function downloadImage(imageMsg, outPath) {
    const stream = await downloadContentFromMessage(imageMsg, "image");
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    fs.writeFileSync(outPath, Buffer.concat(chunks));
}

// Ubah gambar jadi stiker (.webp) pakai ffmpeg, dipas-kan ke kanvas 512x512
function convertToSticker(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const cmd = `ffmpeg -y -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -f webp "${outputPath}"`;
        exec(cmd, (err, stdout, stderr) => {
            if (err) return reject(stderr || err);
            resolve(outputPath);
        });
    });
}

// ==============================================================

module.exports = async (nbil, m) => {
    const msg = m.messages[0];
    if (!msg.message) return;

    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const sender = msg.key.remoteJid;
    const pushname = msg.pushName || "Nbil";
    const args = body.slice(1).trim().split(" ");
    const command = args.shift().toLowerCase();
    const q = args.join(" ");

    if (!body.startsWith(prefix)) return;

    const nbilreply = (teks) => nbil.sendMessage(sender, { text: teks }, { quoted: msg });
    const isGroup = sender.endsWith('@g.us');
    const isAdmin = (admin.includes(sender))
    const menuImage = fs.readFileSync(image);

switch (command) {

// Menu
case "menu": {
    await nbil.sendMessage(sender,
        {
            image: menuImage,
            caption: nbilmenu,
            mentions: [sender]
        },
    { quoted: msg }
    )
}
break

// Hanya Admin
case "admin": {
    if (!isAdmin) return nbilreply(mess.admin); // COntoh Penerapan Hanya Admin
    nbilreply("*Kamu Adalah Admin*"); // Admin Akan Menerima Pesan Ini
}
break

// Hanya Group
case "group": {
    if (!isGroup) return nbilreply(mess.group); // Contoh Penerapan Hanya Group
    nbilreply("*Kamu Sedang Berada Di Dalam Grup*"); // Pesan Ini Hanya Akan Dikirim Jika Di Dalam Grup
}
break

// AI Chat
case "ai": {
    if (!q) return nbilreply("*contoh: *.ai Apa itu JavaScript?");
        nbilreply(mess.wait);
    try {
        const lenai = await Ai4Chat(q);
            await nbilreply(`*Kiwir AI*\n\n${lenai}`);
                } catch (error) {
            console.error("Error:", error);
        nbilreply(mess.error);
    }
}
break;

case "tiktok": {
    if (!q) return nbilreply("*Mana Link Tiktoknya kimak*");
        nbilreply(mess.wait);
    try {
        const result = await tiktok2(q); // Panggil Fungsi Scraper

            // Kirim Video
            await nbil.sendMessage(
                sender,
                    {
                        video: { url: result.no_watermark }
                    },
                { quoted: msg }
            );

        } catch (error) {
            console.error("Error TikTok DL:", error);
        nbilreply(mess.error);
    }
}
break;

case "instagram": {
    if (!q) return nbilreply("*Mana Link Instagramnya kimak*");
    try {
        nbilreply(mess.wait);

        // Panggil API Velyn
        const apiUrl = `https://www.velyn.biz.id/api/downloader/instagram?url=${encodeURIComponent(q)}`;
        const response = await axios.get(apiUrl);

        if (!response.data.status || !response.data.data.url[0]) {
            throw new Error("Link tidak valid atau API error");
        }

        const data = response.data.data;
        const mediaUrl = data.url[0];
        const metadata = data.metadata;

        // Kirim Media
        if (metadata.isVideo) {
            await nbil.sendMessage(
                sender,
                    {
                        video: { url: mediaUrl },
                        caption: `*Instagram Reel*\n\n` +
                            `*Username :* ${metadata.username}\n` +
                            `*Likes :* ${metadata.like.toLocaleString()}\n` +
                            `*Comments :* ${metadata.comment.toLocaleString()}\n\n` +
                            `*Caption :* ${metadata.caption || '-'}\n\n` +
                            `*Source :* ${q}`
                    },
                    { quoted: msg }
                );
        } else {
            await nbil.sendMessage(
                sender,
                    {
                        image: { url: mediaUrl },
                        caption: `*Instagram Post*\n\n` +
                            `*Username :* ${metadata.username}\n` +
                            `*Likes :* ${metadata.like.toLocaleString()}\n\n` +
                            `*Caption :* ${metadata.caption || '-'}`
                    },
                    { quoted: msg }
                );
            }

        } catch (error) {
            console.error("Error Instagram DL:", error);
        nbilreply(mess.error);
    }
}
break;

// Foto Live (video pendek -> live photo / gifPlayback)
case "fotolive": {
    const videoMsg = getVideoMessage(msg);
    if (!videoMsg) {
        return nbilreply("⚠️ Reply video pendek dengan caption *.fotolive*, atau kirim video dengan caption *.fotolive* ya.");
    }

    nbilreply("⏳ Memproses foto live...");

    const id = `${sender.replace(/[^0-9]/g, "")}-${Date.now()}`;
    const inputPath = path.join(TMP_DIR, `${id}-in.mp4`);
    const outputPath = path.join(TMP_DIR, `${id}-out.mp4`);

    try {
        // 1. Download video asli (dari quoted atau dari pesan itu sendiri)
        await downloadVideo(videoMsg, inputPath);

        // 2. Proses jadi versi pendek & ringan
        await processToLivePhoto(inputPath, outputPath, { maxDurationSec: 6 });

        // 3. Kirim balik sebagai "live photo" (gifPlayback = auto-play & looping di WA)
        await nbil.sendMessage(
            sender,
            {
                video: fs.readFileSync(outputPath),
                gifPlayback: true,
                caption: "✨ Foto live berhasil dibuat!"
            },
            { quoted: msg }
        );
    } catch (error) {
        console.error("Error .fotolive:", error);
        nbilreply(mess.error || "❌ Gagal memproses foto live. Coba lagi dengan video yang lebih pendek.");
    } finally {
        // 4. Bersihkan file sementara
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
}
break;

// Gambar ke Stiker
case "stiker": {
    const imageMsg = getImageMessage(msg);
    if (!imageMsg) {
        return nbilreply("⚠️ Reply gambar dengan caption *.stiker*, atau kirim gambar dengan caption *.stiker* ya.");
    }

    nbilreply("⏳ Membuat stiker...");

    const id = `${sender.replace(/[^0-9]/g, "")}-${Date.now()}`;
    const inputPath = path.join(TMP_DIR, `${id}-img-in`);
    const outputPath = path.join(TMP_DIR, `${id}-img-out.webp`);

    try {
        // 1. Download gambar asli (dari quoted atau dari pesan itu sendiri)
        await downloadImage(imageMsg, inputPath);

        // 2. Konversi jadi stiker (.webp)
        await convertToSticker(inputPath, outputPath);

        // 3. Kirim balik sebagai stiker
        await nbil.sendMessage(
            sender,
            { sticker: fs.readFileSync(outputPath) },
            { quoted: msg }
        );
    } catch (error) {
        console.error("Error .stiker:", error);
        nbilreply(mess.error || "❌ Gagal membuat stiker. Coba lagi dengan gambar lain.");
    } finally {
        // 4. Bersihkan file sementara
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
}
break;

// Game Tebak Angka
case "tebakangka": {
    const target = Math.floor(Math.random() * 100);
        nbil.tebakGame = { target, sender };
    nbilreply("*Tebak Angka 1 - 100*\n*Ketik .tebak [Angka]*");
}
break;

case "tebak": {
    if (!nbil.tebakGame || nbil.tebakGame.sender !== sender) return;
        const guess = parseInt(args[0]);
    if (isNaN(guess)) return nbilreply("❌ *Masukkan Angka!*");

    if (guess === nbil.tebakGame.target) {
        nbilreply(`🎉 *Tebakkan Kamu Benar!*`);
            delete nbil.tebakGame;
        } else {
            nbilreply(guess > nbil.tebakGame.target ? "*Terlalu Tinggi!*" : "*Terlalu rendah!*");
    }
}
break;

case "p": {
    nbilreply(`kalo nak tengok menu ketik ".menu" lah lek...`)
}
break;

case "quote": {
    const quotes = [
        "Jangan menyerah, hari buruk akan berlalu.",
        "Kesempatan tidak datang dua kali.",
        "Kamu lebih kuat dari yang kamu kira.",
        "Hidup ini singkat, jangan sia-siakan."
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    nbilreply(`*Quote Hari Ini :*\n_"${randomQuote}"_`);
}
break;

        default: { nbilreply(mess.default) }
    }
}