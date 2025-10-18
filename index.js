const express = require("express");
const http = require('http');
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

__path = process.cwd();
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;

require("events").EventEmitter.defaultMaxListeners = 500;

// Pass the 'io' instance to the pairing router
let code = require("./pair")(io);
app.use("/code", code);

app.use("/", async (req, res, next) => {
  res.sendFile(__path + "/pair.html");
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Start the server
server.listen(PORT, () => {
  console.log(`⏩ Server running on http://localhost:` + PORT);
});

module.exports = app;
