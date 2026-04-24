const { Server } = require("socket.io");

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://fe-2n6s.onrender.com",
  /https:\/\/.*\.onrender\.com$/,
];

let io;

exports.init = (server) => {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  io.on("connection", (socket) => {
    socket.on("disconnect", () => {});
  });

  return io;
};

exports.getIo = () => {
  if (!io) throw new Error("Socket.io not initialised yet");
  return io;
};
