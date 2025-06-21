// src/page/JoinRoom.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/JoinRoom.module.css";

const JoinRoom = () => {
    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState('');
    const navigate = useNavigate();

    const handleJoin = () => {
        if (roomId.trim() && username.trim()) {
            navigate(`/room/${roomId}`, { state: { username } });
        } else {
            alert("名前とルームIDを入力してください");
        }
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>ルームに参加</h2>
            <input 
                type="text"
                placeholder="ルームIDを入力"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className={styles.input}
            />
            <input 
                type="text"
                placeholder="あなたの名前を入力"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.input}
            />
            <button onClick={handleJoin} className={styles.button}>
                参加する
            </button>
        </div>
    );
};

export default JoinRoom;