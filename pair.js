const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const { upload } = require("./mega");
const qrcode = require("qrcode");

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}

module.exports = function(io) {
    const router = express.Router();

    // Existing route for pairing code
    router.get("/", async (req, res) => {
      let num = req.query.number;
      async function RobinPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
          let RobinPairWeb = makeWASocket({
            auth: {
              creds: state.creds,
              keys: makeCacheableSignalKeyStore(state.keys,pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }).child({ level: "fatal" }),
            browser: Browsers.macOS("Safari"),
          });

          if (!RobinPairWeb.authState.creds.registered) {
            await delay(1500);
            num = num.replace(/[^0-9]/g, "");
            const code = await RobinPairWeb.requestPairingCode(num);
            if (!res.headersSent) {
              await res.send({ code });
            }
          }

          RobinPairWeb.ev.on("creds.update", saveCreds);
          RobinPairWeb.ev.on("connection.update", async (s) => {
            const { connection, lastDisconnect } = s;
            if (connection === "open") {
              try {
                await delay(10000);
                const auth_path = "./session/";
                const user_jid = jidNormalizedUser(RobinPairWeb.user.id);

                function randomMegaId(length = 6, numberLength = 4) {
                  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                  let result = "";
                  for (let i = 0; i < length; i++) { result += characters.charAt(Math.floor(Math.random() * characters.length));}
                  const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                  return `${result}${number}`;
                }

                const mega_url = await upload(fs.createReadStream(auth_path + "creds.json"), `${randomMegaId()}.json`);
                const string_session = mega_url.replace("https://mega.nz/file/", "");

                const sid = `*ROBIN [The powerful WA BOT]*\n\n痩 ${string_session} 争\n\n*This is the your Session ID, copy this id and paste into config.js file*\n\n*You can ask any question using this link*\n\n*wa.me/message/WKGLBR2PCETWD1*\n\n*You can join my whatsapp group*\n\n*https://chat.whatsapp.com/GAOhr0qNK7KEvJwbenGivZ*`;
                const mg = `尅 *Do not share this code to anyone* 尅`;
                
                await RobinPairWeb.sendMessage(user_jid, { image: { url: "https://raw.githubusercontent.com/Dark-Robin/Bot-Helper/refs/heads/main/autoimage/Bot%20robin%20WP.jpg" }, caption: sid });
                await RobinPairWeb.sendMessage(user_jid, { text: string_session });
                await RobinPairWeb.sendMessage(user_jid, { text: mg });
              } catch (e) {
                console.error("Error during session upload or message sending:", e);
              } finally {
                await delay(100);
                await RobinPairWeb.end(); // Gracefully close connection
                await removeFile("./session"); // Cleanup session files
              }
            } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
              await delay(10000);
              RobinPair();
            }
          });
        } catch (err) {
          console.error("Pairing Error:", err);
          await removeFile("./session");
          if (!res.headersSent) {
            await res.status(500).send({ code: "Service Unavailable" });
          }
        }
      }
      return await RobinPair();
    });

    // Handle QR code requests via Socket.IO
    io.on('connection', (socket) => {
        let RobinQR = null;
        const sessionPath = `./session_qr_${socket.id}`;

        const connectWithQR = async () => {
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            try {
                RobinQR = makeWASocket({
                    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" }))},
                    printQRInTerminal: false,
                    logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                    browser: Browsers.macOS("Safari"),
                });

                RobinQR.ev.on("creds.update", saveCreds);
                RobinQR.ev.on("connection.update", async (s) => {
                    const { connection, lastDisconnect, qr } = s;

                    if (qr) {
                        try {
                            const qrCodeDataURL = await qrcode.toDataURL(qr);
                            socket.emit('qr', qrCodeDataURL);
                        } catch (qrErr) {
                            socket.emit('error', 'Failed to generate QR code.');
                        }
                    }

                    if (connection === "open") {
                        socket.emit('connected', 'Successfully connected! Session ID will be sent to your WhatsApp.');
                        try {
                            await delay(10000);
                            const user_jid = jidNormalizedUser(RobinQR.user.id);

                            function randomMegaId(length = 6, numberLength = 4) {
                               const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                               let result = "";
                               for (let i = 0; i < length; i++) { result += characters.charAt(Math.floor(Math.random() * characters.length)); }
                               const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                               return `${result}${number}`;
                            }

                            const mega_url = await upload(fs.createReadStream(sessionPath + "/creds.json"), `${randomMegaId()}.json`);
                            const string_session = mega_url.replace("https://mega.nz/file/", "");

                            const sid = `*ROBIN [The powerful WA BOT]*\n\n痩 ${string_session} 争\n\n*This is the your Session ID, copy this id and paste into config.js file*\n\n*You can ask any question using this link*\n\n*wa.me/message/WKGLBR2PCETWD1*\n\n*You can join my whatsapp group*\n\n*https://chat.whatsapp.com/GAOhr0qNK7KEvJwbenGivZ*`;
                            const mg = `尅 *Do not share this code to anyone* 尅`;
                            await RobinQR.sendMessage(user_jid, { image: { url: "https://raw.githubusercontent.com/Dark-Robin/Bot-Helper/refs/heads/main/autoimage/Bot%20robin%20WP.jpg" }, caption: sid });
                            await RobinQR.sendMessage(user_jid, { text: string_session });
                            await RobinQR.sendMessage(user_jid, { text: mg });
                        } catch (e) {
                             socket.emit('error', 'Failed to send Session ID.');
                        } finally {
                            await delay(100);
                            RobinQR.end();
                            await removeFile(sessionPath);
                        }
                    }

                    if (connection === "close") {
                        if (lastDisconnect?.error?.output?.statusCode !== 401) {
                            connectWithQR();
                        } else {
                            socket.emit('disconnected', 'Connection closed. Please try again.');
                            await removeFile(sessionPath);
                        }
                    }
                });
            } catch (err) {
                socket.emit('error', 'An internal error occurred. Please refresh and try again.');
                await removeFile(sessionPath);
            }
        };

        socket.on('get-qr', connectWithQR);
        socket.on('disconnect', () => {
             if (RobinQR) RobinQR.end();
             removeFile(sessionPath);
        });
    });

    return router;
}

process.on("uncaughtException", function (err) {
  console.log("Caught exception: " + err);
  exec("pm2 restart Robin");
});
