const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const users = {};

io.on("connection", (socket) => {
    socket.on("joinRoom", ({ room, username }) => {
        socket.join(room);
        users[socket.id] = { id: socket.id, room, username };

        // إخبار باقي المستخدمين بأن مستخدم جديد انضم
        socket.broadcast.to(room).emit("userJoined", socket.id);

        // تحديث قائمة المستخدمين بالغرفة
        io.to(room).emit("roomUsers", {
            users: Object.values(users).filter((user) => user.room === room),
        });

        // استقبال الرسائل النصية
        socket.on("chatMessage", ({ message, username }) => {
            io.to(room).emit("message", `${username}: ${message}`);
        });

        // استقبال عرض (Offer) وإرساله للمستخدم الهدف
        socket.on("offer", ({ offer, to }) => {
            socket.to(to).emit("offer", { offer, from: socket.id });
        });

        // استقبال الرد (Answer) وإرساله للمستخدم الهدف
        socket.on("answer", ({ answer, to }) => {
            socket.to(to).emit("answer", { answer, from: socket.id });
        });

        // استقبال الرسائل الصوتية
        socket.on("iceCandidate", ({ candidate, to }) => {
            socket.to(to).emit("iceCandidate", { candidate, from: socket.id });
        });

        socket.on("disconnectRoom", () => {
            delete users[socket.id];
            socket.leave(room);

            // تحديث قائمة المستخدمين عند المغادرة
            io.to(room).emit("roomUsers", {
                users: Object.values(users).filter(
                    (user) => user.room === room,
                ),
            });
        });

        socket.on("disconnect", () => {
            delete users[socket.id];
            socket.leave(room);
        });
    });
});

server.listen(3000, () => console.log("Server running on port 3000"));
