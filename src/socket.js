// src/socket.js
import { io } from "socket.io-client";

const socket = io("http://localhost:3001", {
    autoConnect: false,
    reconnection: false
}); // サーバーと接続

export default socket;