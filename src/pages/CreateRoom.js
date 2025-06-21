// src/page/CreateRoom.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/CreateRoom.module.css";

function CreateRoom() {
    const [username, setUsername] = useState("");
    const navigate = useNavigate();

    const handleCreateRoom = () => {
        if (!username.trim()) return alert("名前を入力してください");

        const roomId = Math.random().toString(36).substring(2, 10); //ランダムな8文字ID生成
        navigate(`/room/${roomId}`, { state: { username } }); 
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>ルームを作成</h2>
            <input 
                className={styles.input}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="あなたの名前を入力"
            />
            <button className={styles.button} onClick={handleCreateRoom}>
                ルーム作成
            </button>
        </div>
    );
}

export default CreateRoom;